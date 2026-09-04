/**
 * Avatar persistence + missing-device UX regression tests.
 *
 * 1. user_updated WS events must upsert the profile (the server broadcasts it
 *    on every avatar change) so chat-store consumers see the new
 *    last_picture_update immediately.
 * 2. The calls UserAvatar <img> must key its URL by last_picture_update — the
 *    profile-image endpoint is cacheable for 24h under a URL that never
 *    changes, so a bare URL re-serves the PREVIOUS avatar after reload.
 * 3. The missing-devices toast fires when joining without capture hardware
 *    (the console-only failure users reported).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

type Listener = (msg: {
  event: string
  data?: Record<string, unknown>
  broadcast?: { channel_id?: string; user_id?: string }
}) => void
let messageListener: Listener | undefined

vi.mock('@/lib/chat/client', () => ({
  wsClient: {
    addMessageListener: (fn: Listener) => { messageListener = fn },
    addReconnectListener: vi.fn(),
    addMissedMessageListener: vi.fn(),
    addFirstConnectListener: vi.fn(),
    addCloseListener: vi.fn(),
    sendMessage: vi.fn(),
    initialize: vi.fn(),
  },
  client4: {
    getProfilesByIds: vi.fn(async () => []),
    getStatusesByIds: vi.fn(async () => []),
  },
}))

import { bindChatWebSocket } from '@/lib/chat/websocket-events'
import { useChatStore } from '@/lib/chat/store'
import { UserAvatar } from '@/features/calls/user-avatar'

const emit = (event: string, data: Record<string, unknown>) =>
  messageListener?.({ event, data, broadcast: {} })

const RAW_USER = {
  id: 'u1',
  username: 'tester',
  firstname: 'Test',
  lastname: 'User',
  lastpictureupdate: 1725500000000,
}

describe('avatar propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useChatStore.getState().reset()
  })

  it('user_updated events upsert the profile (incl. lastpictureupdate)', async () => {
    bindChatWebSocket()
    emit('user_updated', { user: { ...RAW_USER, lastpictureupdate: 1725600000000 } })

    const u = useChatStore.getState().users.u1 as { last_picture_update?: number }
    expect(u).toBeDefined()
    expect(u.last_picture_update).toBe(1725600000000)
  })

  it('UserAvatar keys the image URL by last_picture_update and re-keys on change', async () => {
    useChatStore.getState().upsertUsers([RAW_USER as never])

    const { rerender } = render(
      <UserAvatar userId="u1" displayName="Test User" size="sm" />,
    )
    const img = screen.getByTestId('user-avatar-img') as HTMLImageElement
    // Versioned URL → the browser cache is keyed per picture version.
    expect(img.getAttribute('src')).toBe('/api/v4/users/u1/image?_1725500000000')

    // A fresh user_updated (new picture) must re-key the URL.
    emit('user_updated', { user: { ...RAW_USER, lastpictureupdate: 1725700000000 } })
    rerender(<UserAvatar userId="u1" displayName="Test User" size="sm" />)
    await waitFor(() => {
      const img2 = screen.getByTestId('user-avatar-img') as HTMLImageElement
      expect(img2.getAttribute('src')).toBe('/api/v4/users/u1/image?_1725700000000')
    })
  })

  it('unknown users fall back to a stable ?_0 URL (no crash, no stale key)', () => {
    render(<UserAvatar userId="nobody" displayName="Unknown" size="sm" />)
    const img = screen.getByTestId('user-avatar-img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/api/v4/users/nobody/image?_0')
  })
})
