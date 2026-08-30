/**
 * Calls event dispatcher tests — protocol payload handling for the native
 * server events, verified against the exact wire shapes the fork emits.
 *
 * The wsClient is mocked; we invoke the registered message listener.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

type Listener = (msg: {
        event: string
        data?: Record<string, unknown>
        broadcast?: { channel_id?: string; user_id?: string }
}) => void
let messageListener: Listener | undefined
let reconnectListener: (() => void) | undefined

vi.mock('@/lib/chat/client', () => ({
        wsClient: {
                addMessageListener: (fn: Listener) => { messageListener = fn },
                addReconnectListener: (fn: () => void) => { reconnectListener = fn },
                sendMessage: vi.fn(),
                initialize: vi.fn(),
        },
}))

// The client's signal/handlers are class methods on a singleton; spy on the
// prototype-level behavior by mocking the module.
vi.mock('./calls-client', () => ({
        callsClient: {
                signal: vi.fn(),
                handleJoinAck: vi.fn(),
                handleWSReconnect: vi.fn(),
                mute: vi.fn(),
                stopScreenShare: vi.fn(),
                leave: vi.fn(),
                requestCallState: vi.fn(),
        },
}))

import { bindCallsWebSocket } from './calls-events'
import { callsClient } from './calls-client'
import { useCallsStore } from './calls-store'

/**
 * Emit an event. Presence broadcasts carry the channel in
 * `broadcast.channel_id` (the server's wire shape); the second arg overrides
 * it (e.g. to simulate another channel's call).
 */
const emit = (event: string, data: Record<string, unknown>, broadcastChannel = 'ch') =>
        messageListener?.({ event, data, broadcast: { channel_id: broadcastChannel } })

const store = () => useCallsStore.getState()

describe('calls event dispatcher', () => {
        beforeEach(() => {
                vi.clearAllMocks()
                store().reset()
                // Presence events are channel-gated: act as if we joined the call
                // in channel 'ch'.
                store().setChannel('ch')
                bindCallsWebSocket()
        })

        it('join ack forwards connID + ICE servers to the client', () => {
                emit('custom_calls_join', { connID: 'my-sess', iceServers: [{ urls: ['stun:x:3478'] }] })
                expect(callsClient.handleJoinAck).toHaveBeenCalledWith('my-sess', [{ urls: ['stun:x:3478'] }])
        })

        it('signal events forward the raw data payload to the client', () => {
                emit('custom_calls_signal', { data: '{"type":"answer","sdp":"v=0"}' })
                expect(callsClient.signal).toHaveBeenCalledWith('{"type":"answer","sdp":"v=0"}')
        })

        it('call_state parses the JSON string payload and syncs sessions + host', () => {
                emit('custom_calls_call_state', {
                        call: JSON.stringify({
                                call_id: 'c1',
                                start_at: 77,
                                host_session_id: 's2',
                                sessions: [
                                        { id: 's1', user_id: 'u1', unmuted: true, voice_on: false, screen_on: false, video_on: false },
                                        { id: 's2', user_id: 'u2', unmuted: false, voice_on: true, screen_on: false, video_on: false },
                                ],
                        }),
                })
                const s = store()
                expect(s.callId).toBe('c1')
                expect(s.hostUserId).toBe('u2')
                expect(s.sessionOrder).toEqual(['s1', 's2'])
                expect(s.sessions.s2.voice).toBe(true)
        })

        it('user_joined / user_left manage the participant list', () => {
                emit('custom_calls_user_joined', { user_id: 'u1', session_id: 's1' })
                expect(store().sessions.s1?.userId).toBe('u1')

                emit('custom_calls_user_left', { user_id: 'u1', session_id: 's1' })
                expect(store().sessions.s1).toBeUndefined()
        })

        it('presence events use the userID + session_id keys', () => {
                emit('custom_calls_user_joined', { user_id: 'u1', session_id: 's1' })

                emit('custom_calls_user_muted', { userID: 'u1', session_id: 's1' })
                expect(store().sessions.s1.unmuted).toBe(false)
                emit('custom_calls_user_unmuted', { userID: 'u1', session_id: 's1' })
                expect(store().sessions.s1.unmuted).toBe(true)

                emit('custom_calls_user_voice_on', { userID: 'u1', session_id: 's1' })
                expect(store().sessions.s1.voice).toBe(true)
                emit('custom_calls_user_voice_off', { userID: 'u1', session_id: 's1' })
                expect(store().sessions.s1.voice).toBe(false)

                emit('custom_calls_user_video_on', { userID: 'u1', session_id: 's1' })
                expect(store().sessions.s1.video).toBe(true)

                emit('custom_calls_user_raise_hand', { userID: 'u1', session_id: 's1', raised_hand: 555 })
                expect(store().sessions.s1.raisedHand).toBe(555)
                emit('custom_calls_user_unraise_hand', { userID: 'u1', session_id: 's1', raised_hand: 0 })
                expect(store().sessions.s1.raisedHand).toBe(0)
        })

        it('call_start / call_end maintain the join-button markers', () => {
                emit('custom_calls_call_start', { channel_id: 'ch9', call_id: 'c9', start_at: 5, rtcd_host: 'h' })
                expect(store().activeCalls.ch9).toEqual({ callId: 'c9', startAt: 5 })

                emit('custom_calls_call_end', { channel_id: 'ch9', call_id: 'c9', end_at: 9 })
                expect(store().activeCalls.ch9).toBeUndefined()
        })

        it('call_end in MY channel tears the call down', () => {
                store().setChannel('ch9')
                emit('custom_calls_call_end', { channel_id: 'ch9', call_id: 'c9', end_at: 9 })
                expect(callsClient.leave).toHaveBeenCalled()
        })

        it('call_host_changed uses the hostID key', () => {
                emit('custom_calls_user_joined', { user_id: 'u2', session_id: 's2' })
                emit('custom_calls_call_host_changed', { hostID: 'u2', call_id: 'c1' })
                expect(store().hostUserId).toBe('u2')
                expect(store().sessions.s2.isHost).toBe(true)
        })

        it('error events set the call-level error', () => {
                emit('custom_calls_error', { data: 'boom', connID: 'x' })
                expect(store().error?.message).toBe('boom')
                expect(store().status).toBe('error')
        })

        it('host controls act on the local client (session-gated)', () => {
                store().setMySessionId('s')

                emit('custom_calls_host_mute', { channel_id: 'ch', session_id: 's' })
                expect(callsClient.mute).toHaveBeenCalled()

                emit('custom_calls_host_screen_off', { channel_id: 'ch', session_id: 's' })
                expect(callsClient.stopScreenShare).toHaveBeenCalled()

                emit('custom_calls_host_removed', { channel_id: 'ch', session_id: 's' })
                expect(callsClient.leave).toHaveBeenCalled()
        })

        it('host controls for ANOTHER session are ignored (stale-event guard)', () => {
                store().setMySessionId('s')
                emit('custom_calls_host_mute', { channel_id: 'ch', session_id: 'someone-else' })
                expect(callsClient.mute).not.toHaveBeenCalled()
        })

        it('presence events from ANOTHER channel do not pollute the roster', () => {
                emit('custom_calls_user_joined', { user_id: 'stranger', session_id: 'sx' }, 'other-channel')
                expect(store().sessions.sx).toBeUndefined()

                emit('custom_calls_user_muted', { userID: 'stranger', session_id: 'sx' }, 'other-channel')
                expect(store().sessions.sx).toBeUndefined()
        })

        it('own user_left tears the call down locally', () => {
                store().setMySessionId('s1')
                emit('custom_calls_user_joined', { user_id: 'u1', session_id: 's1' })
                emit('custom_calls_user_left', { user_id: 'u1', session_id: 's1' })
                expect(callsClient.leave).toHaveBeenCalled()
        })

        it('user_removed (someone else) adds a notice for others', () => {
                store().setMySessionId('s1')
                emit('custom_calls_user_joined', { user_id: 'u1', session_id: 's1' })
                emit('custom_calls_user_joined', { user_id: 'u2', session_id: 's2' })
                emit('custom_calls_user_removed', { user_id: 'u2', session_id: 's2', host_id: 'u1' })
                expect(store().notices.some((n) => n.kind === 'removed' && n.actorUserId === 'u2')).toBe(true)
        })

        it('channel voice events toggle per-channel enablement', () => {
                emit('custom_calls_channel_disable_voice', { channel_id: 'ch' })
                expect(store().channelsEnabled.ch).toBe(false)
                emit('custom_calls_channel_enable_voice', { channel_id: 'ch' })
                expect(store().channelsEnabled.ch).toBe(true)
        })

        it('user_dismissed_notification removes the incoming call for that channel', () => {
                store().addIncomingCall({ callId: 'c1', channelId: 'ch', callerId: 'u9', startAt: 1 })
                emit('custom_calls_user_dismissed_notification', { channel_id: 'ch', user_id: 'me' })
                expect(store().incomingCalls.some((c) => c.callId === 'c1')).toBe(false)
        })

        it('a websocket reconnect re-registers the session', () => {
                reconnectListener?.()
                expect(callsClient.handleWSReconnect).toHaveBeenCalled()
        })
})
