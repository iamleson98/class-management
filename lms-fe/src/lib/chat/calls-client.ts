/**
 * CallsClient — the WebRTC + signaling engine for the LMS chat call feature.
 *
 * Architecture (ports the Mattermost Calls plugin webapp client.ts +
 * @mattermost/calls-common rtc_peer.ts):
 *
 *   browser ──RTCPeerConnection──▶ rtcd SFU   (media: audio/video/screen)
 *   browser ──existing wsClient──▶  server     (signaling: SDP/ICE + verbs)
 *                  └── WS ──▶ rtcd            (server relays signaling to SFU)
 *
 * Signaling rides the SAME authenticated WebSocket the chat already uses
 * (lib/chat/client.ts wsClient) — actions are namespaced `custom_calls_*` and
 * the server's calls module forwards them to rtcd. This avoids a second socket
 * and reuses the cookie-based auth the chat already establishes.
 *
 * The RTCPeerConnection lives on this singleton (NOT in the zustand store) so
 * media renegotiation never triggers React re-renders. The store is updated
 * only for UI-relevant state (sessions, mute, voice, video).
 *
 * Negotiation is "polite" perfect-negotiation with ICE candidate queuing, and
 * senders are reused (replaceTrack(null)) for mute/video-off to avoid
 * renegotiation — matching the plugin's proven approach.
 */

import { wsClient } from './client'
import { useCallsStore, type CallSession } from './calls-store'

// ─── Constants ──────────────────────────────────────────────────────

/** Action prefix on the shared WS. The server dispatch strips this. */
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

// ─── CallsClient ────────────────────────────────────────────────────

class CallsClient {
	private pc: RTCPeerConnection | null = null
	private localStream: MediaStream | null = null
	private screenStream: MediaStream | null = null

	/** The stable session identity assigned by the server on join. */
	private sessionId = ''
	private channelId = ''
	/** Tracks the camera sender so video can toggle without renegotiation. */
	private videoSender: RTCRtpSender | null = null

	// Perfect-negotiation state.
	private makingOffer = false
	private ignoreOffer = false
	private isSettingRemoteAnswerPending = false
	private queuedCandidates: RTCIceCandidateInit[] = []

	private connected = false

	// ─── Lifecycle ──────────────────────────────────────────────────

	/** Expose the local camera stream for the self-preview <video>. */
	getLocalStream(): MediaStream | null {
		return this.localStream
	}

	/** Join (or start) a call in a channel. */
	async join(channelId: string, opts: { enableVideo?: boolean } = {}): Promise<void> {
		const store = useCallsStore.getState()
		store.reset()
		store.setChannel(channelId)
		store.setStatus('connecting')
		this.channelId = channelId

		try {
			// Acquire local media before joining so the offer carries tracks.
			await this.initLocalMedia(opts.enableVideo ?? false)
		} catch (err) {
			// Media failure is non-fatal — the user can join voice-only and
			// enable devices later from the widget.
			console.warn('[calls] failed to acquire local media, joining voice-only', err)
		}

		// Tell the server we want to join. The server assigns a sessionId,
		// returns ICE servers, and the join ack arrives as a WS event.
		sendAction('join', {
			channelID: channelId,
			av1Support: false,
			dcSignaling: false,
		})
	}

	/** Leave the current call and release all resources. */
	leave(): void {
		if (this.channelId) {
			sendAction('leave', { channelID: this.channelId })
		}
		this.teardown()
		useCallsStore.getState().reset()
	}

	/** Tear down the peer connection and media tracks. */
	private teardown(): void {
		this.pc?.getSenders().forEach((s) => {
			try {
				s.track?.stop()
			} catch {
				// ignore
			}
		})
		this.localStream?.getTracks().forEach((t) => t.stop())
		this.screenStream?.getTracks().forEach((t) => t.stop())
		this.localStream = null
		this.screenStream = null
		this.videoSender = null
		this.pc?.close()
		this.pc = null
		this.makingOffer = false
		this.ignoreOffer = false
		this.isSettingRemoteAnswerPending = false
		this.queuedCandidates = []
		this.connected = false
		this.sessionId = ''
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

	/** Build the RTCPeerConnection and wire its event handlers. */
	private async createPeerConnection(iceServers: RTCIceServer[]): Promise<void> {
		this.pc = new RTCPeerConnection({
			iceServers,
			// Bundle media on a single transport for efficiency.
			bundlePolicy: 'max-bundle',
		})

		// Add local tracks. Audio via addTrack; video via addTransceiver so we
		// can keep the sender alive across toggles (replaceTrack).
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
		}

		// A data channel bootstraps the connection even before tracks.
		const dc = this.pc.createDataChannel('calls-dc')
		dc.onopen = () => {
			// Connection is alive; nothing else needed from the DC for now.
		}

		this.pc.onnegotiationneeded = this.onNegotiationNeeded
		this.pc.onicecandidate = this.onICECandidate
		this.pc.oniceconnectionstatechange = this.onICEStateChange
		this.pc.onconnectionstatechange = this.onConnectionStateChange
		this.pc.ontrack = this.onTrack
	}

	private onNegotiationNeeded = async (): Promise<void> => {
		try {
			this.makingOffer = true
			await this.pc?.setLocalDescription()
			this.sendSDP(this.pc?.localDescription)
		} catch (err) {
			// If a glare collision occurs, the polite side yields.
			if (!(this.ignoreOffer || (this.pc?.signalingState !== 'stable' && !this.makingOffer))) {
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

	private onICEStateChange = (): void => {
		// Drained queued candidates once the remote description is set.
		if (this.pc?.iceConnectionState === 'connected' && this.queuedCandidates.length) {
			for (const c of this.queuedCandidates) {
				this.pc.addIceCandidate(c).catch(() => void 0)
			}
			this.queuedCandidates = []
		}
	}

	private onConnectionStateChange = (): void => {
		const state = this.pc?.connectionState
		if (state === 'connected') {
			this.connected = true
			useCallsStore.getState().setStatus('connected')
		} else if (state === 'disconnected') {
			useCallsStore.getState().setStatus('reconnecting')
		} else if (state === 'failed') {
			useCallsStore.getState().setStatus('reconnecting')
			this.pc?.restartIce()
		} else if (state === 'closed') {
			this.connected = false
		}
	}

	/** Inbound tracks from the SFU (one MediaStream per remote track). */
	private onTrack = (ev: RTCTrackEvent): void => {
		const stream = ev.streams[0] ?? new MediaStream([ev.track])
		const store = useCallsStore.getState()
		// Dispatch by kind into the store; the widget binds these to elements.
		if (ev.track.kind === 'audio') {
			store.upsertSession({
				...store.sessions[this.sessionId],
				sessionId: this.sessionId,
				userId: '',
				unmuted: true,
				raisedHand: 0,
				voice: false,
				screenOn: false,
				video: false,
			})
			// Attach to a detached <audio> element for playback.
			attachAudio(stream)
		}
		ev.track.onended = () => {
			// Track ended by the SFU; cleanup handled by session events.
		}
	}

	/** Send an SDP offer/answer to the server (relayed to rtcd). */
	private sendSDP(desc: RTCSessionDescriptionInit | undefined): void {
		if (!desc) return
		sendAction('sdp', { data: JSON.stringify(desc) })
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

				// Flush any candidates buffered before the description landed.
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

	// ─── Call control verbs (sent to server, fanned out to participants) ─

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
		if (!this.localStream) {
			this.localStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: { facingMode: 'user' },
			})
		}
		let track = this.localStream.getVideoTracks()[0]
		if (!track) {
			// Re-acquire camera if it was never opened.
			const cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
			track = cam.getVideoTracks()[0]
			this.localStream.addTrack(track)
		}
		if (this.videoSender) {
			await this.videoSender.replaceTrack(track)
		} else if (this.pc) {
			const t = this.pc.addTransceiver(track, { direction: 'sendonly', sendEncodings: CAMERA_ENCODING })
			this.videoSender = t.sender
		}
		useCallsStore.getState().setCamera(true)
		sendAction('video_on', { data: track.id })
	}

	stopVideo(): void {
		const track = this.localStream?.getVideoTracks()[0]
		if (track) track.enabled = false
		// Keep the sender alive (replaceTrack(null) path) to avoid renegotiation.
		this.videoSender?.replaceTrack(null)
		useCallsStore.getState().setCamera(false)
		sendAction('video_off', {})
	}

	async startScreenShare(): Promise<void> {
		const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
		this.screenStream = stream
		const track = stream.getVideoTracks()[0]
		if (this.pc) {
			this.pc.addTransceiver(track, { direction: 'sendonly', sendEncodings: SCREEN_ENCODINGS })
		}
		useCallsStore.getState().setScreenSharing(true)
		sendAction('screen_on', { data: track.id })
		// Auto-stop when the user ends sharing via the browser UI.
		track.onended = () => this.stopScreenShare()
	}

	stopScreenShare(): void {
		const track = this.screenStream?.getVideoTracks()[0]
		if (track) {
			track.stop()
			// removeTrack triggers renegotiation to drop the transceiver.
			const sender = this.pc?.getSenders().find((s) => s.track === track)
			if (sender && this.pc) this.pc.removeTrack(sender)
		}
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
}

// ─── Audio playback ─────────────────────────────────────────────────

/** Detached <audio> elements for remote voice tracks, one per stream. */
const audioEls = new Map<MediaStream, HTMLAudioElement>()

function attachAudio(stream: MediaStream): void {
	if (audioEls.has(stream)) return
	const el = document.createElement('audio')
	el.autoplay = true
	el.srcObject = stream
	document.body.appendChild(el)
	audioEls.set(stream, el)
}

function detachAudio(stream: MediaStream): void {
	const el = audioEls.get(stream)
	if (el) {
		el.srcObject = null
		el.remove()
		audioEls.delete(stream)
	}
}

/** Singleton client, like the plugin's window.callsClient. */
export const callsClient = new CallsClient()

export { detachAudio }
export type { CallSession }
