/**
 * Parity-feature tests — the calls store/events/client behaviors added to
 * close the gap with the Mattermost webapp Calls: reactions, host notices,
 * incoming-call tracking, config gating, share-audio preference, quality
 * classification.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const sendMock = vi.fn()
let capturedListener: ((msg: { event: string; data?: Record<string, unknown> }) => void) | undefined
let capturedReconnect: (() => void) | undefined

vi.mock('@/lib/chat/client', () => ({
	wsClient: {
		sendMessage: (action: string, data?: Record<string, unknown>) => sendMock(action, data),
		addMessageListener: (fn: (msg: { event: string; data?: Record<string, unknown> }) => void) => {
			capturedListener = fn
		},
		addReconnectListener: (fn: () => void) => {
			capturedReconnect = fn
		},
		initialize: vi.fn(),
	},
}))

vi.mock('./calls-client', async (importOriginal) => ({
	// Real module exports (shareAudioWithScreen etc.) for the preference tests.
	...(await importOriginal<typeof import('./calls-client')>()),
	callsClient: {
		signal: vi.fn(),
		handleJoinAck: vi.fn(),
		handleWSReconnect: vi.fn(),
		mute: vi.fn(),
		unmute: vi.fn(),
		stopScreenShare: vi.fn(),
		leave: vi.fn(),
		requestCallState: vi.fn(),
		sendReaction: vi.fn(),
	},
}))

import { useChatStore } from '@/lib/chat/store'
import { bindCallsWebSocket } from './calls-events'
import { callsClient } from './calls-client'
import {
	useCallsStore,
	MAX_REACTIONS,
	selectIsLimitRestricted,
	selectRaisedHands,
	DEFAULT_CALLS_CONFIG,
} from './calls-store'

const emit = (event: string, data: Record<string, unknown>) =>
	capturedListener?.({ event, data })

// ── Store: reactions ────────────────────────────────────────────────

describe('calls store reactions', () => {
	beforeEach(() => {
		useCallsStore.getState().reset()
	})

	it('addReaction appends with id/at and caps at MAX_REACTIONS', () => {
		const s = useCallsStore.getState()
		for (let i = 0; i < MAX_REACTIONS + 10; i++) {
			s.addReaction({ sessionId: `s${i}`, userId: `u${i}`, emoji: '👍', name: 'thumbsup' })
		}
		expect(useCallsStore.getState().reactions.length).toBe(MAX_REACTIONS)
		// Oldest were dropped (first survivor is s10 for cap 50).
		expect(useCallsStore.getState().reactions[0].sessionId).toBe('s10')
	})

	it('expireReaction removes by id', () => {
		const s = useCallsStore.getState()
		s.addReaction({ sessionId: 's1', userId: 'u1', emoji: '🎉', name: 'tada' })
		const id = useCallsStore.getState().reactions[0].id
		s.expireReaction(id)
		expect(useCallsStore.getState().reactions.length).toBe(0)
	})
})

// ── Store: notices ──────────────────────────────────────────────────

describe('calls store host notices', () => {
	beforeEach(() => {
		useCallsStore.getState().reset()
	})

	it('addNotice appends and expireNotice removes', () => {
		const s = useCallsStore.getState()
		s.addNotice({ kind: 'host-changed', actorUserId: 'u2', mine: false })
		expect(useCallsStore.getState().notices.length).toBe(1)
		const id = useCallsStore.getState().notices[0].id
		s.expireNotice(id)
		expect(useCallsStore.getState().notices.length).toBe(0)
	})
})

// ── Store: incoming calls ───────────────────────────────────────────

describe('calls store incoming calls', () => {
	beforeEach(() => {
		useCallsStore.getState().reset()
	})

	it('tracks, dedupes and dismisses incoming calls', () => {
		const s = useCallsStore.getState()
		s.addIncomingCall({ callId: 'c1', channelId: 'ch1', callerId: 'u1', startAt: 1 })
		s.addIncomingCall({ callId: 'c1', channelId: 'ch1', callerId: 'u1', startAt: 1 })
		expect(useCallsStore.getState().incomingCalls.length).toBe(1)

		s.dismissIncomingCall('c1')
		expect(useCallsStore.getState().incomingCalls.length).toBe(0)
		// Re-adding a dismissed call is ignored.
		s.addIncomingCall({ callId: 'c1', channelId: 'ch1', callerId: 'u1', startAt: 1 })
		expect(useCallsStore.getState().incomingCalls.length).toBe(0)
	})

	it('never rings into the same channel I am in', () => {
		const s = useCallsStore.getState()
		s.setChannel('ch1')
		s.setStatus('connected')
		s.addIncomingCall({ callId: 'c2', channelId: 'ch1', callerId: 'u9', startAt: 2 })
		expect(useCallsStore.getState().incomingCalls.length).toBe(0)
	})
})

// ── Store: config gating ────────────────────────────────────────────

describe('calls store config gating', () => {
	beforeEach(() => {
		useCallsStore.getState().reset()
	})

	it('setConfig merges over the defaults', () => {
		useCallsStore.getState().setConfig({ maxParticipants: 8, allowScreenSharing: false })
		const cfg = useCallsStore.getState().config
		expect(cfg.maxParticipants).toBe(8)
		expect(cfg.allowScreenSharing).toBe(false)
		expect(cfg.enableReactions).toBe(DEFAULT_CALLS_CONFIG.enableReactions)
	})

	it('selectIsLimitRestricted reflects the participant cap', () => {
		useCallsStore.getState().setConfig({ maxParticipants: 2 })
		expect(selectIsLimitRestricted(useCallsStore.getState())).toBe(false)
		useCallsStore.getState().upsertSession({ sessionId: 'a', userId: 'u1', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: false })
		useCallsStore.getState().upsertSession({ sessionId: 'b', userId: 'u2', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: false })
		expect(selectIsLimitRestricted(useCallsStore.getState())).toBe(true)
	})

	it('reset keeps config, devices and incoming calls (session-persistent state)', () => {
		useCallsStore.getState().setConfig({ maxParticipants: 5 })
		useCallsStore.getState().addIncomingCall({ callId: 'cx', channelId: 'chx', callerId: 'u1', startAt: 9 })
		useCallsStore.getState().upsertSession({ sessionId: 'a', userId: 'u1', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: false })
		useCallsStore.getState().reset()
		const s = useCallsStore.getState()
		expect(s.config.maxParticipants).toBe(5)
		expect(s.incomingCalls.length).toBe(1)
		expect(s.sessionOrder.length).toBe(0)
	})

	it('selectRaisedHands returns oldest-first raised hands', () => {
		const s = useCallsStore.getState()
		s.upsertSession({ sessionId: 'a', userId: 'u1', unmuted: true, raisedHand: 200, video: false, voice: false, screenOn: false, isHost: false })
		s.upsertSession({ sessionId: 'b', userId: 'u2', unmuted: true, raisedHand: 100, video: false, voice: false, screenOn: false, isHost: false })
		s.upsertSession({ sessionId: 'c', userId: 'u3', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: false })
		const hands = selectRaisedHands(useCallsStore.getState())
		expect(hands.map((h) => h.sessionId)).toEqual(['b', 'a'])
	})
})

// ── Events: reactions + notices + incoming ──────────────────────────

describe('calls event parity features', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		sendMock.mockClear()
		useCallsStore.getState().reset()
		// reset() deliberately keeps session-persistent state (incoming calls,
		// dismissals) — clear it for test isolation.
		useCallsStore.setState({ incomingCalls: [], dismissedCalls: {} })
		bindCallsWebSocket()
		// Seed a DM channel + another user for the incoming-call tests.
		const cur = useChatStore.getState() as unknown as Record<string, unknown>
		useChatStore.setState({
			...cur,
			channels: {
				...(cur.channels as Record<string, unknown>),
				'dm-ch1': { id: 'dm-ch1', type: 'D', display_name: '', name: 'u1__me' },
			},
			users: {
				...(cur.users as Record<string, unknown>),
				u9: { id: 'u9', username: 'nine', first_name: 'Nine', last_name: 'User' },
			},
		} as never)
	})

	it('user_reacted adds a reaction to the stream (when in the call)', () => {
		useCallsStore.getState().setChannel('ch1')
		emit('custom_calls_user_reacted', {
			user_id: 'u1',
			session_id: 's1',
			emoji: { name: 'tada', unified: '1f389', literal: '🎉' },
			timestamp: 123,
		})
		const reactions = useCallsStore.getState().reactions
		expect(reactions.length).toBe(1)
		expect(reactions[0].emoji).toBe('🎉')
		expect(reactions[0].userId).toBe('u1')
	})

	it('user_reacted with only a unified codepoint derives the literal', () => {
		useCallsStore.getState().setChannel('ch1')
		emit('custom_calls_user_reacted', {
			user_id: 'u2',
			session_id: 's2',
			emoji: { name: 'thumbsup', unified: '1f44d' },
			timestamp: 123,
		})
		expect(useCallsStore.getState().reactions[0]?.emoji).toBe('👍')
	})

	it('user_reacted outside a call is ignored', () => {
		emit('custom_calls_user_reacted', {
			user_id: 'u1',
			session_id: 's1',
			emoji: { name: 'tada', literal: '🎉' },
			timestamp: 123,
		})
		expect(useCallsStore.getState().reactions.length).toBe(0)
	})

	it('host_removed sets the host-removed error kind', () => {
		emit('custom_calls_host_removed', { channel_id: 'ch', session_id: 's' })
		expect(callsClient.leave).toHaveBeenCalled()
		expect(useCallsStore.getState().error?.kind).toBe('host-removed')
	})

	it('host_lower_hand clears the local flag and adds a notice', () => {
		useCallsStore.getState().toggleHand()
		expect(useCallsStore.getState().handRaised).toBe(true)
		emit('custom_calls_host_lower_hand', { channel_id: 'ch', session_id: 's' })
		expect(useCallsStore.getState().handRaised).toBe(false)
		expect(useCallsStore.getState().notices.some((n) => n.kind === 'lower-hand')).toBe(true)
	})

	it('call_host_changed emits a host-changed notice on change', () => {
		useCallsStore.getState().setChannel('ch')
		emit('custom_calls_user_joined', { user_id: 'u1', session_id: 's1' })
		emit('custom_calls_call_host_changed', { hostID: 'u1', call_id: 'c' })
		const s = useCallsStore.getState()
		expect(s.hostUserId).toBe('u1')
		// First host assignment: no prior host → no notice.
		emit('custom_calls_call_host_changed', { hostID: 'u2', call_id: 'c' })
		expect(useCallsStore.getState().notices.some((n) => n.kind === 'host-changed')).toBe(true)
	})

	it('error events classify max-participants and disabled errors', () => {
		emit('custom_calls_error', { data: 'calls: maximum participants reached' })
		expect(useCallsStore.getState().error?.kind).toBe('max-participants')

		emit('custom_calls_error', { data: 'calls: feature is disabled' })
		expect(useCallsStore.getState().error?.kind).toBe('disabled')
	})

	it('call_start in a DM channel creates an incoming call (ringing)', () => {
		emit('custom_calls_call_start', {
			channel_id: 'dm-ch1',
			call_id: 'c9',
			start_at: 5,
			owner_id: 'u9',
		})
		expect(useCallsStore.getState().incomingCalls.length).toBe(1)
		expect(useCallsStore.getState().incomingCalls[0].callerId).toBe('u9')
	})

	it('call_end removes the matching incoming call', () => {
		useCallsStore.getState().addIncomingCall({ callId: 'cz', channelId: 'chz', callerId: 'u1', startAt: 1 })
		emit('custom_calls_call_end', { channel_id: 'chz', call_id: 'cz', end_at: 9 })
		expect(useCallsStore.getState().incomingCalls.length).toBe(0)
	})
})

// ── Client: share-audio preference ──────────────────────────────────

describe('calls share-audio preference', () => {
	beforeEach(() => {
		try {
			localStorage.clear()
		} catch {
			/* ignore */
		}
	})

	it('defaults to sharing audio with screen and toggles', async () => {
		const { shareAudioWithScreen, setShareAudioWithScreen } = await import('./calls-client')
		expect(shareAudioWithScreen()).toBe(true)
		setShareAudioWithScreen(false)
		expect(shareAudioWithScreen()).toBe(false)
	})
})

// ── Quality classifier ──────────────────────────────────────────────

describe('quality classifier', () => {
	it('maps stats to coarse levels', async () => {
		const { classify } = await import('./calls-quality')
		expect(classify(30, 2, 0)).toBe('good')
		expect(classify(400, 60, 0.1)).toBe('poor')
		expect(classify(null, null, null)).toBe('good')
	})
})
