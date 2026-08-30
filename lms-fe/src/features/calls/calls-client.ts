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
 * Device management (ports the plugin client):
 *   - enumerateDevices lists + devicechange hotplug handling with automatic
 *     fallback when the selected device disappears (and back when it returns)
 *   - setAudioInputDevice / setVideoInputDevice re-acquire and replaceTrack
 *   - setAudioOutputDevice applies setSinkId on every detached audio element
 *   - selections persist to localStorage (calls_default_*_input/output)
 *
 * The RTCPeerConnection lives on this singleton (NOT in the zustand store) so
 * media renegotiation never triggers React re-renders. Negotiation follows the
 * "polite peer" perfect-negotiation pattern with ICE candidate queuing, and
 * senders are reused (replaceTrack) for mute/video toggles to avoid
 * renegotiation — the SFU requires stable track/stream ids, so tracks are
 * never stopped/re-added mid-call.
 */

import { wsClient } from '@/lib/chat/client'
import { useCallsStore, type CallDevice } from './calls-store'
import { RTCQualityMonitor, type QualitySample } from './calls-quality'

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

/** Default audio processing constraints (plugin parity). */
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
	echoCancellation: true,
	noiseSuppression: true,
	autoGainControl: true,
}

// localStorage keys (plugin parity).
const LS_AUDIO_INPUT = 'calls_default_audio_input'
const LS_AUDIO_OUTPUT = 'calls_default_audio_output'
const LS_VIDEO_INPUT = 'calls_default_video_input'
const LS_SHARE_AUDIO = 'calls_share_audio_with_screen'

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

/** Persisted device selection: {deviceId, label} JSON, or raw deviceId. */
function readStoredDevice(key: string): CallDevice | null {
	try {
		const raw = localStorage.getItem(key)
		if (!raw) return null
		try {
			const parsed = JSON.parse(raw) as CallDevice
			if (parsed?.deviceId) return parsed
		} catch {
			// legacy raw id
		}
		return { deviceId: raw, label: '' }
	} catch {
		return null
	}
}

function storeDevice(key: string, device: CallDevice | null): void {
	try {
		if (device) localStorage.setItem(key, JSON.stringify(device))
		else localStorage.removeItem(key)
	} catch {
		// storage unavailable (private mode) — selection stays in-memory only
	}
}

/** Whether to share system audio when screen sharing (default true). */
export function shareAudioWithScreen(): boolean {
	try {
		return localStorage.getItem(LS_SHARE_AUDIO) !== 'off'
	} catch {
		return true
	}
}

export function setShareAudioWithScreen(on: boolean): void {
	try {
		localStorage.setItem(LS_SHARE_AUDIO, on ? 'on' : 'off')
	} catch {
		/* ignore */
	}
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
	// Honor the selected speaker device.
	const sink = useCallsStore.getState().selectedDevices.audioOutput
	applySinkId(el, sink)
	audioEls.set(track.id, el)
	// Stop the element when the track ends (SFU teardown).
	track.addEventListener('ended', () => detachAudio(track.id))
}

/** Apply an output device to one audio element when supported. */
function applySinkId(el: HTMLAudioElement, deviceId: string): void {
	if (!deviceId) return
	const anyEl = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
	if (typeof anyEl.setSinkId === 'function') {
		anyEl.setSinkId(deviceId).catch(() => void 0)
	}
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
	/** Screen-share audio track (system audio), when shared. */
	private screenAudioTrack: MediaStreamTrack | null = null

	/** My stable session id (== the connID from the join ack). */
	private sessionId = ''
	private channelId = ''
	/** ICE servers delivered with the join ack. */
	private iceServers: RTCIceServer[] = []

	/** Track senders kept alive for replaceTrack toggles. */
	private videoSender: RTCRtpSender | null = null
	private screenSender: RTCRtpSender | null = null
	private screenAudioSender: RTCRtpSender | null = null
	private audioSender: RTCRtpSender | null = null

	// Perfect-negotiation state (polite peer).
	private makingOffer = false
	private ignoreOffer = false
	private isSettingRemoteAnswerPending = false
	private queuedCandidates: RTCIceCandidateInit[] = []

	private joined = false
	private connecting = false

	// Device hotplug + quality monitoring.
	private devicesBound = false
	private qualityMonitor: RTCQualityMonitor | null = null
	private lastQualityAlertAt = 0
	private unloadBound = false

	// ─── Lifecycle ──────────────────────────────────────────────────

	/** Expose the local camera stream for the self-preview <video>. */
	getLocalStream(): MediaStream | null {
		return this.localStream
	}

	/** My session id (empty before the join ack). */
	getMySessionId(): string {
		return this.sessionId
	}

	/** The RTCPeerConnection (for stats/quality monitors). */
	getPeerConnection(): RTCPeerConnection | null {
		return this.pc
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

		this.bindDeviceListener()
		this.bindBeforeUnload()

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

		this.startQualityMonitor()
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
		this.stopQualityMonitor()
		this.localStream?.getTracks().forEach((t) => t.stop())
		this.screenStream?.getTracks().forEach((t) => t.stop())
		this.screenAudioTrack?.stop()
		this.localStream = null
		this.screenStream = null
		this.screenAudioTrack = null
		this.videoSender = null
		this.screenSender = null
		this.screenAudioSender = null
		this.audioSender = null
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

	/** Audio getUserMedia constraints honoring the selected input device. */
	private audioConstraints(): MediaTrackConstraints | boolean {
		const deviceId = useCallsStore.getState().selectedDevices.audioInput
		if (deviceId) return { ...AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } }
		return AUDIO_CONSTRAINTS
	}

	/** Video getUserMedia constraints honoring the selected camera. */
	private videoConstraints(): MediaTrackConstraints {
		const deviceId = useCallsStore.getState().selectedDevices.videoInput
		if (deviceId) return { facingMode: 'user', deviceId: { exact: deviceId } }
		return { facingMode: 'user' }
	}

	private async initLocalMedia(enableVideo: boolean): Promise<void> {
		this.localStream = await navigator.mediaDevices.getUserMedia({
			audio: this.audioConstraints(),
			video: enableVideo ? this.videoConstraints() : false,
		})
		const store = useCallsStore.getState()
		const mic = this.localStream.getAudioTracks()[0]
		const cam = this.localStream.getVideoTracks()[0]
		store.setMic(!!mic && mic.enabled)
		store.setCamera(!!cam)
		// Device labels become available after the first getUserMedia.
		void this.updateDevices()
	}

	// ─── Device management (hotplug, pickers) ───────────────────────

	/** Enumerate media devices into the store lists. */
	async updateDevices(): Promise<void> {
		if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
		try {
			const list = await navigator.mediaDevices.enumerateDevices()
			const label = (d: MediaDeviceInfo, idx: number, kind: string): CallDevice => ({
				deviceId: d.deviceId,
				label: d.label || `${kind} ${idx + 1}`,
			})
			const audioInputs = list.filter((d) => d.kind === 'audioinput').map((d, i) => label(d, i, 'Microphone'))
			const audioOutputs = list.filter((d) => d.kind === 'audiooutput').map((d, i) => label(d, i, 'Speaker'))
			const videoInputs = list.filter((d) => d.kind === 'videoinput').map((d, i) => label(d, i, 'Camera'))
			useCallsStore.getState().setDevices({ audioInputs, audioOutputs, videoInputs })
			this.handleDeviceFallback()
		} catch {
			// permissions denied — pickers show empty lists
		}
	}

	/**
	 * Device fallback (plugin parity): when the selected input device vanished
	 * (unplugged), fall back to the first available one; when the stored
	 * selection returns, switch back to it.
	 */
	private handleDeviceFallback(): void {
		const store = useCallsStore.getState()
		const { audioInputs, videoInputs } = store.devices

		const apply = (kind: 'audioInput' | 'videoInput', devices: CallDevice[], lsKey: string) => {
			const selected = store.selectedDevices[kind]
			if (!selected) return
			const stillThere = devices.some((d) => d.deviceId === selected)
			if (stillThere) return
			// Selected device vanished: fall back to the first available.
			const fallback = devices[0]
			if (fallback) {
				store.setSelectedDevice(kind, fallback.deviceId)
				if (kind === 'audioInput') void this.setAudioInputDevice(fallback, false)
				else void this.setVideoInputDevice(fallback)
			} else {
				store.setSelectedDevice(kind, '')
			}
			// Remember the stored selection so we can return to it on hotplug.
			const stored = readStoredDevice(lsKey)
			if (stored && !devices.some((d) => d.deviceId === stored.deviceId)) {
				// keep the persisted preference for the return-switch below
			}
			return
		}
		apply('audioInput', audioInputs, LS_AUDIO_INPUT)
		apply('videoInput', videoInputs, LS_VIDEO_INPUT)

		// Return-to-preference: stored selection exists again → switch back.
		const storedAudio = readStoredDevice(LS_AUDIO_INPUT)
		if (
			storedAudio &&
			audioInputs.some((d) => d.deviceId === storedAudio.deviceId) &&
			store.selectedDevices.audioInput !== storedAudio.deviceId
		) {
			void this.setAudioInputDevice(storedAudio, false)
		}
	}

	/** Bind the devicechange hotplug listener once. */
	private bindDeviceListener(): void {
		if (this.devicesBound || typeof navigator === 'undefined' || !navigator.mediaDevices) return
		navigator.mediaDevices.addEventListener?.('devicechange', () => {
			void this.updateDevices()
		})
		this.devicesBound = true
	}

	/** Leave the call when the tab closes (plugin's beforeunload parity). */
	private bindBeforeUnload(): void {
		if (this.unloadBound || typeof window === 'undefined') return
		window.addEventListener('beforeunload', () => {
			if (this.joined) this.leave()
		})
		this.unloadBound = true
	}

	/** Switch the microphone input device. */
	async setAudioInputDevice(device: CallDevice, persist = true): Promise<void> {
		if (persist) storeDevice(LS_AUDIO_INPUT, device)
		useCallsStore.getState().setSelectedDevice('audioInput', device.deviceId)
		if (!this.joined) return
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { ...AUDIO_CONSTRAINTS, deviceId: { exact: device.deviceId } },
			})
			const track = stream.getAudioTracks()[0]
			if (!track) return
			const old = this.localStream?.getAudioTracks()[0]
			const wasEnabled = old ? old.enabled : useCallsStore.getState().micEnabled
			track.enabled = wasEnabled
			if (this.audioSender) {
				await this.audioSender.replaceTrack(track)
			} else if (this.pc && this.localStream) {
				this.audioSender = this.pc.addTrack(track, this.localStream)
			}
			if (old) {
				old.stop()
				this.localStream?.removeTrack(old)
			}
			this.localStream?.addTrack(track)
		} catch (err) {
			console.warn('[calls] failed to switch audio input device', err)
		}
	}

	/** Switch the camera device. */
	async setVideoInputDevice(device: CallDevice, persist = true): Promise<void> {
		if (persist) storeDevice(LS_VIDEO_INPUT, device)
		useCallsStore.getState().setSelectedDevice('videoInput', device.deviceId)
		if (!this.joined) return
		if (!useCallsStore.getState().cameraEnabled) return
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'user', deviceId: { exact: device.deviceId } },
			})
			const track = stream.getVideoTracks()[0]
			if (!track) return
			const old = this.localStream?.getVideoTracks()[0]
			if (this.videoSender) {
				await this.videoSender.replaceTrack(track)
			} else if (this.pc && this.localStream) {
				const t = this.pc.addTransceiver(track, {
					direction: 'sendonly',
					sendEncodings: CAMERA_ENCODING,
				})
				this.videoSender = t.sender
			}
			if (old) {
				old.stop()
				this.localStream?.removeTrack(old)
			}
			this.localStream?.addTrack(track)
		} catch (err) {
			console.warn('[calls] failed to switch video input device', err)
		}
	}

	/** Switch the speaker (audio output) device; applies to live audio elements. */
	async setAudioOutputDevice(device: CallDevice, persist = true): Promise<void> {
		if (persist) storeDevice(LS_AUDIO_OUTPUT, device)
		useCallsStore.getState().setSelectedDevice('audioOutput', device.deviceId)
		for (const el of audioEls.values()) applySinkId(el, device.deviceId)
	}

	/** Load persisted device selections into the store (app boot). */
	restoreDeviceSelections(): void {
		const store = useCallsStore.getState()
		const audioIn = readStoredDevice(LS_AUDIO_INPUT)
		const audioOut = readStoredDevice(LS_AUDIO_OUTPUT)
		const videoIn = readStoredDevice(LS_VIDEO_INPUT)
		if (audioIn) store.setSelectedDevice('audioInput', audioIn.deviceId)
		if (audioOut) store.setSelectedDevice('audioOutput', audioOut.deviceId)
		if (videoIn) store.setSelectedDevice('videoInput', videoIn.deviceId)
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
					this.audioSender = this.pc.addTrack(track, this.localStream)
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
			this.sendICEPairMetric('succeeded')
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

	/** Report an ICE candidate-pair metric to the server (diagnostics). */
	private sendICEPairMetric(state: string): void {
		if (!this.joined) return
		try {
			sendAction('metric', {
				data: JSON.stringify({
					metric_name: 'client_ice_candidate_pair',
					data: JSON.stringify({ state, local: { type: 'host' }, remote: { type: 'prflx' } }),
				}),
			})
		} catch {
			/* metrics are best-effort */
		}
	}

	// ─── Quality monitoring ─────────────────────────────────────────

	private startQualityMonitor(): void {
		this.stopQualityMonitor()
		this.qualityMonitor = new RTCQualityMonitor(() => this.pc, (sample: QualitySample) => {
			const store = useCallsStore.getState()
			store.setQuality(sample.quality)
			if (sample.quality === 'poor') {
				// Re-armable banner (plugin: 20s lock).
				if (Date.now() - this.lastQualityAlertAt > 20_000) {
					this.lastQualityAlertAt = Date.now()
					store.setQualityAlert(true)
				}
			} else {
				store.setQualityAlert(false)
			}
		})
		this.qualityMonitor.start()
	}

	private stopQualityMonitor(): void {
		this.qualityMonitor?.stop()
		this.qualityMonitor = null
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

	/** Push-to-talk: temporarily unmute while held (no presence broadcast). */
	pushToTalk(down: boolean): void {
		const track = this.localStream?.getAudioTracks()[0]
		if (!track) return
		// Only meaningful while muted.
		if (down && !useCallsStore.getState().micEnabled) {
			track.enabled = true
		} else if (!down && !useCallsStore.getState().micEnabled) {
			track.enabled = false
		}
	}

	async startVideo(): Promise<void> {
		let track = this.localStream?.getVideoTracks()[0]
		if (!track) {
			// Re-acquire the camera (it wasn't opened at join time).
			const cam = await navigator.mediaDevices.getUserMedia({ video: this.videoConstraints() })
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
		const withAudio = shareAudioWithScreen()
		const stream = await navigator.mediaDevices.getDisplayMedia({
			video: true,
			audio: withAudio,
		})
		this.screenStream = stream
		const track = stream.getVideoTracks()[0]
		if (this.pc) {
			if (this.screenSender) {
				await this.screenSender.replaceTrack(track)
			} else {
				const t = this.pc.addTransceiver(track, { direction: 'sendonly', sendEncodings: SCREEN_ENCODINGS })
				this.screenSender = t.sender
			}

			// System audio rides as a separate screen-audio track.
			const audioTrack = stream.getAudioTracks()[0]
			if (audioTrack) {
				this.screenAudioTrack = audioTrack
				if (this.screenAudioSender) {
					await this.screenAudioSender.replaceTrack(audioTrack)
				} else {
					this.screenAudioSender = this.pc.addTrack(audioTrack, stream)
				}
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
		this.screenAudioSender?.replaceTrack(null).catch(() => void 0)
		this.screenSender = null
		this.screenAudioSender = null
		this.screenAudioTrack?.stop()
		this.screenAudioTrack = null
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

	/** Send an in-call emoji reaction (broadcast as user_reacted). */
	sendReaction(emoji: { name: string; literal: string; unified?: string }): void {
		sendAction('react', {
			data: JSON.stringify({
				name: emoji.name,
				unified: emoji.unified ?? '',
				literal: emoji.literal,
			}),
		})
	}

	/** Request a fresh full-state snapshot (e.g. after a missed event). */
	requestCallState(): void {
		if (this.channelId) sendAction('call_state', { channelID: this.channelId })
	}
}

/** Singleton client, like the plugin webapp's window.callsClient. */
export const callsClient = new CallsClient()

export type { CallSession } from './calls-store'
