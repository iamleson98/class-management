/**
 * Chat real-time store (Zustand).
 *
 * Holds the slice of Mattermost state lms-fe's chat UI needs — the same shape
 * the old webapp kept in Redux, but scoped to class channels. Mutated by the
 * WebSocket event dispatcher (websocket-events.ts) and by REST mutations.
 *
 * Posts are kept per channel as an id→Post map plus an ordered id list
 * (newest-first, mirroring the server's `order`). Each channel also tracks
 * the prev/next post-id boundaries returned by the paginated REST calls, so
 * "load older / newer" knows when it has reached the ends.
 */

import { create } from 'zustand'
import type {
  ChatChannel,
  ChatChannelMember,
  ChatPost,
  ChatReaction,
  ChatUser,
  ChatFileInfo,
  PresenceStatus,
} from './types'

// ─── Store state shape ──────────────────────────────────────────────

interface ChannelPosts {
  /** id → post, for O(1) lookup + dedupe. */
  byId: Record<string, ChatPost>
  /** Ordered post ids, newest-first (server order). */
  order: string[]
  /** Cursor for loading older messages ('' = at oldest). */
  prevPostId: string
  /** Cursor for loading newer messages ('' = at newest). */
  nextPostId: string
  /** True while a page is loading (older or newest). */
  loading: boolean
}

interface TypingEntry {
  userId: string
  at: number
}

interface ChatCategory {
  id: string
  team_id: string
  type: string // 'favorites' | 'channels' | 'direct_messages' | 'custom' | 'managed'
  display_name: string
  sorting: string
  channel_ids: string[]
  muted: boolean
  collapsed: boolean
}

interface ChatBookmark {
  id: string
  channel_id: string
  display_name: string
  link_url?: string
  emoji?: string
  sort_order: number
  type: string // 'link' | 'file'
  file_id?: string
}

interface ChatState {
  connected: boolean
  /** WS connection id (from the hello event); needed for the Connection-Id header on bookmark mutations. */
  connectionId: string
  activeChannelId: string | null
  activeThreadRootId: string | null

  teams: { id: string; display_name: string; name: string }[]
  channels: Record<string, ChatChannel>
  /** Sidebar categories per team: { [teamId]: { categories: ChatCategory[], order: string[] } }. */
  categoriesByTeam: Record<string, { categories: ChatCategory[]; order: string[] }>
  /** Channel bookmarks per channel. */
  bookmarksByChannel: Record<string, ChatBookmark[]>
  /** channel id → my membership (msg_count, mention_count, last_viewed_at…). */
  memberships: Record<string, ChatChannelMember>
  /**
   * channel id → locally-tracked unread message count. Seeded from
   * membership (total - msg_count isn't directly available, so we track
   * increments from WS `posted` events and reset on mark-read). This keeps
   * the badge live without a separate totals fetch.
   */
  unreadByChannel: Record<string, number>

  users: Record<string, ChatUser>
  statuses: Record<string, PresenceStatus>

  postsByChannel: Record<string, ChannelPosts>
  reactionsByPost: Record<string, ChatReaction[]>

  /** Saved/flagged post ids (from preferences) — drives the saved-messages view. */
  flagged: Set<string>

  /** `${channelId}:${rootId}` → list of typing users with timestamps. */
  typing: Record<string, TypingEntry[]>

  // ── actions ──
  setConnected: (connected: boolean) => void
  setConnectionId: (connectionId: string) => void
  setActiveChannel: (channelId: string | null) => void
  setActiveThread: (rootId: string | null) => void

  setTeams: (teams: ChatState['teams']) => void
  upsertChannels: (channels: ChatChannel[]) => void
  setMemberships: (memberships: ChatChannelMember[]) => void
  upsertMembership: (membership: ChatChannelMember) => void
  /** Increment a channel's unread count (WS posted while channel inactive). */
  incrementUnread: (channelId: string, delta: number) => void
  /** Bulk-set unread counts (seeded from membership on channel load). */
  setUnread: (map: Record<string, number>) => void
  /** Reset a channel's unread count to 0 (on mark-read). */
  clearUnread: (channelId: string) => void
  removeChannel: (channelId: string) => void

  setCategories: (teamId: string, categories: ChatCategory[], order: string[]) => void
  setBookmarks: (channelId: string, bookmarks: ChatBookmark[]) => void
  upsertBookmark: (bookmark: ChatBookmark) => void
  removeBookmark: (channelId: string, bookmarkId: string) => void

  upsertUsers: (users: ChatUser[]) => void
  setStatuses: (statuses: Record<string, PresenceStatus>) => void
  setStatus: (userId: string, status: PresenceStatus) => void

  /** Initialize/replace a channel's posts from a PostList-style payload. */
  setChannelPosts: (
    channelId: string,
    posts: ChatPost[],
    opts: { prevPostId?: string; nextPostId?: string; reset?: boolean },
  ) => void
  /** Prepend older posts (scroll up). */
  prependPosts: (channelId: string, posts: ChatPost[], prevPostId?: string) => void
  upsertPost: (post: ChatPost) => void
  editPost: (post: ChatPost) => void
  deletePost: (postId: string) => void
  setChannelPostsLoading: (channelId: string, loading: boolean) => void

  setReactions: (postId: string, reactions: ChatReaction[]) => void
  addReaction: (reaction: ChatReaction) => void
  removeReaction: (postId: string, userId: string, emojiName: string) => void

  setTyping: (channelId: string, rootId: string, userId: string) => void
  clearTyping: (channelId: string, rootId: string, userId?: string) => void

  setFlagged: (ids: Set<string>) => void

  reset: () => void
}

const emptyChannelPosts = (): ChannelPosts => ({ byId: {}, order: [], prevPostId: '', nextPostId: '', loading: false })

/** Insert/refresh a post in a channel's ordered list (newest-first). */
function upsertOrdered(cp: ChannelPosts, post: ChatPost): ChannelPosts {
  const byId = { ...cp.byId, [post.id]: post }
  let order = cp.order
  if (!order.includes(post.id)) {
    // New post → place at front (newest-first). Edits keep their position.
    order = [post.id, ...order]
  }
  return { ...cp, byId, order }
}

export const useChatStore = create<ChatState>((set, get) => ({
  connected: false,
  connectionId: '',
  activeChannelId: null,
  activeThreadRootId: null,
  teams: [],
  channels: {},
  categoriesByTeam: {},
  bookmarksByChannel: {},
  memberships: {},
  unreadByChannel: {},
  users: {},
  statuses: {},
  postsByChannel: {},
  reactionsByPost: {},
  flagged: new Set<string>(),
  typing: {},

  setConnected: (connected) => set({ connected }),
  setConnectionId: (connectionId) => set({ connectionId }),

  setActiveChannel: (channelId) => set({ activeChannelId: channelId, activeThreadRootId: null }),
  setActiveThread: (rootId) => set({ activeThreadRootId: rootId }),

  setTeams: (teams) => set({ teams }),
  upsertChannels: (channels) =>
    set((s) => {
      const next = { ...s.channels }
      for (const c of channels) next[c.id] = c
      return { channels: next }
    }),
  setMemberships: (memberships) =>
    set((s) => {
      const next = { ...s.memberships }
      for (const m of memberships) next[m.channel_id] = m
      return { memberships: next }
    }),
  upsertMembership: (membership) =>
    set((s) => ({ memberships: { ...s.memberships, [membership.channel_id]: membership } })),
  incrementUnread: (channelId, delta) =>
    set((s) => ({ unreadByChannel: { ...s.unreadByChannel, [channelId]: Math.max(0, (s.unreadByChannel[channelId] ?? 0) + delta) } })),
  setUnread: (map) => set((s) => ({ unreadByChannel: { ...s.unreadByChannel, ...map } })),
  clearUnread: (channelId) =>
    set((s) => {
      const unreadByChannel = { ...s.unreadByChannel }
      unreadByChannel[channelId] = 0
      return { unreadByChannel }
    }),
  removeChannel: (channelId) =>
    set((s) => {
      const channels = { ...s.channels }
      const memberships = { ...s.memberships }
      const unreadByChannel = { ...s.unreadByChannel }
      const postsByChannel = { ...s.postsByChannel }
      delete channels[channelId]
      delete memberships[channelId]
      delete unreadByChannel[channelId]
      delete postsByChannel[channelId]
      return { channels, memberships, unreadByChannel, postsByChannel }
    }),

  setCategories: (teamId, categories, order) =>
    set((s) => ({
      categoriesByTeam: { ...s.categoriesByTeam, [teamId]: { categories, order } },
    })),
  setBookmarks: (channelId, bookmarks) =>
    set((s) => ({ bookmarksByChannel: { ...s.bookmarksByChannel, [channelId]: bookmarks } })),
  upsertBookmark: (bookmark) =>
    set((s) => {
      const existing = s.bookmarksByChannel[bookmark.channel_id] ?? []
      const filtered = existing.filter((b) => b.id !== bookmark.id)
      return {
        bookmarksByChannel: {
          ...s.bookmarksByChannel,
          [bookmark.channel_id]: [...filtered, bookmark].sort((a, b) => a.sort_order - b.sort_order),
        },
      }
    }),
  removeBookmark: (channelId, bookmarkId) =>
    set((s) => ({
      bookmarksByChannel: {
        ...s.bookmarksByChannel,
        [channelId]: (s.bookmarksByChannel[channelId] ?? []).filter((b) => b.id !== bookmarkId),
      },
    })),

  upsertUsers: (users) =>
    set((s) => {
      const next = { ...s.users }
      for (const u of users) next[u.id] = u
      return { users: next }
    }),
  setStatuses: (statuses) => set((s) => ({ statuses: { ...s.statuses, ...statuses } })),
  setStatus: (userId, status) => set((s) => ({ statuses: { ...s.statuses, [userId]: status } })),

  setChannelPosts: (channelId, posts, opts) =>
    set((s) => {
      const existing = opts.reset ? emptyChannelPosts() : s.postsByChannel[channelId] ?? emptyChannelPosts()
      let cp: ChannelPosts = { ...existing, byId: { ...existing.byId } }
      for (const p of posts) cp = upsertOrdered(cp, p)
      // Sort by create_at descending (newest-first) for a stable order.
      cp.order = cp.order
        .slice()
        .sort((a, b) => (cp.byId[b]?.create_at ?? 0) - (cp.byId[a]?.create_at ?? 0))
      if (opts.prevPostId !== undefined) cp.prevPostId = opts.prevPostId
      if (opts.nextPostId !== undefined) cp.nextPostId = opts.nextPostId
      return { postsByChannel: { ...s.postsByChannel, [channelId]: cp } }
    }),

  prependPosts: (channelId, posts, prevPostId) =>
    set((s) => {
      const existing = s.postsByChannel[channelId] ?? emptyChannelPosts()
      let cp: ChannelPosts = { ...existing, byId: { ...existing.byId } }
      for (const p of posts) cp = upsertOrdered(cp, p)
      cp.order = cp.order
        .slice()
        .sort((a, b) => (cp.byId[b]?.create_at ?? 0) - (cp.byId[a]?.create_at ?? 0))
      if (prevPostId !== undefined) cp.prevPostId = prevPostId
      return { postsByChannel: { ...s.postsByChannel, [channelId]: cp } }
    }),

  upsertPost: (post) =>
    set((s) => {
      const cp = s.postsByChannel[post.channel_id] ?? emptyChannelPosts()
      return { postsByChannel: { ...s.postsByChannel, [post.channel_id]: upsertOrdered(cp, post) } }
    }),

  editPost: (post) =>
    set((s) => {
      const cp = s.postsByChannel[post.channel_id] ?? emptyChannelPosts()
      if (!cp.byId[post.id]) return s
      return {
        postsByChannel: {
          ...s.postsByChannel,
          [post.channel_id]: { ...cp, byId: { ...cp.byId, [post.id]: { ...cp.byId[post.id], ...post } } },
        },
      }
    }),

  deletePost: (postId) =>
    set((s) => {
      // Find which channel the post is in.
      for (const [channelId, cp] of Object.entries(s.postsByChannel)) {
        if (cp.byId[postId]) {
          const byId = { ...cp.byId }
          const existing = byId[postId]
          byId[postId] = { ...existing, delete_at: Date.now(), message: '', file_ids: [] }
          return { postsByChannel: { ...s.postsByChannel, [channelId]: { ...cp, byId } } }
        }
      }
      return s
    }),

  setChannelPostsLoading: (channelId, loading) =>
    set((s) => {
      const cp = s.postsByChannel[channelId] ?? emptyChannelPosts()
      return { postsByChannel: { ...s.postsByChannel, [channelId]: { ...cp, loading } } }
    }),

  setReactions: (postId, reactions) =>
    set((s) => ({ reactionsByPost: { ...s.reactionsByPost, [postId]: reactions } })),
  addReaction: (reaction) =>
    set((s) => {
      const existing = s.reactionsByPost[reaction.post_id] ?? []
      // De-dupe: one reaction per (user, emoji) per post.
      const filtered = existing.filter(
        (r) => !(r.user_id === reaction.user_id && r.emoji_name === reaction.emoji_name),
      )
      return { reactionsByPost: { ...s.reactionsByPost, [reaction.post_id]: [...filtered, reaction] } }
    }),
  removeReaction: (postId, userId, emojiName) =>
    set((s) => {
      const existing = s.reactionsByPost[postId] ?? []
      return {
        reactionsByPost: {
          ...s.reactionsByPost,
          [postId]: existing.filter((r) => !(r.user_id === userId && r.emoji_name === emojiName)),
        },
      }
    }),

  setTyping: (channelId, rootId, userId) =>
    set((s) => {
      const key = `${channelId}:${rootId || ''}`
      const now = Date.now()
      // Drop stale (>4s) and the same user, then add the fresh entry.
      const fresh = (s.typing[key] ?? []).filter((e) => now - e.at < 4000 && e.userId !== userId)
      return { typing: { ...s.typing, [key]: [...fresh, { userId, at: now }] } }
    }),
  clearTyping: (channelId, rootId, userId) =>
    set((s) => {
      const key = `${channelId}:${rootId || ''}`
      const existing = s.typing[key] ?? []
      const filtered = userId ? existing.filter((e) => e.userId !== userId) : []
      const next = { ...s.typing }
      if (filtered.length === 0) delete next[key]
      else next[key] = filtered
      return { typing: next }
    }),

  setFlagged: (ids) => set({ flagged: new Set(ids) }),

  reset: () =>
    set({
      connected: false,
      connectionId: '',
      activeChannelId: null,
      activeThreadRootId: null,
      teams: [],
      channels: {},
      categoriesByTeam: {},
      bookmarksByChannel: {},
      memberships: {},
      unreadByChannel: {},
      users: {},
      statuses: {},
      flagged: new Set<string>(),
      postsByChannel: {},
      reactionsByPost: {},
      typing: {},
    }),
}))

// ─── Selectors ──────────────────────────────────────────────────────

/**
 * Unread message count for a channel. Read from the locally-tracked counter
 * (seeded from membership, incremented by WS `posted`, reset on mark-read).
 * Pass the channelId for the live value.
 */
export function unreadCount(channelId: string): number {
  return useChatStore.getState().unreadByChannel[channelId] ?? 0
}

/** Mention count for a channel (drives the badge highlight). */
export function mentionCount(membership?: ChatChannelMember): number {
  return membership?.mention_count ?? 0
}

/** Convenience: typing entries for a channel (+optional thread root). */
export function selectTyping(channelId: string, rootId?: string | null): TypingEntry[] {
  const key = `${channelId}:${rootId || ''}`
  const entries = useChatStore.getState().typing[key] ?? []
  const now = Date.now()
  return entries.filter((e) => now - e.at < 4000)
}

export type { ChannelPosts, TypingEntry, ChatFileInfo }
