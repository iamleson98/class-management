/**
 * Tests for ChannelCallToast's REST reconciliation.
 *
 * The toast polls GET /api/v4/calls/{callId} every 15s to resolve the
 * participant avatars for channels with an in-progress call the user is NOT
 * in. When the server answers 404 the call no longer exists (it ended while
 * the call_end broadcast was missed — e.g. the server restarted and lost the
 * in-memory registry), so the stale entry must be cleared: otherwise the
 * toast advertises a dead call forever and the console fills with 404s.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { ChannelCallToast } from './channel-call-toast'
import { useCallsStore } from './calls-store'

vi.mock('@/lib/i18n', () => ({
        useTranslation: () => ({ t: (_k: string, fallback?: string) => fallback ?? _k }),
}))

vi.mock('@/lib/chat/store', () => ({
        useChatStore: (selector: (s: { users: Record<string, unknown> }) => unknown) => selector({ users: {} }),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

/** Minimal Response-like object — only the fields the toast reads. */
const res = (ok: boolean, status: number, body: unknown = {}) =>
        ({ ok, status, json: async () => body }) as unknown as Response

describe('ChannelCallToast', () => {
        afterEach(() => {
                cleanup()
        })

        beforeEach(() => {
                useCallsStore.getState().reset()
                useCallsStore.getState().markActiveCall('ch-1', null)
                useCallsStore.getState().markActiveCall('ch-1', { callId: 'call-xyz', startAt: Date.now() })
                fetchMock.mockReset()
        })

        it('renders the join toast for a channel with an in-progress call', async () => {
                fetchMock.mockResolvedValue(res(true, 200, { sessions: [{ user_id: 'u1' }, { user_id: 'u2' }] }))
                render(<ChannelCallToast channelId="ch-1" />)

                expect(screen.getByRole('status')).toBeTruthy()
                expect(screen.getByText('Tham gia cuộc gọi')).toBeTruthy()
                await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v4/calls/call-xyz', expect.anything()))
        })

        it('a 404 clears the stale call so the toast disappears', async () => {
                fetchMock.mockResolvedValue(res(false, 404, { message: 'not found' }))
                render(<ChannelCallToast channelId="ch-1" />)

                await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v4/calls/call-xyz', expect.anything()))

                // The store entry is gone and the toast unmounts with it.
                await waitFor(() => expect(useCallsStore.getState().activeCalls['ch-1']).toBeUndefined())
                await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
        })

        it('transient network errors keep the toast (best-effort polling, no clearing)', async () => {
                fetchMock.mockRejectedValue(new Error('offline'))
                render(<ChannelCallToast channelId="ch-1" />)

                await waitFor(() => expect(fetchMock).toHaveBeenCalled())
                expect(screen.getByRole('status')).toBeTruthy()
                expect(useCallsStore.getState().activeCalls['ch-1']).toBeDefined()
        })

        it('a non-404 failure (e.g. 503) keeps the toast — the call may still be live', async () => {
                fetchMock.mockResolvedValue(res(false, 503))
                render(<ChannelCallToast channelId="ch-1" />)

                await waitFor(() => expect(fetchMock).toHaveBeenCalled())
                expect(screen.getByRole('status')).toBeTruthy()
                expect(useCallsStore.getState().activeCalls['ch-1']).toBeDefined()
        })
})
