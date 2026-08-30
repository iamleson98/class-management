/**
 * Calls realtime store (Zustand).
 *
 * Holds the live state for the call the LOCAL user is in, plus the set of
 * channels with in-progress calls (for header join buttons), the client config
 * (feature gating), device lists (pickers), in-call ephemeral state (reactions,
 * host notices) and incoming-call notifications. Mirrors the shape the
 * Mattermost Calls webapp kept in Redux, adapted to the native server protocol
 * (server/channels/calls).
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

/** Machine-readable failure kinds surfaced by the error modal. */
export type CallErrorKind =
        | 'generic'
        | 'rtc-timeout' // timed out waiting for rtc connection
        | 'rtc-failed' // peer connection failed/closed
        | 'host-removed' // the host removed us
        | 'insecure-context' // not https/localhost
        | 'device-audio' // no microphone / permission denied
        | 'device-video' // no camera / permission denied
        | 'max-participants'
        | 'disabled'

interface CallError {
        message: string
        kind: CallErrorKind
}

/** A channel with an in-progress call (for join buttons). */
export interface ActiveCall {
        callId: string
        startAt: number
        /** The announcement post id (custom_calls) when known. */
        postId?: string
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

/** Client-facing calls configuration (GET /api/v4/calls/config). */
export interface CallsConfig {
        enabled: boolean
        maxParticipants: number // 0 = unlimited
        allowScreenSharing: boolean
        allowRecording: boolean
        ringingEnabled: boolean
        hostControlsAllowed: boolean
        groupCallsAllowed: boolean
        enableVideo: boolean
        enableReactions: boolean
}

export const DEFAULT_CALLS_CONFIG: CallsConfig = {
        enabled: true,
        maxParticipants: 0,
        allowScreenSharing: true,
        allowRecording: false,
        ringingEnabled: true,
        hostControlsAllowed: true,
        groupCallsAllowed: true,
        enableVideo: true,
        enableReactions: true,
}

/** A media device as surfaced by the device pickers. */
export interface CallDevice {
        deviceId: string
        label: string
}

/** One floating in-call reaction (emoji + author), expiring after 10s. */
export interface CallReaction {
        id: string
        sessionId: string
        userId: string
        /** Emoji literal character (rendered directly). */
        emoji: string
        /** Emoji short name (e.g. "thumbsup"). */
        name: string
        at: number
}

/** Transient host-control notice (auto-expires after 5s). */
export interface HostNotice {
        id: string
        kind: 'host-changed' | 'lower-hand' | 'removed'
        /** Actor user id (the new host / the one who lowered your hand...). */
        actorUserId: string
        /** True when the notice targets the local user. */
        mine: boolean
        at: number
}

/** An incoming (ringing) call notification — DM/GM channels only. */
export interface IncomingCall {
        callId: string
        channelId: string
        /** The user who started the call. */
        callerId: string
        startAt: number
}

/** Transient in-call alert banner (device/permission issues). */
export interface CallAlert {
        id: string
        kind:
                | 'audio-input-missing'
                | 'audio-input-permissions'
                | 'video-input-missing'
                | 'video-input-permissions'
                | 'screen-permissions'
                | 'audio-input-fallback'
                | 'audio-output-fallback'
        /** The fallback device label, when relevant. */
        deviceLabel?: string
        at: number
}

/** A "X has joined the call" transient chip (auto-expires after 5s). */
export interface RecentlyJoined {
        userId: string
        at: number
}

/** Connection quality derived from RTC stats polling. */
export type CallQuality = 'good' | 'fair' | 'poor' | 'unknown'

/** Layout mode for the expanded call view. */
export type CallViewMode = 'speaker' | 'grid'

// ─── Store ──────────────────────────────────────────────────────────

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

        /** Server-provided feature config (fetched at startup). */
        config: CallsConfig

        /** Device lists for the pickers (refreshed on devicechange). */
        devices: {
                audioInputs: CallDevice[]
                audioOutputs: CallDevice[]
                videoInputs: CallDevice[]
        }
        /** Selected device ids (persisted to localStorage by the client). */
        selectedDevices: {
                audioInput: string
                audioOutput: string
                videoInput: string
        }

        /** Local media flags. */
        micEnabled: boolean
        cameraEnabled: boolean
        screenSharing: boolean
        handRaised: boolean

        /** Connection state for the local participant. */
        status: CallConnectionStatus
        error: CallError | null

        /** Floating reactions (newest last), capped at 50, expiring after 10s. */
        reactions: CallReaction[]
        /** Transient host-control notices (newest last). */
        notices: HostNotice[]
        /** Incoming call notifications (DM/GM only). */
        incomingCalls: IncomingCall[]
        /** Incoming calls the user explicitly ignored (this session). */
        dismissedCalls: Record<string, boolean>

        /** Layout + panel toggles for the expanded view. */
        viewMode: CallViewMode
        participantsOpen: boolean
        chatOpen: boolean
        /** Whether the call UI is collapsed to the compact mini-widget. */
        minimized: boolean
        /** Whether the self-view video is mirrored (persisted preference). */
        mirrorVideo: boolean

        /** Transient device/permission alert banners (deduped by kind). */
        alerts: CallAlert[]
        /** Per-channel calls enablement (channel_enable/disable_voice events). */
        channelsEnabled: Record<string, boolean>
        /** "X has joined" chips (5s expiry). */
        recentlyJoined: RecentlyJoined[]

        /** Last measured connection quality. */
        quality: CallQuality
        /** Whether a degraded-quality banner is shown (re-armable). */
        qualityAlert: boolean

        // ─── Actions ────────────────────────────────────────────────────

        reset: () => void
        setChannel: (channelId: string | null) => void
        setCallMeta: (callId: string, startAt: number) => void
        setMySessionId: (sessionId: string) => void
        setStatus: (status: CallConnectionStatus) => void
        setError: (err: CallError | null) => void
        clearError: () => void

        setConfig: (config: Partial<CallsConfig>) => void

        setDevices: (devices: {
                audioInputs?: CallDevice[]
                audioOutputs?: CallDevice[]
                videoInputs?: CallDevice[]
        }) => void
        setSelectedDevice: (kind: 'audioInput' | 'audioOutput' | 'videoInput', deviceId: string) => void

        syncCallState: (payload: {
                callId?: string
                startAt?: number
                hostSessionId?: string
                sessions?: CallStateSessionPayload[]
        }) => void

        upsertSession: (s: CallSession) => void
        removeSession: (sessionId: string) => void
        setHostUserId: (hostUserId: string) => void

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

        addReaction: (reaction: Omit<CallReaction, 'id' | 'at'>) => void
        expireReaction: (id: string) => void

        addNotice: (notice: Omit<HostNotice, 'id' | 'at'>) => void
        expireNotice: (id: string) => void

        addIncomingCall: (call: IncomingCall) => void
        removeIncomingCall: (callId: string) => void
        dismissIncomingCall: (callId: string) => void

        setViewMode: (mode: CallViewMode) => void
        toggleParticipants: () => void
        setParticipantsOpen: (open: boolean) => void
        toggleChat: () => void
        setChatOpen: (open: boolean) => void
        setMinimized: (minimized: boolean) => void
        setMirrorVideo: (mirror: boolean) => void

        addAlert: (alert: Omit<CallAlert, 'id' | 'at'>) => void
        expireAlert: (id: string) => void
        dismissAlertsOfKind: (kind: CallAlert['kind']) => void

        setChannelEnabled: (channelId: string, enabled: boolean) => void
        addRecentlyJoined: (userId: string) => void
        expireRecentlyJoined: () => void

        setQuality: (quality: CallQuality) => void
        setQualityAlert: (show: boolean) => void
}

/** Expire reactions after 10s (REACTION_TIMEOUT_IN_REACTION_STREAM). */
export const REACTION_TIMEOUT_MS = 10_000
/** Max reactions kept in the stream (MAX_NUM_REACTIONS_IN_REACTION_STREAM). */
export const MAX_REACTIONS = 50
/** Host-control notices auto-expire (HOST_CONTROL_NOTICE_TIMEOUT). */
export const NOTICE_TIMEOUT_MS = 5_000
/** Incoming-call ringing window (RING_LENGTH). */
export const RING_LENGTH_MS = 30_000
/** "X has joined" chips auto-expire (USER_JOINED_TIMEOUT). */
export const USER_JOINED_TIMEOUT_MS = 5_000

/** localStorage key: mirror the self-view video (plugin parity). */
export const LS_MIRROR_VIDEO = 'calls_mirror_video'

export function readMirrorVideoPref(): boolean {
        try {
                return localStorage.getItem(LS_MIRROR_VIDEO) !== 'off'
        } catch {
                return true
        }
}

export function writeMirrorVideoPref(on: boolean): void {
        try {
                localStorage.setItem(LS_MIRROR_VIDEO, on ? 'on' : 'off')
        } catch {
                /* storage unavailable — preference stays in-memory */
        }
}

let reactionSeq = 0
let noticeSeq = 0
let alertSeq = 0

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
        config: DEFAULT_CALLS_CONFIG,
        devices: {
                audioInputs: [] as CallDevice[],
                audioOutputs: [] as CallDevice[],
                videoInputs: [] as CallDevice[],
        },
        selectedDevices: {
                audioInput: '',
                audioOutput: '',
                videoInput: '',
        },
        micEnabled: false,
        cameraEnabled: false,
        screenSharing: false,
        handRaised: false,
        status: 'disconnected' as CallConnectionStatus,
        error: null as CallError | null,
        reactions: [] as CallReaction[],
        notices: [] as HostNotice[],
        incomingCalls: [] as IncomingCall[],
        dismissedCalls: {} as Record<string, boolean>,
        viewMode: 'speaker' as CallViewMode,
        participantsOpen: false,
        chatOpen: false,
        minimized: false,
        mirrorVideo: readMirrorVideoPref(),
        alerts: [] as CallAlert[],
        channelsEnabled: {} as Record<string, boolean>,
        recentlyJoined: [] as RecentlyJoined[],
        quality: 'unknown' as CallQuality,
        qualityAlert: false,
}

export const useCallsStore = create<CallState>((set) => ({
        ...initial,

        reset: () => {
                const s = useCallsStore.getState()
                const keep = {
                        activeCalls: s.activeCalls,
                        config: s.config,
                        devices: s.devices,
                        selectedDevices: s.selectedDevices,
                        incomingCalls: s.incomingCalls,
                        dismissedCalls: s.dismissedCalls,
                        channelsEnabled: s.channelsEnabled,
                        mirrorVideo: s.mirrorVideo,
                        minimized: false,
                }
                set({ ...initial, ...keep })
        },

        setChannel: (channelId) => set({ channelId }),
        setCallMeta: (callId, startAt) => set({ callId, startAt }),
        setMySessionId: (mySessionId) => set({ mySessionId }),
        setStatus: (status) => set({ status }),
        setError: (error) =>
                set({ error, status: error ? 'error' : useCallsStore.getState().status }),
        clearError: () => set({ error: null }),

        setConfig: (config) => set((state) => ({ config: { ...state.config, ...config } })),

        setDevices: (devices) =>
                set((state) => ({
                        devices: {
                                audioInputs: devices.audioInputs ?? state.devices.audioInputs,
                                audioOutputs: devices.audioOutputs ?? state.devices.audioOutputs,
                                videoInputs: devices.videoInputs ?? state.devices.videoInputs,
                        },
                })),
        setSelectedDevice: (kind, deviceId) =>
                set((state) => ({ selectedDevices: { ...state.selectedDevices, [kind]: deviceId } })),

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

        addReaction: (reaction) =>
                set((state) => {
                        const next = [
                                ...state.reactions,
                                { ...reaction, id: `r${++reactionSeq}`, at: Date.now() },
                        ]
                        if (next.length > MAX_REACTIONS) next.splice(0, next.length - MAX_REACTIONS)
                        return { reactions: next }
                }),
        expireReaction: (id) =>
                set((state) => ({ reactions: state.reactions.filter((r) => r.id !== id) })),

        addNotice: (notice) =>
                set((state) => ({
                        notices: [...state.notices, { ...notice, id: `n${++noticeSeq}`, at: Date.now() }],
                })),
        expireNotice: (id) =>
                set((state) => ({ notices: state.notices.filter((n) => n.id !== id) })),

        addIncomingCall: (call) =>
                set((state) => {
                        if (state.dismissedCalls[call.callId]) return state
                        if (state.incomingCalls.some((c) => c.callId === call.callId)) return state
                        // Never ring into a call we're already in.
                        if (state.channelId && state.channelId !== call.channelId && state.status !== 'disconnected' && state.status !== 'error') {
                                return { incomingCalls: [...state.incomingCalls, call] }
                        }
                        if (state.channelId === call.channelId) return state
                        return { incomingCalls: [...state.incomingCalls, call] }
                }),
        removeIncomingCall: (callId) =>
                set((state) => ({ incomingCalls: state.incomingCalls.filter((c) => c.callId !== callId) })),
        dismissIncomingCall: (callId) =>
                set((state) => {
                        const dismissedCalls = { ...state.dismissedCalls, [callId]: true }
                        return { incomingCalls: state.incomingCalls.filter((c) => c.callId !== callId), dismissedCalls }
                }),

        setViewMode: (viewMode) => set({ viewMode }),
        toggleParticipants: () => set((state) => ({ participantsOpen: !state.participantsOpen })),
        setParticipantsOpen: (participantsOpen) => set({ participantsOpen }),
        toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen })),
        setChatOpen: (chatOpen) => set({ chatOpen }),
        setMinimized: (minimized) => set({ minimized }),
        setMirrorVideo: (mirrorVideo) => {
                writeMirrorVideoPref(mirrorVideo)
                set({ mirrorVideo })
        },

        addAlert: (alert) =>
                set((state) => {
                        // Dedupe by kind: refresh the existing banner instead of stacking.
                        const existing = state.alerts.find((a) => a.kind === alert.kind)
                        if (existing) {
                                return {
                                        alerts: state.alerts.map((a) =>
                                                a.id === existing.id ? { ...a, ...alert, id: a.id, at: Date.now() } : a,
                                        ),
                                }
                        }
                        return { alerts: [...state.alerts, { ...alert, id: `a${++alertSeq}`, at: Date.now() }] }
                }),
        expireAlert: (id) => set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
        dismissAlertsOfKind: (kind) => set((state) => ({ alerts: state.alerts.filter((a) => a.kind !== kind) })),

        setChannelEnabled: (channelId, enabled) =>
                set((state) => ({ channelsEnabled: { ...state.channelsEnabled, [channelId]: enabled } })),

        addRecentlyJoined: (userId) =>
                set((state) => {
                        const now = Date.now()
                        const kept = state.recentlyJoined.filter((r) => now - r.at < USER_JOINED_TIMEOUT_MS && r.userId !== userId)
                        return { recentlyJoined: [...kept, { userId, at: now }] }
                }),
        expireRecentlyJoined: () =>
                set((state) => {
                        const now = Date.now()
                        return { recentlyJoined: state.recentlyJoined.filter((r) => now - r.at < USER_JOINED_TIMEOUT_MS) }
                }),

        setQuality: (quality) => set({ quality }),
        setQualityAlert: (qualityAlert) => set({ qualityAlert }),
}))

// ─── Selectors (port of the plugin's selectors.ts) ──────────────────

export function selectParticipantsCount(s: CallState): number {
        return s.sessionOrder.length
}

export function selectIsLimitRestricted(s: CallState): boolean {
        return s.config.maxParticipants > 0 && s.sessionOrder.length >= s.config.maxParticipants
}

export function selectIsHost(s: CallState, userId: string | undefined | null): boolean {
        return !!userId && s.hostUserId === userId
}

export function selectRaisedHands(s: CallState): CallSession[] {
        return Object.values(s.sessions)
                .filter((x) => x.raisedHand > 0)
                .sort((a, b) => a.raisedHand - b.raisedHand)
}

/** Whether calls are enabled for a channel (unset = enabled; server default). */
export function selectChannelCallsEnabled(s: CallState, channelId: string | null | undefined): boolean {
        if (!channelId) return true
        return s.channelsEnabled[channelId] !== false
}

/** The current speaker (VAD), excluding the local user. */
export function selectCurrentSpeaker(s: CallState): CallSession | null {
        return Object.values(s.sessions).find((x) => x.voice) ?? null
}
