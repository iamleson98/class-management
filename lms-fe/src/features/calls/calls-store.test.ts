/**
 * Calls store tests — presence sync, session lifecycle, host tracking,
 * stream bookkeeping, and active-call markers.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useShallow } from 'zustand/react/shallow'
import { useCallsStore, selectRaisedHands } from './calls-store'

const store = () => useCallsStore.getState()

describe('useCallsStore', () => {
	beforeEach(() => {
		store().reset()
	})

	it('starts disconnected with no call', () => {
		const s = store()
		expect(s.status).toBe('disconnected')
		expect(s.channelId).toBeNull()
		expect(s.callId).toBeNull()
		expect(s.mySessionId).toBeNull()
	})

	it('upsertSession adds in order and updates in place', () => {
		store().upsertSession({ sessionId: 's1', userId: 'u1', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: true })
		store().upsertSession({ sessionId: 's2', userId: 'u2', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: false })
		// Update existing: order unchanged.
		store().upsertSession({ sessionId: 's1', userId: 'u1', unmuted: false, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: true })

		const s = store()
		expect(s.sessionOrder).toEqual(['s1', 's2'])
		expect(s.sessions.s1.unmuted).toBe(false)
		expect(Object.keys(s.sessions)).toHaveLength(2)
	})

	it('removeSession drops the session and its streams', () => {
		store().upsertSession({ sessionId: 's1', userId: 'u1', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: false })
		store().setVideoStream('s1', { id: 'x' } as unknown as MediaStream)
		store().setScreenStream('s1', { id: 'y' } as unknown as MediaStream)
		store().removeSession('s1')

		const s = store()
		expect(s.sessions.s1).toBeUndefined()
		expect(s.sessionOrder).toEqual([])
		expect(s.videoStreams.s1).toBeUndefined()
		expect(s.screenStream).toBeNull() // was the sharer's stream
	})

	it('syncCallState maps snake_case payload and resolves the host', () => {
		store().syncCallState({
			callId: 'call-1',
			startAt: 1234,
			hostSessionId: 'sess2',
			sessions: [
				{ id: 'sess1', user_id: 'u1', unmuted: true, voice_on: true, screen_on: false, video_on: false },
				{ id: 'sess2', user_id: 'u2', unmuted: false, voice_on: false, screen_on: true, video_on: true, is_host: true },
			],
		})

		const s = store()
		expect(s.callId).toBe('call-1')
		expect(s.startAt).toBe(1234)
		expect(s.hostUserId).toBe('u2')
		// hostSessionId overrides the payload's is_host flags
		expect(s.sessions.sess1.isHost).toBe(false)
		expect(s.sessions.sess2.isHost).toBe(true)
		// field mapping
		expect(s.sessions.sess1.voice).toBe(true)
		expect(s.sessions.sess2.screenOn).toBe(true)
		expect(s.sessions.sess2.video).toBe(true)
	})

	it('presence toggles update only the target session', () => {
		store().upsertSession({ sessionId: 'a', userId: 'ua', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: false })
		store().upsertSession({ sessionId: 'b', userId: 'ub', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: false })

		store().setSessionUnmuted('a', false)
		store().setSessionVoice('a', true)
		store().setSessionVideo('b', true)
		store().setSessionHand('a', 999)

		const s = store()
		expect(s.sessions.a.unmuted).toBe(false)
		expect(s.sessions.a.voice).toBe(true)
		expect(s.sessions.a.raisedHand).toBe(999)
		expect(s.sessions.b.video).toBe(true)
		expect(s.sessions.b.unmuted).toBe(true)
	})

	it('setSessionScreen enforces a single sharer', () => {
		store().upsertSession({ sessionId: 'a', userId: 'ua', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: false })
		store().upsertSession({ sessionId: 'b', userId: 'ub', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: false })

		store().setSessionScreen('a', true)
		expect(store().sessions.a.screenOn).toBe(true)

		store().setSessionScreen('b', true)
		expect(store().sessions.a.screenOn).toBe(false)
		expect(store().sessions.b.screenOn).toBe(true)
	})

	it('setHostUserId re-tags isHost across sessions', () => {
		store().upsertSession({ sessionId: 'a', userId: 'ua', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: true })
		store().upsertSession({ sessionId: 'b', userId: 'ub', unmuted: true, raisedHand: 0, video: false, voice: false, screenOn: false, isHost: false })

		store().setHostUserId('ub')
		const s = store()
		expect(s.hostUserId).toBe('ub')
		expect(s.sessions.a.isHost).toBe(false)
		expect(s.sessions.b.isHost).toBe(true)
	})

	it('reset keeps activeCalls (join buttons survive my call ending)', () => {
		store().markActiveCall('ch1', { callId: 'c1', startAt: 1 })
		store().setChannel('ch1')
		store().setStatus('connected')
		store().reset()

		const s = store()
		expect(s.channelId).toBeNull()
		expect(s.status).toBe('disconnected')
		expect(s.activeCalls.ch1).toEqual({ callId: 'c1', startAt: 1 })
	})

	it('markActiveCall(null) clears the channel marker', () => {
		store().markActiveCall('ch1', { callId: 'c1', startAt: 1 })
		store().markActiveCall('ch1', null)
		expect(store().activeCalls.ch1).toBeUndefined()
	})
})

describe('selector snapshot stability (React #185 regression)', () => {
	// useSyncExternalStore requires getSnapshot to return the same reference
	// across calls while state is unchanged; a selector that derives a fresh
	// array forces a re-render on EVERY commit and crashes React with
	// "Maximum update depth exceeded" (#185) — this is what made the call
	// widget blow up the moment it mounted.
	const handSession = (raisedHand: number) => ({
		sessionId: 'h1', userId: 'u1', unmuted: true, raisedHand,
		video: false, voice: false, screenOn: false, isHost: false,
	})

	it('raw selectRaisedHands is UNSTABLE (documents the bug)', () => {
		store().upsertSession(handSession(123))
		const a = selectRaisedHands(useCallsStore.getState())
		const b = selectRaisedHands(useCallsStore.getState())
		expect(a).not.toBe(b) // fresh array per call — must NOT be fed to useStore raw
	})

	it('useShallow-wrapped selectRaisedHands is snapshot-stable', () => {
		store().upsertSession(handSession(123))
		const { result, rerender } = renderHook(() => useCallsStore(useShallow(selectRaisedHands)))
		const a = result.current
		rerender()
		expect(result.current).toBe(a)
		rerender()
		expect(result.current).toBe(a)
	})

	it('useShallow still surfaces content changes with a new reference', () => {
		store().upsertSession(handSession(123))
		const { result, rerender } = renderHook(() => useCallsStore(useShallow(selectRaisedHands)))
		const before = result.current
		store().setSessionHand('h1', 456)
		rerender()
		expect(result.current).not.toBe(before)
		expect(result.current[0].raisedHand).toBe(456)
		// …and it re-stabilizes on subsequent renders.
		const after = result.current
		rerender()
		expect(result.current).toBe(after)
	})
})
