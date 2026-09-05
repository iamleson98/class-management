/**
 * CallErrorModal tests — the modal is the ONLY place a failed join is
 * explained to the user (server errors are invisible in the browser
 * console), so it must: offer re-join for rejoinable kinds using the channel
 * captured BEFORE the teardown reset, and surface the server's raw error
 * string when it adds information beyond the canned copy.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const joinMock = vi.fn()
vi.mock('./calls-client', () => ({
        callsClient: { join: (ch: string) => joinMock(ch) },
}))

import { CallErrorModal } from './call-error-modal'
import { useCallsStore } from './calls-store'

describe('CallErrorModal', () => {
        beforeEach(() => {
                vi.clearAllMocks()
                useCallsStore.getState().reset()
        })

        it('offers re-join using the channel preserved on the error', () => {
                useCallsStore.getState().setChannel('ch-live')
                useCallsStore.getState().setError({
                        message: 'boom',
                        kind: 'generic',
                        // Simulates the events handler: reset() nulls the store
                        // channel, the error carries the pre-leave copy.
                        channelId: 'ch-before-leave',
                })
                useCallsStore.getState().setChannel(null)

                render(<CallErrorModal />)
                fireEvent.click(screen.getByRole('button', { name: /Tham gia lại/i }))
                expect(joinMock).toHaveBeenCalledWith('ch-before-leave')
                // Re-join clears the error state.
                expect(useCallsStore.getState().error).toBeNull()
        })

        it('shows the server message for non-sentinel errors', () => {
                useCallsStore.getState().setError({
                        message: 'calls: no rtcd host available: no healthy rtcd host available',
                        kind: 'disabled',
                        channelId: 'ch1',
                })
                render(<CallErrorModal />)
                expect(screen.getByText(/no healthy rtcd host available/i)).toBeInTheDocument()
        })

        it('hides the detail line for sentinel client-side messages', () => {
                useCallsStore.getState().setError({
                        message: 'timed out waiting for rtc connection',
                        kind: 'rtc-timeout',
                        channelId: 'ch1',
                })
                render(<CallErrorModal />)
                expect(screen.queryByText(/timed out waiting/i)).not.toBeInTheDocument()
        })

        it('non-rejoinable kinds (host removal) render only the close action', () => {
                useCallsStore.getState().setError({ message: 'host-removed', kind: 'host-removed' })
                render(<CallErrorModal />)
                expect(screen.queryByRole('button', { name: /Tham gia lại/i })).not.toBeInTheDocument()
                expect(screen.getByRole('button', { name: /Đóng/i })).toBeInTheDocument()
        })
})
