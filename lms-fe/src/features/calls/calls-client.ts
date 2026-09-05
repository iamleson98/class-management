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
import { toast } from '@/hooks/use-toast'
import { useCallsStore, type CallDevice } from './calls-store'
import { RTCQualityMonitor, type QualitySample } from './calls-quality'
import { playCallSound } from './calls-sounds'

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

// ─── Error sentinels (plugin parity: consumed by the error modal) ────

export const AudioInputPermissionsError = new Error('missing audio input permissions')
export const AudioInputMissingError = new Error('no audio input available')
export const VideoInputPermissionsError = new Error('missing video input permissions')
export const VideoInputMissingError = new Error('no video input available')
export const rtcPeerTimeoutErr = new Error('timed out waiting for rtc connection')
export const rtcPeerCloseErr = new Error('rtc peer close')
export const insecureContextErr = new Error('insecure context')

/** sessionStorage key for the last call's client stats (/call stats). */
const LS_CLIENT_STATS = 'calls_client_stats'

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

	// RTC failure watchdogs.
	private connectTimer: number | null = null
	private failTimer: number | null = null
	private joinedAt = 0
	private reportedICEState = ''

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

		// isSecureContext === false (explicitly) marks http:// pages; some
		// embedded runtimes (jsdom) leave it undefined and are trusted.
		if (typeof window !== 'undefined' && window.isSecureContext === false) {
			this.connecting = false
			useCallsStore.getState().setError({ message: insecureContextErr.message, kind: 'insecure-context' })
			return
		}

		try {
			// Acquire local media BEFORE joining so the very first offer
			// carries the tracks (the SFU keys tracks by session id).
			await this.initLocalMedia(opts.enableVideo ?? false)
		} catch (err) {
			// Media failure is non-fatal: join voice-only with an alert
			// banner; devices can be enabled later from the widget.
			this.mediaFailed('audio', err)
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
		this.joinedAt = Date.now()

		this.startConnectTimeout()
		this.startQualityMonitor()
	}

	/** Abort the join when the RTC connection never establishes (plugin parity). */
	private startConnectTimeout(): void {
		this.clearConnectTimeout()
		this.connectTimer = window.setTimeout(() => {
			if (this.pc && this.pc.connectionState !== 'connected' && this.joined) {
				this.disconnect(rtcPeerTimeoutErr, 'rtc-timeout')
			}
		}, 30_000)
	}

	private clearConnectTimeout(): void {
		if (this.connectTimer !== null) {
			window.clearTimeout(this.connectTimer)
			this.connectTimer = null
		}
	}

	private clearFailTimer(): void {
		if (this.failTimer !== null) {
			window.clearTimeout(this.failTimer)
			this.failTimer = null
		}
	}

	/**
	 * Fatal teardown: leave the call and surface the error modal. Used for
	 * RTC timeouts and unrecoverable peer failures.
	 */
	private disconnect(err: Error, kind: 'rtc-timeout' | 'rtc-failed'): void {
		this.leave()
		useCallsStore.getState().setError({ message: err.message, kind })
	}

	/** Leave the current call and release all resources. */
	leave(): void {
		const wasJoined = this.joined
		if (this.channelId) {
			sendAction('leave', { channelID: this.channelId })
		}
		void this.persistStatsSnapshot()
		this.teardown()
		useCallsStore.getState().reset()
		if (wasJoined) playCallSound('leave_self')
	}

	/** Persist a client stats snapshot for post-call diagnostics (/call stats). */
	private async persistStatsSnapshot(): Promise<void> {
		const pc = this.pc
		if (!pc || !this.joinedAt) return
		try {
			const stats = await pc.getStats()
			let rtt: number | null = null
			let jitter: number | null = null
			let loss: number | null = null
			stats.forEach((report) => {
				const r = report as unknown as Record<string, unknown>
				if (r.type === 'candidate-pair' && (r.selected === true || r.nominated === true)) {
					if (typeof r.currentRoundTripTime === 'number') rtt = r.currentRoundTripTime * 1000
				}
				if (r.type === 'inbound-rtp') {
					if (typeof r.jitter === 'number') jitter = r.jitter * 1000
					const lost = (r.packetsLost as number | undefined) ?? 0
					const recv = (r.packetsReceived as number | undefined) ?? 0
					if (recv + lost > 0) loss = lost / (recv + lost)
				}
			})
			const snapshot = {
				at: Date.now(),
				durationMs: Date.now() - this.joinedAt,
				rtt,
				jitter,
				loss,
				quality: useCallsStore.getState().quality,
			}
			sessionStorage.setItem(LS_CLIENT_STATS, JSON.stringify(snapshot))
		} catch {
			// stats are best-effort diagnostics
		}
	}

	/** Read the last call's stats snapshot (for /call stats). */
	readStatsSnapshot(): string | null {
		try {
			return sessionStorage.getItem(LS_CLIENT_STATS)
		} catch {
			return null
		}
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
		this.clearConnectTimeout()
		this.clearFailTimer()
		this.reportedICEState = ''
		this.joinedAt = 0
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
		// Plugin parity: 640x360@30 ideal keeps CPU/bandwidth sane on
		// classroom hardware (DefaultVideoTrackOptions).
		const quality = { frameRate: { ideal: 30 }, width: { ideal: 640 }, height: { ideal: 360 } }
		if (deviceId) return { ...quality, facingMode: 'user', deviceId: { exact: deviceId } }
		return { ...quality, facingMode: 'user' }
	}

	/**
	 * Classify one getUserMedia failure for the RIGHT alert banner kind
	 * (audio vs video, missing vs permission). Returns whether the failure
	 * says the device itself is missing — the caller decides whether that
	 * merits the user-facing missing-devices toast (initLocalMedia fires it
	 * once per join, naming what is actually absent).
	 */
	private mediaFailed(kind: 'audio' | 'video', err: unknown): boolean {
		const name = (err as { name?: string })?.name ?? ''
		const msg = String((err as Error)?.message ?? '')
		const notFound =
			name === 'NotFoundError' ||
			name === 'DevicesNotFoundError' ||
			/not found|no camera|no microphone|unrecoverable/i.test(msg)
		const permission = name === 'NotAllowedError' || /permission|denied/i.test(msg)
		if (kind === 'audio') {
			useCallsStore.getState().addAlert({
				kind: permission ? 'audio-input-permissions' : 'audio-input-missing',
			})
		} else {
			useCallsStore.getState().addAlert({
				kind: permission ? 'video-input-permissions' : 'video-input-missing',
			})
		}
		console.warn(
			`[calls] failed to acquire ${kind} ${notFound ? '(device missing)' : permission ? '(permission denied)' : ''}`,
			err,
		)
		return notFound
	}

	/** Report which capture devices are actually absent via a toast. */
	private async toastMissingDevices(): Promise<void> {
		let micMissing = true
		let camMissing = true
		try {
			const list = await navigator.mediaDevices?.enumerateDevices?.()
			micMissing = !(list ?? []).some((d) => d.kind === 'audioinput')
			camMissing = !(list ?? []).some((d) => d.kind === 'videoinput')
		} catch {
			// enumerateDevices blocked (no permission yet): keep both flags
		}
		const en = (() => {
			try {
				return localStorage.getItem('vmg-lang') === 'en'
			} catch {
				return false
			}
		})()
		const both = micMissing && camMissing
		const title = en
			? both ? 'No microphone or camera found' : micMissing ? 'No microphone found' : 'No camera found'
			: both ? 'Không tìm thấy micro và camera' : micMissing ? 'Không tìm thấy micro' : 'Không tìm thấy camera'
		const description = en
			? 'Your computer does not have these devices. The call continues in listen-only mode.'
			: 'Máy tính của bạn không có các thiết bị này. Cuộc gọi sẽ tiếp tục ở chế độ chỉ nghe.'
		toast({ title, description, variant: 'destructive' })
	}

	private async initLocalMedia(enableVideo: boolean): Promise<void> {
		// Acquire the mic and the camera INDEPENDENTLY: a single
		// getUserMedia({audio, video}) fails wholesale when either device is
		// missing, taking a working mic down with a missing camera. Each failure
		// degrades that one track only and shows the right banner; a missing
		// device additionally fires the user-facing summary toast.
		const missing: Array<'audio' | 'video'> = []
		const tracks: MediaStreamTrack[] = []

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: this.audioConstraints() })
			tracks.push(...stream.getAudioTracks())
		} catch (err) {
			if (this.mediaFailed('audio', err)) missing.push('audio')
		}

		if (enableVideo) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ video: this.videoConstraints() })
				tracks.push(...stream.getVideoTracks())
			} catch (err) {
				if (this.mediaFailed('video', err)) missing.push('video')
			}
		}

		// Surface missing hardware as a toast (not only the in-call banners):
		// the user learns immediately WHY nobody can hear/see them.
		if (missing.length > 0) void this.toastMissingDevices()

		this.localStream = tracks.length > 0 ? new MediaStream(tracks) : null
		const store = useCallsStore.getState()
		const mic = this.localStream?.getAudioTracks()[0]
		const cam = this.localStream?.getVideoTracks()[0]
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

	/** Resolve a stored selection against the device list by id OR label. */
	private resolveStoredDevice(stored: CallDevice | null, devices: CallDevice[]): CallDevice | null {
		if (!stored) return null
		if (devices.some((d) => d.deviceId === stored.deviceId)) return stored
		// Browsers rotate device ids (e.g. per-origin): fall back to a
		// unique label match like the plugin's getSelectedAudioDevice.
		if (stored.label) {
			const byLabel = devices.filter((d) => d.label === stored.label)
			if (byLabel.length === 1) return byLabel[0]
		}
		return null
	}

	/**
	 * Device fallback (plugin parity): when the selected device vanished
	 * (unplugged), fall back to the first available one (with an alert
	 * banner); when the stored selection returns, switch back to it.
	 * Covers audio input, video input AND audio output.
	 */
	private handleDeviceFallback(): void {
		const store = useCallsStore.getState()
		const { audioInputs, audioOutputs, videoInputs } = store.devices

		const apply = (kind: 'audioInput' | 'videoInput', devices: CallDevice[], lsKey: string) => {
			const selected = store.selectedDevices[kind]
			if (!selected) return
			if (devices.some((d) => d.deviceId === selected)) return
			// Selected device vanished: fall back to the first available.
			const fallback = devices[0]
			if (fallback) {
				useCallsStore.getState().addAlert({
					kind: kind === 'audioInput' ? 'audio-input-fallback' : 'video-input-permissions',
					deviceLabel: fallback.label,
				})
				if (kind === 'audioInput') void this.setAudioInputDevice(fallback, false)
				else void this.setVideoInputDevice(fallback)
			} else {
				useCallsStore.getState().addAlert({
					kind: kind === 'audioInput' ? 'audio-input-missing' : 'video-input-missing',
				})
				store.setSelectedDevice(kind, '')
			}
		}
		apply('audioInput', audioInputs, LS_AUDIO_INPUT)
		apply('videoInput', videoInputs, LS_VIDEO_INPUT)

		// Output fallback: the selected speaker vanished → system default.
		const selectedOut = store.selectedDevices.audioOutput
		if (selectedOut && !audioOutputs.some((d) => d.deviceId === selectedOut)) {
			const fallbackOut = audioOutputs[0]
			useCallsStore.getState().addAlert({
				kind: 'audio-output-fallback',
				deviceLabel: fallbackOut?.label ?? '',
			})
			if (fallbackOut) void this.setAudioOutputDevice(fallbackOut, false)
			else store.setSelectedDevice('audioOutput', '')
		}

		// Return-to-preference: stored selection exists again → switch back.
		const storedAudio = this.resolveStoredDevice(readStoredDevice(LS_AUDIO_INPUT), audioInputs)
		if (
			storedAudio &&
			storedAudio.deviceId !== store.selectedDevices.audioInput &&
			!store.selectedDevices.audioInput
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
			this.clearConnectTimeout()
			this.clearFailTimer()
			store.setStatus('connected')
			void this.sendICEPairMetric('succeeded')
		} else if (state === 'disconnected') {
			// The websocket path is still alive; only the media path
			// dropped — transient (WiFi blip). ICE restart on failure below.
			if (this.joined) store.setStatus('reconnecting')
		} else if (state === 'failed') {
			if (!this.joined) return
			store.setStatus('reconnecting')
			this.pc?.restartIce()
			// Grace period: if ICE restart doesn't recover the media
			// path, tear the call down with the rtc-failed modal.
			this.clearFailTimer()
			this.failTimer = window.setTimeout(() => {
				if (this.joined && this.pc && this.pc.connectionState !== 'connected') {
					this.disconnect(rtcPeerCloseErr, 'rtc-failed')
				}
			}, 10_000)
		} else if (state === 'closed') {
			if (this.joined) this.disconnect(rtcPeerCloseErr, 'rtc-failed')
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

	/**
	 * Report an ICE candidate-pair metric to the server (diagnostics). Reads
	 * the REAL selected pair + candidate types from getStats, one report per
	 * state transition (plugin parity: collectICEStats transitions).
	 */
	private async sendICEPairMetric(state: string): Promise<void> {
		if (!this.joined || !this.pc || this.reportedICEState === state) return
		this.reportedICEState = state
		try {
			let localType = 'unknown'
			let remoteType = 'unknown'
			const stats = await this.pc.getStats()
			let localId = ''
			let remoteId = ''
			stats.forEach((report) => {
				const r = report as unknown as Record<string, unknown>
				if (r.type === 'candidate-pair' && (r.selected === true || (r.nominated === true && r.state === 'succeeded'))) {
					localId = String(r.localCandidateId ?? '')
					remoteId = String(r.remoteCandidateId ?? '')
				}
			})
			if (localId || remoteId) {
				stats.forEach((report) => {
					const r = report as unknown as Record<string, unknown>
					if (r.id === localId) localType = String(r.candidateType ?? 'unknown')
					if (r.id === remoteId) remoteType = String(r.candidateType ?? 'unknown')
				})
			}
			sendAction('metric', {
				data: JSON.stringify({
					metric_name: 'client_ice_candidate_pair',
					data: JSON.stringify({ state, local: { type: localType }, remote: { type: remoteType } }),
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
		// Detach the track so RTP actually stops (plugin parity): the SFU
		// keeps the m-line, bandwidth drops, and VAD goes quiet.
		this.audioSender?.replaceTrack(null).catch(() => void 0)
		useCallsStore.getState().setMic(false)
		sendAction('mute', {})
	}

	unmute(): void {
		const track = this.localStream?.getAudioTracks()[0]
		if (track) {
			track.enabled = true
			this.audioSender?.replaceTrack(track).catch(() => void 0)
		} else {
			// The mic vanished mid-call (hotplug): re-acquire it.
			void this.reinitAudioTrack()
			return
		}
		useCallsStore.getState().setMic(true)
		this.qualityMonitor?.resetDeltas()
		sendAction('unmute', {})
	}

	/** Re-acquire the microphone after the device disappeared mid-call. */
	private async reinitAudioTrack(): Promise<void> {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: this.audioConstraints() })
			const track = stream.getAudioTracks()[0]
			if (!track) throw AudioInputMissingError
			if (!this.localStream) this.localStream = new MediaStream()
			this.localStream.addTrack(track)
			if (this.audioSender) await this.audioSender.replaceTrack(track)
			else if (this.pc) this.audioSender = this.pc.addTrack(track, this.localStream)
			useCallsStore.getState().setMic(true)
			this.qualityMonitor?.resetDeltas()
			sendAction('unmute', {})
		} catch (err) {
			useCallsStore.getState().addAlert({ kind: 'audio-input-missing' })
			console.warn('[calls] failed to re-acquire audio input', err)
		}
	}

	/** Push-to-talk: temporarily unmute while held (no presence broadcast). */
	pushToTalk(down: boolean): void {
		const track = this.localStream?.getAudioTracks()[0]
		if (!track) return
		// Only meaningful while muted.
		if (down && !useCallsStore.getState().micEnabled) {
			track.enabled = true
			this.audioSender?.replaceTrack(track).catch(() => void 0)
		} else if (!down && !useCallsStore.getState().micEnabled) {
			track.enabled = false
			this.audioSender?.replaceTrack(null).catch(() => void 0)
		}
	}

	async startVideo(): Promise<void> {
		let track = this.localStream?.getVideoTracks()[0]
		if (!track || !track.enabled === false || track.readyState === 'ended') {
			// (Re-)acquire the camera: it was either never opened or has
			// since been stopped/released.
			const cam = await navigator.mediaDevices.getUserMedia({ video: this.videoConstraints() })
			track = cam.getVideoTracks()[0]
			if (!track) throw VideoInputMissingError
			const old = this.localStream?.getVideoTracks()[0]
			if (old) {
				old.stop()
				this.localStream?.removeTrack(old)
			}
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
		this.qualityMonitor?.resetDeltas()
		// The SFU records the stream id to label the forwarded track.
		sendAction('video_on', { data: JSON.stringify({ videoStreamID: this.localStream?.id ?? track.id }) })
	}

	stopVideo(): void {
		const track = this.localStream?.getVideoTracks()[0]
		// Actually stop the track so the camera hardware releases (the
		// in-use LED goes off — MM-68796) and startVideo re-acquires.
		if (track) {
			track.stop()
			this.localStream?.removeTrack(track)
		}
		// Keep the sender (replaceTrack(null)) to avoid renegotiation.
		this.videoSender?.replaceTrack(null).catch(() => void 0)
		useCallsStore.getState().setCamera(false)
		sendAction('video_off', {})
	}

	async startScreenShare(): Promise<void> {
		const withAudio = shareAudioWithScreen()
		let stream: MediaStream
		try {
			stream = await navigator.mediaDevices.getDisplayMedia({
				video: true,
				audio: withAudio,
			})
		} catch (err) {
			// Cancelled picker or denied permission: surface the
			// missingScreenPermissions alert (plugin parity).
			const name = (err as { name?: string })?.name ?? ''
			if (name === 'NotAllowedError') {
				useCallsStore.getState().addAlert({ kind: 'screen-permissions' })
			}
			throw err
		}
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
