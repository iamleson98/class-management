/**
 * Calls WebSocket event dispatcher (native protocol).
 *
 * Routes inbound `custom_calls_*` events from the shared chat WebSocket into
 * the calls store (UI state) and the calls client (WebRTC signaling /
 * lifecycle). Bound once per app lifetime by bindCallsWebSocket().
 *
 * Payload keys follow the fork's server contract exactly:
 *   - presence events (user_muted/unmuted/voice/screen/video/hand) use
 *     `userID` + `session_id` (+ `raised_hand` on hand events)
 *   - user_joined/user_left use `user_id` + `session_id`
 *   - user_reacted uses `user_id` + `session_id` + `emoji` + `timestamp`
 *   - call_host_changed uses `hostID`
 *   - join ack carries `connID` + `iceServers`
 *   - call_state carries `call` as a JSON STRING
 *
 * Scoping (plugin parity): presence broadcasts carry the channel in
 * `broadcast.channel_id` (NOT in `data`), so every presence handler is gated
 * on that channel matching the call we are actually in — otherwise a call in
 * channel B pollutes the roster while we view channel A.
 *
 * Additionally ports the plugin webapp's side effects:
 *   - join/leave sounds (participant threshold for join_user, in-call only)
 *   - "X has joined" transient chips (recentlyJoinedUsers)
 *   - host-control notices (host changed / lowered hand / removed)
 *   - incoming-call tracking for DM/GM channels (ringing + toasts + REST
 *     hydration of unknown channels/callers)
 *   - reaction stream with client-side expiry
 *   - per-channel calls enable/disable + cross-device dismissal sync
 */

import type { WebSocketMessage } from '@mattermost/client'
import { wsClient, client4 } from '@/lib/chat/client'
import { useChatStore } from '@/lib/chat/store'
import type { ChatUser } from '@/lib/chat/types'
import { useLMSStore } from '@/store/lms-store'
import { callsClient } from './calls-client'
import { useCallsStore, type CallStateSessionPayload, REACTION_TIMEOUT_MS, NOTICE_TIMEOUT_MS, USER_JOINED_TIMEOUT_MS } from './calls-store'
import { playCallSound, JOIN_SOUND_PARTICIPANTS_THRESHOLD } from './calls-sounds'

// Server event names (surfaced by the hub as custom_calls_<name>).
const EVT = {
        Signal: 'custom_calls_signal',
        Join: 'custom_calls_join',
        Error: 'custom_calls_error',
        CallStart: 'custom_calls_call_start',
        CallEnd: 'custom_calls_call_end',
        CallState: 'custom_calls_call_state',
        CallHostChanged: 'custom_calls_call_host_changed',
        UserJoined: 'custom_calls_user_joined',
        UserLeft: 'custom_calls_user_left',
        UserRemoved: 'custom_calls_user_removed',
        UserMuted: 'custom_calls_user_muted',
        UserUnmuted: 'custom_calls_user_unmuted',
        UserVoiceOn: 'custom_calls_user_voice_on',
        UserVoiceOff: 'custom_calls_user_voice_off',
        UserScreenOn: 'custom_calls_user_screen_on',
        UserScreenOff: 'custom_calls_user_screen_off',
        UserVideoOn: 'custom_calls_user_video_on',
        UserVideoOff: 'custom_calls_user_video_off',
        UserRaiseHand: 'custom_calls_user_raise_hand',
        UserUnraiseHand: 'custom_calls_user_unraise_hand',
        UserReacted: 'custom_calls_user_reacted',
        UserDismissedNotification: 'custom_calls_user_dismissed_notification',
        ChannelEnableVoice: 'custom_calls_channel_enable_voice',
        ChannelDisableVoice: 'custom_calls_channel_disable_voice',
        HostMute: 'custom_calls_host_mute',
        HostScreenOff: 'custom_calls_host_screen_off',
        HostLowerHand: 'custom_calls_host_lower_hand',
        HostRemoved: 'custom_calls_host_removed',
} as const

let bound = false
let reconnectBound = false

/** Expire reactions after REACTION_TIMEOUT_MS. */
let reactionTimerBound = false
/** Expire notices after NOTICE_TIMEOUT_MS. */
let noticeTimerBound = false
/** Expire recently-joined chips after USER_JOINED_TIMEOUT_MS. */
let joinedTimerBound = false

/** Calls we already rang for (ring once per call, forever — plugin parity). */
const didRingForCalls = new Set<string>()
/** Calls we already fired a desktop notification for. */
const didNotifyForCalls = new Set<string>()

/**
 * Register the calls event listener on the shared WebSocket. Idempotent —
 * safe to call on every chat mount; the listener is a singleton for the
 * app's life. Returns a no-op unbind (matches bindChatWebSocket's contract).
 */
export function bindCallsWebSocket(): () => void {
        if (!bound) {
                wsClient.addMessageListener(handleCallEvent)
                bound = true
        }
        if (!reconnectBound) {
                // A websocket reconnect invalidates the server's unicast target while
                // the call keeps running — re-register the session so signaling
                // (SFU answers/ICE) keeps reaching us.
                wsClient.addReconnectListener(() => callsClient.handleWSReconnect())
                reconnectBound = true
        }
        return () => {}
}

/** Test hook: forget ring/notify dedupe state. */
export function __resetIncomingCallDedupe(): void {
        didRingForCalls.clear()
        didNotifyForCalls.clear()
}

/** Whether the ring/notification for this call already fired. */
export function markRangFor(callId: string): void {
        didRingForCalls.add(callId)
}

export function shouldRingFor(callId: string): boolean {
        return !didRingForCalls.has(callId)
}

export function markNotifiedFor(callId: string): void {
        didNotifyForCalls.add(callId)
}

export function shouldNotifyFor(callId: string): boolean {
        return !didNotifyForCalls.has(callId)
}

/** The single dispatch function for calls events. */
function handleCallEvent(msg: WebSocketMessage): void {
        const data = (msg.data ?? {}) as Record<string, unknown>
        // Channel-scoped broadcasts (presence, lifecycle) carry the channel in
        // `broadcast.channel_id` — the presence payloads themselves do NOT.
        const eventChannel = msg.broadcast?.channel_id ?? ''

        // The channel id of the call the local user is in.
        const myCallChannel = useCallsStore.getState().channelId
        // Presence events only apply when they target OUR call's channel.
        const forMyCall = !!myCallChannel && eventChannel === myCallChannel

        // The current call event name (widened: the vendored types union lacks
        // plugin/custom events).
        const eventName = String(msg.event)
        switch (eventName) {
                // ── Signaling (unicast to this connection) ──────────────────
                case EVT.Signal: {
                        callsClient.signal(data.data)
                        break
                }

                case EVT.Join: {
                        // Join ack: we are registered; build the peer connection with the
                        // delivered ICE servers.
                        const connID = data.connID as string | undefined
                        if (connID) {
                                const iceServers = data.iceServers as Array<{ urls?: string[] | string }> | undefined
                                callsClient.handleJoinAck(connID, iceServers)
                        }
                        break
                }

                case EVT.Error: {
                        const message = typeof data.data === 'string' ? data.data : 'call error'
                        // Classify common server errors for the error modal.
                        let kind: 'generic' | 'max-participants' | 'disabled' | 'channel-disabled' = 'generic'
                        if (/maximum participants/i.test(message)) kind = 'max-participants'
                        else if (/disabled for this channel/i.test(message)) kind = 'channel-disabled'
                        else if (/feature is disabled|not configured/i.test(message)) kind = 'disabled'
                        // Leave FIRST, then set the error: leave() runs the store
                        // reset which clears any error set before it — setting the
                        // error afterwards is what lets the error modal survive to
                        // explain WHY the call ended instead of dying silently.
                        callsClient.leave()
                        useCallsStore.getState().setError({ message, kind: kind === 'channel-disabled' ? 'disabled' : kind })
                        break
                }

                // ── Call lifecycle (channel-scoped broadcasts) ──────────────
                case EVT.CallStart: {
                        const channelId = (data.channel_id as string | undefined) ?? eventChannel
                        const callId = data.call_id as string | undefined
                        const startAt = (data.start_at as number | undefined) ?? Date.now()
                        if (channelId && callId) {
                                useCallsStore.getState().markActiveCall(channelId, {
                                        callId,
                                        startAt,
                                        postId: data.post_id as string | undefined,
                                })
                                // If it's my channel's call and I just joined, record the meta.
                                if (useCallsStore.getState().channelId === channelId) {
                                        useCallsStore.getState().setCallMeta(callId, startAt)
                                } else {
                                        void maybeTrackIncomingCall(channelId, callId, startAt, data.owner_id as string | undefined)
                                }
                        }
                        break
                }

                case EVT.CallEnd: {
                        const channelId = (data.channel_id as string | undefined) ?? eventChannel
                        const callId = data.call_id as string | undefined
                        if (channelId) useCallsStore.getState().markActiveCall(channelId, null)
                        if (callId) {
                                useCallsStore.getState().removeIncomingCall(callId)
                                didRingForCalls.delete(callId)
                        }
                        // Leaving is idempotent: if we were in this call, tear down.
                        if (useCallsStore.getState().channelId === channelId) {
                                playCallSound('ended')
                                callsClient.leave()
                        }
                        break
                }

                case EVT.CallState: {
                        // Full snapshot (sent on join + reconnect + explicit request).
                        // `call` is a JSON string.
                        const callRaw = data.call as string | undefined
                        if (!callRaw) break
                        try {
                                const call = JSON.parse(callRaw) as {
                                        call_id?: string
                                        start_at?: number
                                        host_session_id?: string
                                        sessions?: CallStateSessionPayload[]
                                }
                                useCallsStore.getState().syncCallState({
                                        callId: call.call_id,
                                        startAt: call.start_at,
                                        hostSessionId: call.host_session_id,
                                        sessions: call.sessions,
                                })
                                // Hydrate profiles for participants we haven't seen yet.
                                const missing = (call.sessions ?? [])
                                        .map((s) => s.user_id)
                                        .filter((uid) => uid && !useChatStore.getState().users[uid])
                                if (missing.length > 0) void fetchProfiles(missing)
                                if (call.call_id) {
                                        const channelId = useCallsStore.getState().channelId
                                        if (channelId) useCallsStore.getState().markActiveCall(channelId, { callId: call.call_id, startAt: call.start_at ?? Date.now() })
                                }
                        } catch {
                                // ignore malformed state
                        }
                        break
                }

                case EVT.CallHostChanged: {
                        const hostId = data.hostID as string | undefined
                        if (!hostId) break
                        const s = useCallsStore.getState()
                        const myUserId = myUserIdOrNull()
                        const changed = s.hostUserId && s.hostUserId !== hostId
                        s.setHostUserId(hostId)
                        // Host-change notice (5s), like the plugin's HOST_CONTROL_NOTICE.
                        if (changed && s.channelId) {
                                const notice = {
                                        kind: 'host-changed' as const,
                                        actorUserId: hostId,
                                        mine: hostId === myUserId,
                                }
                                s.addNotice(notice)
                                expireNoticeSoon()
                        }
                        break
                }

                // ── Presence (participant broadcasts, channel-gated) ────────
                case EVT.UserJoined: {
                        if (!forMyCall) {
                                // A call started elsewhere still matters for channel toasts —
                                // markActiveCall was already handled by call_start/user events.
                                break
                        }
                        const sessionId = data.session_id as string | undefined
                        const userId = data.user_id as string | undefined
                        if (sessionId && userId) {
                                const s = useCallsStore.getState()
                                const isSelf = sessionId === s.mySessionId
                                s.upsertSession({
                                        sessionId,
                                        userId,
                                        unmuted: true,
                                        raisedHand: 0,
                                        video: false,
                                        voice: false,
                                        screenOn: false,
                                        isHost: false,
                                })
                                // Join sounds (plugin parity): always for self; for others only
                                // under the participant threshold, and only while in the call
                                // (the channel gate above already ensures that).
                                const count = s.sessionOrder.length
                                if (isSelf) playCallSound('join_self')
                                else if (count < JOIN_SOUND_PARTICIPANTS_THRESHOLD) playCallSound('join_user')
                                // "X has joined the call." transient chip.
                                if (!isSelf) {
                                        s.addRecentlyJoined(userId)
                                        scheduleJoinedExpiry()
                                        if (!useChatStore.getState().users[userId]) void fetchProfiles([userId])
                                }
                                // Joining any call stops every ring (plugin parity).
                                if (isSelf) {
                                        for (const c of [...s.incomingCalls]) {
                                                s.dismissIncomingCall(c.callId)
                                        }
                                }
                        }
                        break
                }

                case EVT.UserLeft: {
                        if (!forMyCall) break
                        const sessionId = data.session_id as string | undefined
                        const s = useCallsStore.getState()
                        // Our own session dropping without a call_end means the SFU or the
                        // server removed us (peer timeout / rtcd restart): tear the call UI
                        // down cleanly like the plugin's clientStateReducer.
                        if (sessionId && sessionId === s.mySessionId) {
                                callsClient.leave()
                                break
                        }
                        s.removeSession(sessionId ?? '')
                        break
                }

                case EVT.UserRemoved: {
                        // Broadcast when the host removes someone. The victim also gets the
                        // unicast host_removed (below); everyone else sees this notice.
                        if (!forMyCall) break
                        const removedUserId = data.user_id as string | undefined
                        const myUserId = myUserIdOrNull()
                        if (removedUserId && removedUserId !== myUserId) {
                                const s = useCallsStore.getState()
                                s.addNotice({ kind: 'removed', actorUserId: removedUserId, mine: false })
                                expireNoticeSoon()
                        }
                        break
                }

                case EVT.UserMuted:
                        if (forMyCall) useCallsStore.getState().setSessionUnmuted(data.session_id as string, false)
                        break
                case EVT.UserUnmuted:
                        if (forMyCall) useCallsStore.getState().setSessionUnmuted(data.session_id as string, true)
                        break
                case EVT.UserVoiceOn:
                        if (forMyCall) useCallsStore.getState().setSessionVoice(data.session_id as string, true)
                        break
                case EVT.UserVoiceOff:
                        if (forMyCall) useCallsStore.getState().setSessionVoice(data.session_id as string, false)
                        break
                case EVT.UserScreenOn:
                        if (forMyCall) useCallsStore.getState().setSessionScreen(data.session_id as string, true)
                        break
                case EVT.UserScreenOff:
                        if (forMyCall) useCallsStore.getState().setSessionScreen(data.session_id as string, false)
                        break
                case EVT.UserVideoOn:
                        if (forMyCall) useCallsStore.getState().setSessionVideo(data.session_id as string, true)
                        break
                case EVT.UserVideoOff:
                        if (forMyCall) useCallsStore.getState().setSessionVideo(data.session_id as string, false)
                        break
                case EVT.UserRaiseHand:
                        if (forMyCall) useCallsStore.getState().setSessionHand(data.session_id as string, (data.raised_hand as number) || Date.now())
                        break
                case EVT.UserUnraiseHand:
                        if (forMyCall) useCallsStore.getState().setSessionHand(data.session_id as string, 0)
                        break

                // ── Reactions (channel-scoped broadcast) ─────────────────────
                case EVT.UserReacted: {
                        const s = useCallsStore.getState()
                        // Only stream reactions for the call we're in.
                        if (!s.channelId || !forMyCall) break
                        const sessionId = data.session_id as string | undefined
                        const userId = data.user_id as string | undefined
                        const emoji = data.emoji as { name?: string; literal?: string; unified?: string } | undefined
                        if (!sessionId || !userId || !emoji) break
                        const literal = emoji.literal || emojiLiteralFromUnified(emoji.unified) || emoji.name || '👍'
                        s.addReaction({
                                sessionId,
                                userId,
                                emoji: literal,
                                name: emoji.name ?? '',
                        })
                        scheduleReactionExpiry()
                        break
                }

                // ── Per-channel enable/disable + dismissal sync ──────────────
                case EVT.ChannelEnableVoice: {
                        const channelId = (data.channel_id as string | undefined) ?? eventChannel
                        if (channelId) useCallsStore.getState().setChannelEnabled(channelId, true)
                        break
                }
                case EVT.ChannelDisableVoice: {
                        const channelId = (data.channel_id as string | undefined) ?? eventChannel
                        if (channelId) useCallsStore.getState().setChannelEnabled(channelId, false)
                        break
                }

                case EVT.UserDismissedNotification: {
                        // Another device of OUR user dismissed the incoming call: stop
                        // ringing here too.
                        const dismissedUser = data.user_id as string | undefined
                        if (dismissedUser !== myUserIdOrNull()) break
                        const channelId = (data.channel_id as string | undefined) ?? eventChannel
                        const s = useCallsStore.getState()
                        for (const c of [...s.incomingCalls]) {
                                if (c.channelId === channelId) s.removeIncomingCall(c.callId)
                        }
                        break
                }

                // ── Host controls (unicast to the target user) ──────────────
                case EVT.HostMute: {
                        // Only act when the target is the local session (stale-event guard).
                        if (data.session_id === useCallsStore.getState().mySessionId) callsClient.mute()
                        break
                }
                case EVT.HostScreenOff: {
                        if (data.session_id === useCallsStore.getState().mySessionId) callsClient.stopScreenShare()
                        break
                }
                case EVT.HostLowerHand: {
                        if (data.session_id !== useCallsStore.getState().mySessionId) break
                        // Local state mirrors the server's unraise broadcast; just make
                        // sure our flag is down.
                        const s = useCallsStore.getState()
                        if (s.handRaised) s.toggleHand()
                        // Notice: "the host lowered your hand" (with the host's name).
                        s.addNotice({ kind: 'lower-hand', actorUserId: (data.host_id as string | undefined) ?? '', mine: true })
                        expireNoticeSoon()
                        break
                }
                case EVT.HostRemoved: {
                        // The removed user sees the error modal via the leave path; others
                        // get the transient user_removed notice above.
                        callsClient.leave()
                        useCallsStore.getState().setError({
                                message: 'host-removed',
                                kind: 'host-removed',
                        })
                        break
                }
        }
}

// ─── Helpers ────────────────────────────────────────────────────────

function myUserIdOrNull(): string | null {
        // The LMS store owns the authenticated user id (feature-boundary safe:
        // the store has no imports back into calls).
        return useLMSStore.getState().authUser?.id ?? null
}

/** Hydrate missing user profiles through the chat REST client. */
async function fetchProfiles(userIds: string[]): Promise<void> {
        try {
                const users = (await client4.getProfilesByIds(userIds)) as unknown as ChatUser[]
                if (Array.isArray(users) && users.length > 0) {
                        useChatStore.getState().upsertUsers(users)
                }
        } catch {
                // best-effort: names resolve on the next snapshot
        }
}

/** Track incoming calls: DM/GM channels only, not my own start, not in-call. */
async function maybeTrackIncomingCall(channelId: string, callId: string, startAt: number, ownerId?: string): Promise<void> {
        const s = useCallsStore.getState()
        if (!s.config.ringingEnabled) return
        let chat = useChatStore.getState()
        let channel = chat.channels[channelId] as { type?: string } | undefined
        // Hydrate an unknown channel (e.g. a DM the store hasn't loaded yet).
        if (!channel) {
                try {
                        const fetched = (await client4.getChannel(channelId)) as unknown as { type?: string }
                        channel = fetched
                } catch {
                        return
                }
        }
        // DM/GM only (matching the plugin's incoming-call gating).
        const type = channel?.type
        if (type !== 'D' && type !== 'G') return
        // The owner is ringing themselves.
        const myId = useLMSStore.getState().authUser?.id ?? ''
        if (ownerId && ownerId === myId) return
        // Already dismissed / already ringing.
        if (s.dismissedCalls[callId]) return
        if (s.incomingCalls.some((c) => c.callId === callId)) return
        // Hydrate the caller's profile so the card shows their name.
        chat = useChatStore.getState()
        if (ownerId && !chat.users[ownerId]) void fetchProfiles([ownerId])
        // In a different call already? The incoming stack still shows (switch
        // modal handles joining), like the plugin.
        useCallsStore.getState().addIncomingCall({ callId, channelId, callerId: ownerId ?? '', startAt })
}

/** Expire the oldest reaction after REACTION_TIMEOUT_MS. */
function scheduleReactionExpiry(): void {
        if (reactionTimerBound) return
        reactionTimerBound = true
        window.setTimeout(() => {
                reactionTimerBound = false
                const s = useCallsStore.getState()
                const now = Date.now()
                const expired = s.reactions.filter((r) => now - r.at >= REACTION_TIMEOUT_MS)
                for (const r of expired) s.expireReaction(r.id)
                if (s.reactions.length > 0) scheduleReactionExpiry()
        }, REACTION_TIMEOUT_MS + 50)
}

/** Expire notices after NOTICE_TIMEOUT_MS. */
function expireNoticeSoon(): void {
        if (noticeTimerBound) return
        noticeTimerBound = true
        window.setTimeout(() => {
                noticeTimerBound = false
                const s = useCallsStore.getState()
                const now = Date.now()
                const expired = s.notices.filter((n) => now - n.at >= NOTICE_TIMEOUT_MS)
                for (const n of expired) s.expireNotice(n.id)
                if (s.notices.length > 0) expireNoticeSoon()
        }, NOTICE_TIMEOUT_MS + 50)
}

/** Expire "X has joined" chips after USER_JOINED_TIMEOUT_MS. */
function scheduleJoinedExpiry(): void {
        if (joinedTimerBound) return
        joinedTimerBound = true
        window.setTimeout(() => {
                joinedTimerBound = false
                useCallsStore.getState().expireRecentlyJoined()
                if (useCallsStore.getState().recentlyJoined.length > 0) scheduleJoinedExpiry()
        }, USER_JOINED_TIMEOUT_MS + 50)
}

/** Best-effort emoji literal from a unified codepoint string ("1f44d"). */
function emojiLiteralFromUnified(unified?: string): string {
        if (!unified) return ''
        try {
                const codePoints = unified
                        .split('-')
                        .map((hex) => parseInt(hex, 16))
                        .filter((cp) => !Number.isNaN(cp))
                return String.fromCodePoint(...codePoints)
        } catch {
                return ''
        }
}

/** Clear pending timers (test hook). */
export function __resetCallsEventTimers(): void {
        reactionTimerBound = false
        noticeTimerBound = false
        joinedTimerBound = false
}
