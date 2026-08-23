/**
 * CallsClient — the WebRTC + signaling engine for the native Calls feature.
 *
 * Protocol (server/channels/calls — plugin-compatible):
 *
 *   browser ──RTCPeerConnection──▶ rtcd SFU     (media: audio/video/screen)
 *   browser ──shared wsClient──▶  server        (signaling: SDP/ICE + verbs)
 *                 └── WS ──▶ rtcd               (server relays signaling to SFU)
 *
 * Signaling rides the SAME authenticated WebSocket the chat uses
 * (lib/chat/client.ts wsClient): outbound actions are `custom_calls_<type>`,
 * inbound events arrive as `custom_calls_*` (dispatched in calls-events.ts).
 *
 * Join handshake:
 *   1. send join {channelID}; acquire local media first so the offer has tracks
 *   2. server replies `join` ack {connID, iceServers} (unicast)
 *   3. create the RTCPeerConnection with those ICE servers; add local tracks
 *   4. PC fires negotiationneeded → setLocalDescription → send sdp offer
 *   5. SFU answer returns as `signal` {data}; ICE candidates likewise
 *   6. `call_state` (unicast) delivers the full participant snapshot
 *
 * Media routing on the receive side (rtcd labels tracks deterministically):
 *   track.id = "<type>_<originSessionID>_<rand>" and stream.id = origin
 *   sessionID, where type ∈ {voice, video, screen, screen-audio}. Audio is
 *   played via detached <audio> elements; video/screen streams land in the
 *   store keyed by the ORIGIN session so tiles bind the right participant.
 *
 * The RTCPeerConnection lives on this singleton (NOT in the zustand store) so
 * media renegotiation never triggers React re-renders. Negotiation follows the
 * "polite peer" perfect-negotiation pattern with ICE candidate queuing, and
 * senders are reused (replaceTrack) for mute/video toggles to avoid
 * renegotiation — the SFU requires stable track/stream ids, so tracks are
 * never stopped/re-added mid-call.
 */

import { wsClient } from '@/lib/chat/client'
import { useCallsStore } from './calls-store'

// ─── Constants ──────────────────────────────────────────────────────

/** Action prefix on the shared WS; the server's wsapi layer strips it. */
const ACTION_PREFIX = 'custom_calls_'

/** Simulcast encodings for screen share (low + high layers). */
const SCREEN_ENCODINGS = [
	{ rid: 'l', maxBitrate: 500_000, maxFramerate: 5 },
	{ rid: 'h', maxBitrate: 2_500_000, maxFramerate: 20 },
]

/** Single-layer encoding for the camera track. */
const CAMERA_ENCODING = [{ maxBitrate: 1_000_000, maxFramerate: 30 }]

// ─── Signaling helpers ──────────────────────────────────────────────

/** Send a calls action over the shared websocket. */
function sendAction(type: string, data: Record<string, unknown> = {}): void {
	wsClient.sendMessage(ACTION_PREFIX + type, data)
}

/**
 * Parse a track id emitted by rtcd: "<type>_<sessionID>_<rand>".
 * Returns [type, sessionID] or null when the format doesn't match.
 */
function parseTrackId(trackId: string): { type: string; sessionId: string } | null {
	const idx = trackId.indexOf('_')
	const last = trackId.lastIndexOf('_')
	if (idx === -1 || last === idx) return null
	const type = trackId.slice(0, idx)
	const sessionId = trackId.slice(idx + 1, last)
	if (!['voice', 'video', 'screen', 'screen-audio'].includes(type)) return null
	return { type, sessionId }
}

// ─── Audio playback ─────────────────────────────────────────────────

/** Detached <audio> elements for remote voice tracks, keyed by track id. */
const audioEls = new Map<string, HTMLAudioElement>()

function attachAudio(track: MediaStreamTrack, stream: MediaStream): void {
	if (audioEls.has(track.id)) return
	const el = document.createElement('audio')
	el.autoplay = true
	el.srcObject = stream
	el.dataset.trackId = track.id
	document.body.appendChild(el)
	audioEls.set(track.id, el)
	// Stop the element when the track ends (SFU teardown).
	track.addEventListener('ended', () => detachAudio(track.id))
}

function detachAudio(trackId: string): void {
	const el = audioEls.get(trackId)
	if (el) {
		el.srcObject = null
		el.remove()
		audioEls.delete(trackId)
	}
}

function detachAllAudio(): void {
	for (const id of [...audioEls.keys()]) detachAudio(id)
}

// ─── CallsClient ────────────────────────────────────────────────────

class CallsClient {
	private pc: RTCPeerConnection | null = null
	private localStream: MediaStream | null = null
	private screenStream: MediaStream | null = null

	/** My stable session id (== the connID from the join ack). */
	private sessionId = ''
	private channelId = ''
	/** ICE servers delivered with the join ack. */
	private iceServers: RTCIceServer[] = []

	/** Track senders kept alive for replaceTrack toggles. */
	private videoSender: RTCRtpSender | null = null
	private screenSender: RTCRtpSender | null = null

	// Perfect-negotiation state (polite peer).
	private makingOffer = false
	private ignoreOffer = false
	private isSettingRemoteAnswerPending = false
	private queuedCandidates: RTCIceCandidateInit[] = []

	private joined = false
	private connecting = false

	// ─── Lifecycle ──────────────────────────────────────────────────

	/** Expose the local camera stream for the self-preview <video>. */
	getLocalStream(): MediaStream | null {
		return this.localStream
	}

	/** My session id (empty before the join ack). */
	getMySessionId(): string {
		return this.sessionId
	}

	/** Join (or start) a call in a channel. */
	async join(channelId: string, opts: { enableVideo?: boolean } = {}): Promise<void> {
		if (this.joined || this.connecting) return
		this.connecting = true

		const store = useCallsStore.getState()
		store.reset()
		store.setChannel(channelId)
		store.setStatus('connecting')
		this.channelId = channelId

		try {
			// Acquire local media BEFORE joining so the very first offer
			// carries the tracks (the SFU keys tracks by session id).
			await this.initLocalMedia(opts.enableVideo ?? false)
		} catch (err) {
			// Media failure is non-fatal: join voice-only; devices can be
			// enabled later from the widget.
			console.warn('[calls] failed to acquire local media, joining voice-only', err)
		}

		sendAction('join', { channelID: channelId })
	}

	/**
	 * Handle the join ack: create the peer connection with the delivered ICE
	 * servers and record the session id. Called by calls-events.ts.
	 */
	handleJoinAck(connID: string, iceServers: Array<{ urls?: string[] | string }> | undefined): void {
		if (!this.connecting && !this.joined) return
		this.sessionId = connID
		this.iceServers = (iceServers ?? []).map((s) => ({ urls: s.urls ?? [] }))

		const store = useCallsStore.getState()
		store.setMySessionId(connID)
		store.setStatus('joined')

		this.createPeerConnection()
		this.joined = true
		this.connecting = false
	}

	/** Leave the current call and release all resources. */
	leave(): void {
		if (this.channelId) {
			sendAction('leave', { channelID: this.channelId })
		}
		this.teardown()
		useCallsStore.getState().reset()
	}

	/**
	 * Handle a websocket reconnect while in a call: re-register the session
	 * with the server so unicast signaling reaches the new connection.
	 */
	handleWSReconnect(): void {
		if (!this.joined || !this.sessionId || !this.channelId) return
		sendAction('reconnect', {
			channelID: this.channelId,
			originalConnID: this.sessionId,
			prevConnID: this.sessionId,
		})
	}

	/** Tear down the peer connection and media tracks. */
	private teardown(): void {
		this.localStream?.getTracks().forEach((t) => t.stop())
		this.screenStream?.getTracks().forEach((t) => t.stop())
		this.localStream = null
		this.screenStream = null
		this.videoSender = null
		this.screenSender = null
		detachAllAudio()
		this.pc?.close()
		this.pc = null
		this.makingOffer = false
		this.ignoreOffer = false
		this.isSettingRemoteAnswerPending = false
		this.queuedCandidates = []
		this.joined = false
		this.connecting = false
		this.sessionId = ''
		this.channelId = ''
		this.iceServers = []
	}

	// ─── Local media ────────────────────────────────────────────────

	private async initLocalMedia(enableVideo: boolean): Promise<void> {
		this.localStream = await navigator.mediaDevices.getUserMedia({
			audio: true,
			video: enableVideo ? { facingMode: 'user' } : false,
		})
		const store = useCallsStore.getState()
		const mic = this.localStream.getAudioTracks()[0]
		const cam = this.localStream.getVideoTracks()[0]
		store.setMic(!!mic && mic.enabled)
		store.setCamera(!!cam)
	}

	// ─── Peer connection ────────────────────────────────────────────

	private createPeerConnection(): void {
		this.pc = new RTCPeerConnection({
			iceServers: this.iceServers,
			// Bundle media on a single transport for efficiency.
			bundlePolicy: 'max-bundle',
		})

		// Audio goes straight in; the camera uses a reusable transceiver so
		// video can toggle via replaceTrack without renegotiation. The SFU
		// keys tracks by stream id, so everything rides the local stream.
		if (this.localStream) {
			for (const track of this.localStream.getTracks()) {
				if (track.kind === 'audio') {
					this.pc.addTrack(track, this.localStream)
				} else if (track.kind === 'video') {
					const transceiver = this.pc.addTransceiver(track, {
						direction: 'sendonly',
						sendEncodings: CAMERA_ENCODING,
					})
					this.videoSender = transceiver.sender
				}
			}
		} else {
			// Keep the m-lines stable even without local media so later
			// enable-video doesn't renegotiate.
			const t = this.pc.addTransceiver('video', { direction: 'sendonly' })
			this.videoSender = t.sender
		}

		this.pc.onnegotiationneeded = this.onNegotiationNeeded
		this.pc.onicecandidate = this.onICECandidate
		this.pc.onconnectionstatechange = this.onConnectionStateChange
		this.pc.ontrack = this.onTrack
	}

	private onNegotiationNeeded = async (): Promise<void> => {
		if (!this.pc) return
		try {
			this.makingOffer = true
			await this.pc.setLocalDescription()
			this.sendSDP(this.pc.localDescription)
		} catch (err) {
			// Glare collisions are expected on the polite side.
			if (!(this.ignoreOffer || (this.pc.signalingState !== 'stable' && this.makingOffer))) {
				console.error('[calls] negotiation error', err)
			}
		} finally {
			this.makingOffer = false
		}
	}

	private onICECandidate = (ev: RTCPeerConnectionIceEvent): void => {
		if (ev.candidate) {
			sendAction('ice', { data: JSON.stringify(ev.candidate.toJSON()) })
		}
	}

	private onConnectionStateChange = (): void => {
		const state = this.pc?.connectionState
		const store = useCallsStore.getState()
		if (state === 'connected') {
			store.setStatus('connected')
		} else if (state === 'disconnected' || state === 'failed') {
			// The websocket path is still alive; only the media path dropped.
			if (this.joined) store.setStatus('reconnecting')
			if (state === 'failed') this.pc?.restartIce()
		}
	}

	/**
	 * Inbound tracks from the SFU. Track ids encode the origin session and
	 * kind (see parseTrackId); audio plays through detached elements, video
	 * and screen streams land in the store for the widget to render.
	 */
	private onTrack = (ev: RTCTrackEvent): void => {
		const store = useCallsStore.getState()
		const stream = ev.streams[0] ?? new MediaStream([ev.track])
		const parsed = parseTrackId(ev.track.id)

		if (ev.track.kind === 'audio') {
			// Voice + screen-audio both play aloud.
			attachAudio(ev.track, stream)
			return
		}

		if (!parsed) {
			// Unlabeled video (older SFU): treat as generic video; origin is
			// the stream id when present.
			const sessionId = stream.id || 'unknown'
			store.setVideoStream(sessionId, stream)
			ev.track.addEventListener('ended', () => store.setVideoStream(sessionId, null))
			return
		}

		if (parsed.type === 'screen') {
			store.setScreenStream(parsed.sessionId, stream)
			ev.track.addEventListener('ended', () => {
				const cur = useCallsStore.getState().screenStream
				if (cur?.sessionId === parsed.sessionId) store.setScreenStream(null, null)
			})
			return
		}

		if (parsed.type === 'video') {
			store.setVideoStream(parsed.sessionId, stream)
			ev.track.addEventListener('ended', () => store.setVideoStream(parsed.sessionId, null))
		}
	}

	/** Send an SDP offer/answer to the server (relayed to rtcd). */
	private sendSDP(desc: RTCSessionDescription | RTCSessionDescriptionInit | null | undefined): void {
		if (!desc) return
		// Serialize explicitly: RTCSessionDescription instances stringify to
		// {} in some engines (type/sdp live on the prototype).
		sendAction('sdp', { data: JSON.stringify({ type: desc.type, sdp: desc.sdp }) })
	}

	// ─── Inbound signaling ──────────────────────────────────────────

	/** Handle an inbound `signal` event (SDP answer/offer or ICE from rtcd). */
	async signal(data: unknown): Promise<void> {
		if (!this.pc) return
		try {
			const parsed = typeof data === 'string' ? JSON.parse(data) : data
			if (parsed.type === 'offer' || parsed.type === 'answer') {
				const description = new RTCSessionDescription(parsed)
				const readyForOffer = !this.makingOffer && (this.pc.signalingState === 'stable' || this.isSettingRemoteAnswerPending)
				const offerCollision = description.type === 'offer' && (this.makingOffer || this.pc.signalingState !== 'stable')
				this.ignoreOffer = !readyForOffer && offerCollision
				if (this.ignoreOffer) return

				this.isSettingRemoteAnswerPending = description.type === 'answer'
				await this.pc.setRemoteDescription(description)
				this.isSettingRemoteAnswerPending = false

				// Flush candidates buffered before the description landed.
				for (const c of this.queuedCandidates) {
					await this.pc.addIceCandidate(c)
				}
				this.queuedCandidates = []

				if (description.type === 'offer') {
					await this.pc.setLocalDescription()
					this.sendSDP(this.pc.localDescription)
				}
			} else if (parsed.candidate) {
				const candidate = new RTCIceCandidate(parsed)
				if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
					await this.pc.addIceCandidate(candidate)
				} else {
					this.queuedCandidates.push(parsed)
				}
			}
		} catch (err) {
			console.error('[calls] failed to handle signal', err)
		}
	}

	// ─── Call control verbs (relayed to participants by the server) ──

	mute(): void {
		const track = this.localStream?.getAudioTracks()[0]
		if (track) track.enabled = false
		useCallsStore.getState().setMic(false)
		sendAction('mute', {})
	}

	unmute(): void {
		const track = this.localStream?.getAudioTracks()[0]
		if (track) track.enabled = true
		useCallsStore.getState().setMic(true)
		sendAction('unmute', {})
	}

	async startVideo(): Promise<void> {
		let track = this.localStream?.getVideoTracks()[0]
		if (!track) {
			// Re-acquire the camera (it wasn't opened at join time).
			const cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
			track = cam.getVideoTracks()[0]
			if (!this.localStream) this.localStream = new MediaStream()
			this.localStream.addTrack(track)
		}
		if (this.videoSender) {
			await this.videoSender.replaceTrack(track)
		} else if (this.pc) {
			const t = this.pc.addTransceiver(track, { direction: 'sendonly', sendEncodings: CAMERA_ENCODING })
			this.videoSender = t.sender
		}
		useCallsStore.getState().setCamera(true)
		// The SFU records the stream id to label the forwarded track.
		sendAction('video_on', { data: JSON.stringify({ videoStreamID: this.localStream?.id ?? track.id }) })
	}

	stopVideo(): void {
		const track = this.localStream?.getVideoTracks()[0]
		if (track) track.enabled = false
		// Keep the sender (replaceTrack(null)) to avoid renegotiation.
		this.videoSender?.replaceTrack(null).catch(() => void 0)
		useCallsStore.getState().setCamera(false)
		sendAction('video_off', {})
	}

	async startScreenShare(): Promise<void> {
		const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
		this.screenStream = stream
		const track = stream.getVideoTracks()[0]
		if (this.pc) {
			if (this.screenSender) {
				await this.screenSender.replaceTrack(track)
			} else {
				const t = this.pc.addTransceiver(track, { direction: 'sendonly', sendEncodings: SCREEN_ENCODINGS })
				this.screenSender = t.sender
			}
		}
		useCallsStore.getState().setScreenSharing(true)
		sendAction('screen_on', { data: JSON.stringify({ screenStreamID: stream.id }) })
		// Auto-stop when the user ends sharing via the browser UI.
		track.addEventListener('ended', () => this.stopScreenShare())
	}

	stopScreenShare(): void {
		const track = this.screenStream?.getVideoTracks()[0]
		if (track) track.stop()
		this.screenSender?.replaceTrack(null).catch(() => void 0)
		this.screenSender = null
		this.screenStream = null
		useCallsStore.getState().setScreenSharing(false)
		sendAction('screen_off', {})
	}

	raiseHand(): void {
		useCallsStore.getState().toggleHand()
		sendAction('raise_hand', {})
	}

	lowerHand(): void {
		useCallsStore.getState().toggleHand()
		sendAction('unraise_hand', {})
	}

	/** Request a fresh full-state snapshot (e.g. after a missed event). */
	requestCallState(): void {
		if (this.channelId) sendAction('call_state', { channelID: this.channelId })
	}
}

/** Singleton client, like the plugin webapp's window.callsClient. */
export const callsClient = new CallsClient()

export type { CallSession } from './calls-store'
