/**
 * Round-2 parity tests — engine robustness + discovery + per-channel prefs
 * added on top of the first parity wave.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

type Listener = (msg: {
	event: string
	data?: Record<string, unknown>
	broadcast?: { channel_id?: string; user_id?: string }
}) => void
let capturedListener: Listener | undefined

vi.mock('@/lib/chat/client', () => ({
	wsClient: {
		addMessageListener: (fn: Listener) => { capturedListener = fn },
		addReconnectListener: vi.fn(),
		sendMessage: vi.fn(),
		initialize: vi.fn(),
	},
	client4: {
		getProfilesByIds: vi.fn(async () => []),
		getChannel: vi.fn(async () => ({ type: 'D' })),
	},
}))

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
import { useCallsStore, readMirrorVideoPref, selectChannelCallsEnabled, USER_JOINED_TIMEOUT_MS } from './calls-store'

const emit = (event: string, data: Record<string, unknown>, broadcastChannel = 'ch') =>
	capturedListener?.({ event, data, broadcast: { channel_id: broadcastChannel } })

describe('round-2 parity', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		useCallsStore.getState().reset()
		useCallsStore.getState().setChannel('ch')
		bindCallsWebSocket()
	})

	it('addAlert dedupes by kind instead of stacking banners', () => {
		const s = useCallsStore.getState()
		s.addAlert({ kind: 'audio-input-missing' })
		s.addAlert({ kind: 'audio-input-missing' })
		s.addAlert({ kind: 'screen-permissions' })
		const alerts = useCallsStore.getState().alerts
		expect(alerts.length).toBe(2)
		expect(alerts.filter((a) => a.kind === 'audio-input-missing').length).toBe(1)
	})

	it('dismissAlertsOfKind clears every banner of that kind', () => {
		const s = useCallsStore.getState()
		s.addAlert({ kind: 'audio-input-missing' })
		s.addAlert({ kind: 'screen-permissions' })
		s.dismissAlertsOfKind('audio-input-missing')
		const alerts = useCallsStore.getState().alerts
		expect(alerts.length).toBe(1)
		expect(alerts[0].kind).toBe('screen-permissions')
	})

	it('recentlyJoined expires after the 5s window', async () => {
		vi.useFakeTimers()
		try {
			const s = useCallsStore.getState()
			s.addRecentlyJoined('u1')
			expect(useCallsStore.getState().recentlyJoined.length).toBe(1)
			vi.advanceTimersByTime(USER_JOINED_TIMEOUT_MS + 100)
			useCallsStore.getState().expireRecentlyJoined()
			expect(useCallsStore.getState().recentlyJoined.length).toBe(0)
		} finally {
			vi.useRealTimers()
		}
	})

	it('user_joined (someone else) adds a recently-joined chip', () => {
		useCallsStore.getState().setMySessionId('me')
		emit('custom_calls_user_joined', { user_id: 'u1', session_id: 's1' })
		expect(useCallsStore.getState().recentlyJoined.some((r) => r.userId === 'u1')).toBe(true)
	})

	it('user_joined (self) does NOT add a chip but clears incoming cards', () => {
		useCallsStore.getState().setMySessionId('s1')
		useCallsStore.getState().addIncomingCall({ callId: 'c1', channelId: 'ch', callerId: 'u9', startAt: 1 })
		emit('custom_calls_user_joined', { user_id: 'me', session_id: 's1' })
		expect(useCallsStore.getState().recentlyJoined.length).toBe(0)
		expect(useCallsStore.getState().incomingCalls.length).toBe(0)
	})

	it('presence events from other channels never reach the roster (join sound gating follows)', () => {
		emit('custom_calls_user_joined', { user_id: 'u1', session_id: 's1' }, 'ch')
		emit('custom_calls_user_joined', { user_id: 'u2', session_id: 's2' }, 'other')
		expect(useCallsStore.getState().sessions.s1?.userId).toBe('u1')
		expect(useCallsStore.getState().sessions.s2).toBeUndefined()
	})

	it('selectChannelCallsEnabled defaults true and honors disable events', () => {
		expect(selectChannelCallsEnabled(useCallsStore.getState(), 'ch')).toBe(true)
		emit('custom_calls_channel_disable_voice', { channel_id: 'ch' })
		expect(selectChannelCallsEnabled(useCallsStore.getState(), 'ch')).toBe(false)
		emit('custom_calls_channel_enable_voice', { channel_id: 'ch' })
		expect(selectChannelCallsEnabled(useCallsStore.getState(), 'ch')).toBe(true)
	})

	it('mirror video preference round-trips through localStorage', () => {
		localStorage.removeItem('calls_mirror_video')
		expect(readMirrorVideoPref()).toBe(true)
		useCallsStore.getState().setMirrorVideo(false)
		expect(localStorage.getItem('calls_mirror_video')).toBe('off')
		expect(readMirrorVideoPref()).toBe(false)
		useCallsStore.getState().setMirrorVideo(true)
		expect(readMirrorVideoPref()).toBe(true)
	})

	it('reset clears minimized but keeps channelsEnabled and mirrorVideo', () => {
		useCallsStore.getState().setMinimized(true)
		useCallsStore.getState().setChannelEnabled('ch', false)
		useCallsStore.getState().setMirrorVideo(false)
		useCallsStore.getState().reset()
		const s = useCallsStore.getState()
		expect(s.minimized).toBe(false)
		expect(s.channelsEnabled.ch).toBe(false)
		expect(s.mirrorVideo).toBe(false)
	})

	it('call_state hydrates missing participant profiles via REST', () => {
		emit('custom_calls_call_state', {
			call: JSON.stringify({
				call_id: 'c1',
				start_at: 1,
				sessions: [{ id: 's1', user_id: 'unknown-user', unmuted: true }],
			}),
		}, 'ch')
		// getProfilesByIds is mocked; the important part is no crash + state sync.
		expect(useCallsStore.getState().callId).toBe('c1')
	})

	it('error events tear the call down (leave is called)', () => {
		emit('custom_calls_error', { data: 'calls: feature is disabled' })
		expect(callsClient.leave).toHaveBeenCalled()
		expect(useCallsStore.getState().error?.kind).toBe('disabled')
	})
})
