/**
 * Regression tests for the "call screen dies immediately" bug.
 *
 * Root cause history: ReactionStream subscribed with
 * `useCallsStore(selectRaisedHands)` — a selector that returns a NEW array on
 * every snapshot read. With zustand v5 (React 19 useSyncExternalStore) an
 * unstable getSnapshot drives React into its nested-update guard:
 * "Maximum update depth exceeded" (minified React error #185), which unmounts
 * the whole tree — the call screen included — the instant the CallWidget
 * mounts. These tests pin both the fixed component and the guard rule.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactionStream } from './reaction-stream'
import { useCallsStore } from './calls-store'

describe('ReactionStream mount stability (React #185 regression)', () => {
        beforeEach(() => {
                useCallsStore.setState({
                        sessions: {},
                        sessionOrder: [],
                        reactions: [],
                })
        })

        it('mounts without throwing (no infinite re-render loop)', () => {
                expect(() => render(<ReactionStream />)).not.toThrow()
        })

        it('mounts with participants present without throwing', () => {
                useCallsStore.getState().upsertSession({
                        sessionId: 's1',
                        userId: 'u1',
                        unmuted: true,
                        raisedHand: Date.now(),
                        video: false,
                        voice: true,
                        screenOn: false,
                        isHost: false,
                })
                expect(() => render(<ReactionStream />)).not.toThrow()
        })
})
