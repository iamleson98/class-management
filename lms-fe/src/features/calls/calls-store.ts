/**
 * Calls realtime store (Zustand).
 *
 * Holds the live state for the call the LOCAL user is in, plus the set of
 * channels with in-progress calls (for header join buttons). Mirrors the
 * shape the Mattermost Calls webapp kept in Redux, adapted to the native
 * server protocol (server/channels/calls).
 *
 * Media ownership:
 *  - The RTCPeerConnection lives on the CallsClient singleton (NOT here) so
 *    media renegotiation never triggers React re-renders.
 *  - Remote MediaStreams (video per session + the shared screen) are stored
 *    here as plain references; <video> elements bind via srcObject.
 *  - Voice is played through detached <audio> elements owned by the client.
 */

import { create } from 'zustand'

// ─── Types ──────────────────────────────────────────────────────────

/** One participant's presence in a call. Keyed by the server session id. */
export interface CallSession {
	/** Server-assigned session id (stable across reconnects). */
	sessionId: string
	userId: string
	unmuted: boolean
	/** Unix-ms timestamp the hand was raised, or 0 when lowered. */
	raisedHand: number
	video: boolean
	/** Speaking indicator, toggled by the SFU's VAD (user_voice_on/off). */
	voice: boolean
	screenOn: boolean
	/** Whether this session is the call host. */
	isHost: boolean
}

/** Connection lifecycle for the local participant. */
export type CallConnectionStatus =
	| 'disconnected'
	| 'connecting' // acquiring media / awaiting join ack
	| 'joined' // join ack received; negotiating WebRTC
	| 'connected' // RTCPeerConnection reached 'connected'
	| 'reconnecting' // WS or RTC dropped; attempting recovery
	| 'error'

interface CallError {
	message: string
}

/** A channel with an in-progress call (for join buttons). */
export interface ActiveCall {
	callId: string
	startAt: number
}

/** Raw session shape inside the server's call_state payload. */
export interface CallStateSessionPayload {
	id: string
	user_id: string
	unmuted: boolean
	voice_on: boolean
	screen_on: boolean
	video_on: boolean
	raised_hand_at?: number
	is_host?: boolean
}

interface CallState {
	/** The channel id of the call the LOCAL user is in, or null. */
	channelId: string | null
	/** The call id assigned by the server. */
	callId: string | null
	/** My server session id (assigned in the join ack). */
	mySessionId: string | null
	/** Call start time (unix ms) — drives the duration timer. */
	startAt: number | null
	/** The host USER id. */
	hostUserId: string | null
	/** Per-participant presence keyed by session id. */
	sessions: Record<string, CallSession>
	/** Join order of session ids for stable rendering. */
	sessionOrder: string[]

	/** Remote camera streams keyed by origin session id. */
	videoStreams: Record<string, MediaStream>
	/** The active screen-share stream + its origin session, when any. */
	screenStream: { sessionId: string; stream: MediaStream } | null

	/** Channels with in-progress calls (including this one). */
	activeCalls: Record<string, ActiveCall>

	/** Local media flags. */
	micEnabled: boolean
	cameraEnabled: boolean
	screenSharing: boolean
	handRaised: boolean

	/** Connection state for the local participant. */
	status: CallConnectionStatus
	error: CallError | null

	// ─── Actions ────────────────────────────────────────────────────

	reset: () => void
	setChannel: (channelId: string | null) => void
	setCallMeta: (callId: string, startAt: number) => void
	setMySessionId: (sessionId: string) => void
	setStatus: (status: CallConnectionStatus) => void
	setError: (err: CallError | null) => void

	syncCallState: (payload: {
		callId?: string
		startAt?: number
		hostSessionId?: string
		sessions?: CallStateSessionPayload[]
	}) => void

	upsertSession: (s: CallSession) => void
	removeSession: (sessionId: string) => void
	setHostUserId: (userId: string) => void

	setMic: (on: boolean) => void
	setCamera: (on: boolean) => void
	setScreenSharing: (on: boolean) => void
	toggleHand: () => void

	setSessionUnmuted: (sessionId: string, unmuted: boolean) => void
	setSessionVoice: (sessionId: string, voice: boolean) => void
	setSessionVideo: (sessionId: string, video: boolean) => void
	setSessionScreen: (sessionId: string, screenOn: boolean) => void
	setSessionHand: (sessionId: string, raisedHand: number) => void

	setVideoStream: (sessionId: string, stream: MediaStream | null) => void
	setScreenStream: (sessionId: string | null, stream: MediaStream | null) => void

	markActiveCall: (channelId: string, call: ActiveCall | null) => void
}

const initial = {
	channelId: null as string | null,
	callId: null as string | null,
	mySessionId: null as string | null,
	startAt: null as number | null,
	hostUserId: null as string | null,
	sessions: {} as Record<string, CallSession>,
	sessionOrder: [] as string[],
	videoStreams: {} as Record<string, MediaStream>,
	screenStream: null as { sessionId: string; stream: MediaStream } | null,
	activeCalls: {} as Record<string, ActiveCall>,
	micEnabled: false,
	cameraEnabled: false,
	screenSharing: false,
	handRaised: false,
	status: 'disconnected' as CallConnectionStatus,
	error: null as CallError | null,
}

export const useCallsStore = create<CallState>((set) => ({
	...initial,

	reset: () => {
		const keep = useCallsStore.getState().activeCalls
		set({ ...initial, activeCalls: keep })
	},

	setChannel: (channelId) => set({ channelId }),
	setCallMeta: (callId, startAt) => set({ callId, startAt }),
	setMySessionId: (mySessionId) => set({ mySessionId }),
	setStatus: (status) => set({ status }),
	setError: (error) => set({ error, status: error ? 'error' : 'disconnected' }),

	syncCallState: (payload) =>
		set((state) => {
			const sessions: Record<string, CallSession> = {}
			const order: string[] = []
			for (const s of payload.sessions ?? []) {
				if (!s?.id) continue
				sessions[s.id] = {
					sessionId: s.id,
					userId: s.user_id,
					unmuted: !!s.unmuted,
					raisedHand: s.raised_hand_at ?? 0,
					video: !!s.video_on,
					voice: !!s.voice_on,
					screenOn: !!s.screen_on,
					isHost: !!s.is_host,
				}
				order.push(s.id)
			}
			// Re-host per the server's host session when provided.
			let hostUserId = state.hostUserId
			if (payload.hostSessionId && sessions[payload.hostSessionId]) {
				hostUserId = sessions[payload.hostSessionId].userId
				for (const id of Object.keys(sessions)) {
					sessions[id] = { ...sessions[id], isHost: id === payload.hostSessionId }
				}
			} else if (!hostUserId && order.length > 0) {
				const host = Object.values(sessions).find((s) => s.isHost)
				hostUserId = host?.userId ?? null
			}
			return {
				sessions,
				sessionOrder: order,
				hostUserId,
				callId: payload.callId ?? state.callId,
				startAt: payload.startAt ?? state.startAt,
			}
		}),

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
			const videoStreams = { ...state.videoStreams }
			delete videoStreams[sessionId]
			const screenStream =
				state.screenStream?.sessionId === sessionId ? null : state.screenStream
			return {
				sessions,
				sessionOrder: state.sessionOrder.filter((id) => id !== sessionId),
				videoStreams,
				screenStream,
			}
		}),
	setHostUserId: (hostUserId) =>
		set((state) => {
			const sessions = { ...state.sessions }
			for (const id of Object.keys(sessions)) {
				sessions[id] = { ...sessions[id], isHost: sessions[id].userId === hostUserId }
			}
			return { hostUserId, sessions }
		}),

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
			const sessions = { ...state.sessions }
			// Only one sharer at a time (enforced server-side too).
			for (const id of Object.keys(sessions)) {
				sessions[id] = { ...sessions[id], screenOn: id === sessionId && screenOn }
			}
			return { sessions }
		}),
	setSessionHand: (sessionId, raisedHand) =>
		set((state) => {
			const s = state.sessions[sessionId]
			if (!s) return state
			return { sessions: { ...state.sessions, [sessionId]: { ...s, raisedHand } } }
		}),

	setVideoStream: (sessionId, stream) =>
		set((state) => {
			const videoStreams = { ...state.videoStreams }
			if (stream) {
				videoStreams[sessionId] = stream
			} else {
				delete videoStreams[sessionId]
			}
			return { videoStreams }
		}),
	setScreenStream: (sessionId, stream) =>
		set(() => (stream && sessionId ? { screenStream: { sessionId, stream } } : { screenStream: null })),

	markActiveCall: (channelId, call) =>
		set((state) => {
			const activeCalls = { ...state.activeCalls }
			if (call) {
				activeCalls[channelId] = call
			} else {
				delete activeCalls[channelId]
			}
			return { activeCalls }
		}),
}))
