/**
 * Calls real-time store (Zustand).
 *
 * Holds the live state for the call in the active channel — the call itself,
 * the per-participant sessions, the local participant's connection status and
 * media flags, and the remote media streams rendered by the call widget.
 *
 * Mirrors the shape the Mattermost Calls webapp kept in Redux, scoped to a
 * single active call. Mutated by the calls client (calls-client.ts) and by
 * the WS event dispatcher (websocket-events.ts, custom_calls_* events).
 *
 * State ownership:
 *  - The RTCPeerConnection lives on the CallsClient singleton (NOT here) so
 *    media renegotiation never triggers React re-renders.
 *  - The store holds only what the UI must render: session list, media flags,
 *    remote MediaStreams (as refs the <video>/<audio> elements bind to), and
 *    connection status.
 */

import { create } from 'zustand'

// ─── Types ──────────────────────────────────────────────────────────

/** One participant's state in the active call. */
export interface CallSession {
	/** The connection id — the stable session identity across reconnects. */
	sessionId: string
	userId: string
	unmuted: boolean
	/** Unix-millis timestamp the hand was raised, or 0 when lowered. */
	raisedHand: number
	video: boolean
	/** Speaking indicator, toggled by VAD (voice_on/voice_off) events. */
	voice: boolean
	screenOn: boolean
}

/** Connection lifecycle for the local participant. */
export type CallConnectionStatus =
	| 'disconnected'
	| 'connecting' // opening the WS signaling path / awaiting join ack
	| 'joined' // join ack received, now negotiating WebRTC
	| 'connected' // the RTCPeerConnection reached 'connected'
	| 'reconnecting' // WS or RTC dropped, attempting recovery
	| 'error'

interface CallError {
	message: string
	code?: string
}

interface CallState {
	/** The channel id of the active call, or null when not in a call. */
	channelId: string | null
	/** The call id assigned by the server. */
	callId: string | null
	/** The rtcd host the call's media is routed through (for diagnostics). */
	rtcdHost: string | null
	/** Call start time (unix ms). */
	startAt: number | null
	/** The host user id of the call. */
	hostId: string | null
	/** Per-participant state keyed by session id. */
	sessions: Record<string, CallSession>
	/** Order of session ids for stable rendering (join order). */
	sessionOrder: string[]

	/** Local media flags. */
	micEnabled: boolean
	cameraEnabled: boolean
	screenSharing: boolean
	/** Whether the local participant's hand is raised. */
	handRaised: boolean

	/** Connection state for the local participant. */
	status: CallConnectionStatus
	error: CallError | null

	// ─── Actions ────────────────────────────────────────────────────

	reset: () => void
	setChannel: (channelId: string | null) => void
	setCall: (callId: string, rtcdHost: string, startAt: number, hostId: string) => void
	setStatus: (status: CallConnectionStatus) => void
	setError: (err: CallError | null) => void

	upsertSession: (s: CallSession) => void
	removeSession: (sessionId: string) => void
	setHost: (userId: string) => void

	setMic: (on: boolean) => void
	setCamera: (on: boolean) => void
	setScreenSharing: (on: boolean) => void
	toggleHand: () => void

	setSessionUnmuted: (sessionId: string, unmuted: boolean) => void
	setSessionVoice: (sessionId: string, voice: boolean) => void
	setSessionVideo: (sessionId: string, video: boolean) => void
	setSessionScreen: (sessionId: string, screenOn: boolean) => void
	setSessionHand: (sessionId: string, raisedHand: number) => void
}

const initial = {
	channelId: null as string | null,
	callId: null as string | null,
	rtcdHost: null as string | null,
	startAt: null as number | null,
	hostId: null as string | null,
	sessions: {} as Record<string, CallSession>,
	sessionOrder: [] as string[],
	micEnabled: false,
	cameraEnabled: false,
	screenSharing: false,
	handRaised: false,
	status: 'disconnected' as CallConnectionStatus,
	error: null as CallError | null,
}

export const useCallsStore = create<CallState>((set) => ({
	...initial,

	reset: () => set({ ...initial }),

	setChannel: (channelId) => set({ channelId }),
	setCall: (callId, rtcdHost, startAt, hostId) =>
		set({ callId, rtcdHost, startAt, hostId }),
	setStatus: (status) => set({ status }),
	setError: (error) => set({ error, status: error ? 'error' : 'disconnected' }),

	upsertSession: (s) =>
		set((state) => {
			const exists = !!state.sessions[s.sessionId]
			return {
				sessions: { ...state.sessions, [s.sessionId]: s },
				sessionOrder: exists ? state.sessionOrder : [...state.sessionOrder, s.sessionId],
			}
		}),
	removeSession: (sessionId) =>
		set((state) => {
			const sessions = { ...state.sessions }
			delete sessions[sessionId]
			return {
				sessions,
				sessionOrder: state.sessionOrder.filter((id) => id !== sessionId),
			}
		}),
	setHost: (hostId) => set({ hostId }),

	setMic: (micEnabled) => set({ micEnabled }),
	setCamera: (cameraEnabled) => set({ cameraEnabled }),
	setScreenSharing: (screenSharing) => set({ screenSharing }),
	toggleHand: () => set((state) => ({ handRaised: !state.handRaised })),

	setSessionUnmuted: (sessionId, unmuted) =>
		set((state) => {
			const s = state.sessions[sessionId]
			if (!s) return state
			return { sessions: { ...state.sessions, [sessionId]: { ...s, unmuted } } }
		}),
	setSessionVoice: (sessionId, voice) =>
		set((state) => {
			const s = state.sessions[sessionId]
			if (!s) return state
			return { sessions: { ...state.sessions, [sessionId]: { ...s, voice } } }
		}),
	setSessionVideo: (sessionId, video) =>
		set((state) => {
			const s = state.sessions[sessionId]
			if (!s) return state
			return { sessions: { ...state.sessions, [sessionId]: { ...s, video } } }
		}),
	setSessionScreen: (sessionId, screenOn) =>
		set((state) => {
			const s = state.sessions[sessionId]
			if (!s) return state
			return { sessions: { ...state.sessions, [sessionId]: { ...s, screenOn } } }
		}),
	setSessionHand: (sessionId, raisedHand) =>
		set((state) => {
			const s = state.sessions[sessionId]
			if (!s) return state
			return { sessions: { ...state.sessions, [sessionId]: { ...s, raisedHand } } }
		}),
}))
