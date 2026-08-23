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
 *   - call_host_changed uses `hostID`
 *   - join ack carries `connID` + `iceServers`
 *   - call_state carries `call` as a JSON STRING
 */

import type { WebSocketMessage } from '@mattermost/client'
import { wsClient } from '@/lib/chat/client'
import { callsClient } from './calls-client'
import { useCallsStore, type CallStateSessionPayload } from './calls-store'

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
	HostLowerHand: 'custom_calls_host_lower_hand',
	HostRemoved: 'custom_calls_host_removed',
} as const

let bound = false
let reconnectBound = false

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

/** The single dispatch function for calls events. */
function handleCallEvent(msg: WebSocketMessage): void {
	const store = useCallsStore.getState()
	const data = (msg.data ?? {}) as Record<string, unknown>

	// The vendored @mattermost/types event union does not include plugin/
	// custom events, so compare on a widened string.
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
			store.setError({ message })
			break
		}

		// ── Call lifecycle (channel-scoped broadcasts) ──────────────
		case EVT.CallStart: {
			const channelId = data.channel_id as string | undefined
			const callId = data.call_id as string | undefined
			const startAt = (data.start_at as number | undefined) ?? Date.now()
			if (channelId && callId) {
				store.markActiveCall(channelId, { callId, startAt })
				// If it's my channel's call and I just joined, record the meta.
				if (store.channelId === channelId) store.setCallMeta(callId, startAt)
			}
			break
		}

		case EVT.CallEnd: {
			const channelId = data.channel_id as string | undefined
			if (channelId) store.markActiveCall(channelId, null)
			// Leaving is idempotent: if we were in this call, tear down.
			if (store.channelId === channelId) callsClient.leave()
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
				store.syncCallState({
					callId: call.call_id,
					startAt: call.start_at,
					hostSessionId: call.host_session_id,
					sessions: call.sessions,
				})
				if (call.call_id) {
					const channelId = store.channelId
					if (channelId) store.markActiveCall(channelId, { callId: call.call_id, startAt: call.start_at ?? Date.now() })
				}
			} catch {
				// ignore malformed state
			}
			break
		}

		case EVT.CallHostChanged: {
			const hostId = data.hostID as string | undefined
			if (hostId) store.setHostUserId(hostId)
			break
		}

		// ── Presence (participant broadcasts) ───────────────────────
		case EVT.UserJoined: {
			const sessionId = data.session_id as string | undefined
			const userId = data.user_id as string | undefined
			if (sessionId && userId) {
				store.upsertSession({
					sessionId,
					userId,
					unmuted: true,
					raisedHand: 0,
					video: false,
					voice: false,
					screenOn: false,
					isHost: false,
				})
			}
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
			store.setSessionHand(data.session_id as string, (data.raised_hand as number) || Date.now())
			break
		case EVT.UserUnraiseHand:
			store.setSessionHand(data.session_id as string, 0)
			break

		// ── Host controls (unicast to the target user) ──────────────
		case EVT.HostMute:
			callsClient.mute()
			break
		case EVT.HostScreenOff:
			callsClient.stopScreenShare()
			break
		case EVT.HostLowerHand:
			// Local state mirrors the server's unraise broadcast; just make
			// sure our flag is down.
			if (useCallsStore.getState().handRaised) useCallsStore.getState().toggleHand()
			break
		case EVT.HostRemoved:
			callsClient.leave()
			break
	}
}
