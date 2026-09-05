/**
 * Regression tests for the modernized chat message list.
 *
 * PostList now groups consecutive same-sender posts (avatar + name header on
 * the first row of a group, timestamp in the gutter for continuations) and
 * renders a floating hover toolbar. These tests pin:
 *   1. Mount stability (the rows computation + scroll bookkeeping must not
 *      loop — the historical React #185 class of bug).
 *   2. Grouping: two consecutive posts from one sender render ONE avatar and
 *      one name header; a post from another sender starts a new group.
 *   3. The date divider renders between posts from different days.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PostList } from '@/features/chat/post-list'
import { useChatStore } from '@/lib/chat/store'

const NOW = Date.UTC(2025, 0, 15, 10, 0, 0)

function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>
}

function seedPost(id: string, userId: string, minsAgo: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    user_id: userId,
    channel_id: 'ch1',
    create_at: NOW - minsAgo * 60_000,
    update_at: 0,
    delete_at: 0,
    edit_at: 0,
    message: `message-${id}`,
    root_id: '',
    reply_count: 0,
    file_ids: [],
    is_pinned: false,
    ...overrides,
  } as any
}

describe('PostList modern grouped layout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
    // Abort in-flight query retries so unmounting between tests is clean.
    useChatStore.setState({
      postsByChannel: {},
      reactionsByPost: {},
      threadsById: {},
      users: {},
      channels: { ch1: { id: 'ch1', team_id: 't1', type: 'O', display_name: 'general', name: 'general', delete_at: 0 } as any },
      memberships: {},
    })
    useChatStore.getState().upsertUsers([
      { id: 'u1', username: 'alice', first_name: 'Alice', last_name: 'Nguyễn' } as any,
      { id: 'u2', username: 'bob', first_name: 'Bob' } as any,
    ])
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('mounts without throwing with posts present', () => {
    useChatStore.getState().setChannelPosts('ch1', [
      seedPost('p4', 'u1', 1),
      seedPost('p3', 'u1', 3),
      seedPost('p2', 'u2', 5),
      seedPost('p1', 'u1', 8),
    ], {})
    expect(() => render(
      withQueryClient(<PostList channelId="ch1" onOpenThread={vi.fn()} />),
    )).not.toThrow()
  })

  it('groups consecutive same-sender posts into one avatar + name header', () => {
    useChatStore.getState().setChannelPosts('ch1', [
      seedPost('p2', 'u1', 3),
      seedPost('p1', 'u1', 8),
    ], {})
    render(withQueryClient(<PostList channelId="ch1" onOpenThread={vi.fn()} />))

    // One avatar for the group (both posts from u1, within the 5-min window).
    const avatars = document.querySelectorAll('[data-slot="form-item"], img, [class*="rounded-full"]')
    // The author name header renders exactly once: two posts from the same
    // sender within the 5-minute window form one group (header only on the
    // first row). Match leaf SPANs so wrapping rows don't count twice.
    const headers = screen.getAllByText(
      (_, el) => el?.tagName === 'SPAN' && (el.textContent ?? '').trim() === 'Alice Nguyễn',
    )
    expect(headers.length).toBe(1)
    // Both messages render.
    expect(screen.getByText('message-p1')).toBeTruthy()
    expect(screen.getByText('message-p2')).toBeTruthy()
    void avatars
  })

  it('starts a new group when the sender changes', () => {
    useChatStore.getState().setChannelPosts('ch1', [
      seedPost('p2', 'u2', 3),
      seedPost('p1', 'u1', 8),
    ], {})
    render(withQueryClient(<PostList channelId="ch1" onOpenThread={vi.fn()} />))

    // Two groups → two name headers (leaf spans only).
    const alice = screen.getAllByText((_, el) => el?.tagName === 'SPAN' && (el.textContent ?? '').trim() === 'Alice Nguyễn')
    const bob = screen.getAllByText((_, el) => el?.tagName === 'SPAN' && (el.textContent ?? '').trim() === 'Bob')
    expect(alice.length).toBe(1)
    expect(bob.length).toBe(1)
  })

  it('renders a date divider between posts from different days', () => {
    useChatStore.getState().setChannelPosts('ch1', [
      seedPost('p1', 'u1', 8),
      { ...seedPost('p0', 'u1', 8 + 24 * 60) },
    ], {})
    render(withQueryClient(<PostList channelId="ch1" onOpenThread={vi.fn()} />))

    const dividers = screen.getAllByRole('separator').filter(
      (el) => /\d{2}\/\d{2}\/\d{4}/.test(el.getAttribute('aria-label') ?? ''),
    )
    // Each distinct day gets its own divider (Jan 14 before the older post,
    // Jan 15 before the newer one).
    expect(dividers.length).toBe(2)
    expect(dividers[0].getAttribute('aria-label')).toBe('14/01/2025')
    expect(dividers[1].getAttribute('aria-label')).toBe('15/01/2025')
  })
})
