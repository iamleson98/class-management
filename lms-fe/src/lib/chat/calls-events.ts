/**
 * Calls WebSocket event dispatcher.
 *
 * Routes inbound `custom_calls_*` events from the shared chat WebSocket into
 * the calls store (for UI state) and the calls client (for WebRTC signaling).
 * Mirrors the websocket-events.ts pattern used by the chat itself, but
 * dedicated to the calls feature so the two concerns stay decoupled.
 *
 * The server publishes calls events under the "calls" product namespace, which
 * the shared WebSocketClient surfaces as event names prefixed `custom_calls_`.
 */

import type { WebSocketMessage } from '@mattermost/client'
import { wsClient } from './client'
import { callsClient } from './calls-client'
import { useCallsStore } from './calls-store'

// Calls event names (server side: "calls_" + these, surfaced as custom_calls_*).
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
        HostMute: 'custom_calls_host_mute',
        HostScreenOff: 'custom_calls_host_screen_off',
        HostRemoved: 'custom_calls_host_removed',
} as const

let bound = false

/**
 * Register the calls event listener on the shared WebSocket. Idempotent — safe
 * to call on every chat mount; the listener is a singleton for the app's life.
 * Returns a no-op unbind (matches bindChatWebSocket's contract).
 */
export function bindCallsWebSocket(): () => void {
        if (!bound) {
                wsClient.addMessageListener(handleCallEvent)
                bound = true
        }
        return () => {}
}

/** The single dispatch function for calls events. */
function handleCallEvent(msg: WebSocketMessage): void {
        const store = useCallsStore.getState()
        const data = (msg.data ?? {}) as Record<string, unknown>

        // The vendored @mattermost/types WebSocket event union does not include
        // plugin/custom events (`custom_calls_*`), so compare on a widened
        // string — the runtime values are plain strings either way.
        const eventName = String(msg.event)
        switch (eventName) {
                // ── Signaling (unicast to this connection) ──────────────────
                case EVT.Signal: {
                        // SDP/ICE answers and candidates from rtcd, relayed by the server.
                        callsClient.signal(data.data)
                        break
                }

                case EVT.Join: {
                        // The server's join ack: we are now in the call. `connID` is our
                        // stable session identity. We don't create the peer connection
                        // here — it's created when the first `signal` (ICE config/answer)
                        // arrives from rtcd.
                        store.setStatus('joined')
                        break
                }

                case EVT.Error: {
                        const message = typeof data.data === 'string' ? data.data : 'call error'
                        store.setError({ message })
                        break
                }

                // ── Call lifecycle (channel-scoped broadcasts) ──────────────
                case EVT.CallStart: {
                        const channelId = data.channel_id as string | undefined
                        if (channelId && channelId === store.channelId) {
                                store.setCall(
                                        data.call_id as string,
                                        (data.rtcd_host as string) ?? '',
                                        (data.start_at as number) ?? Date.now(),
                                        (data.owner_id as string) ?? '',
                                )
                        }
                        break
                }

                case EVT.CallEnd: {
                        if (data.channel_id === store.channelId) {
                                callsClient.leave()
                        }
                        break
                }

                case EVT.CallState: {
                        // Full state snapshot (sent on join). `call` is a JSON string.
                        const callRaw = data.call as string | undefined
                        if (!callRaw) break
                        try {
                                const call = JSON.parse(callRaw) as {
                                        id?: string
                                        start_at?: number
                                        host_id?: string
                                        sessions?: Array<{
                                                session_id: string
                                                user_id: string
                                                unmuted: boolean
                                                raised_hand: number
                                                video: boolean
                                        }>
                                }
                                if (call.id) {
                                        store.setCall(call.id, '', call.start_at ?? Date.now(), call.host_id ?? '')
                                }
                                for (const s of call.sessions ?? []) {
                                        store.upsertSession({
                                                sessionId: s.session_id,
                                                userId: s.user_id,
                                                unmuted: s.unmuted,
                                                raisedHand: s.raised_hand,
                                                video: s.video,
                                                voice: false,
                                                screenOn: false,
                                        })
                                }
                        } catch {
                                // ignore malformed state
                        }
                        break
                }

                case EVT.CallHostChanged: {
                        const hostId = data.hostID as string | undefined
                        if (hostId) store.setHost(hostId)
                        break
                }

                // ── Presence (participant-scoped broadcasts) ───────────────
                case EVT.UserJoined: {
                        store.upsertSession({
                                sessionId: data.session_id as string,
                                userId: data.user_id as string,
                                unmuted: false,
                                raisedHand: 0,
                                video: false,
                                voice: false,
                                screenOn: false,
                        })
                        break
                }

                case EVT.UserLeft: {
                        store.removeSession(data.session_id as string)
                        break
                }

                case EVT.UserMuted:
                        store.setSessionUnmuted(data.session_id as string, false)
                        break
                case EVT.UserUnmuted:
                        store.setSessionUnmuted(data.session_id as string, true)
                        break
                case EVT.UserVoiceOn:
                        store.setSessionVoice(data.session_id as string, true)
                        break
                case EVT.UserVoiceOff:
                        store.setSessionVoice(data.session_id as string, false)
                        break
                case EVT.UserScreenOn:
                        store.setSessionScreen(data.session_id as string, true)
                        break
                case EVT.UserScreenOff:
                        store.setSessionScreen(data.session_id as string, false)
                        break
                case EVT.UserVideoOn:
                        store.setSessionVideo(data.session_id as string, true)
                        break
                case EVT.UserVideoOff:
                        store.setSessionVideo(data.session_id as string, false)
                        break
                case EVT.UserRaiseHand:
                        store.setSessionHand(data.session_id as string, data.raised_hand as number)
                        break
                case EVT.UserUnraiseHand:
                        store.setSessionHand(data.session_id as string, 0)
                        break

                // ── Host controls (unicast to the target user) ─────────────
                case EVT.HostMute:
                        callsClient.mute()
                        break
                case EVT.HostScreenOff:
                        callsClient.stopScreenShare()
                        break
                case EVT.HostRemoved:
                        callsClient.leave()
                        break
        }
}
