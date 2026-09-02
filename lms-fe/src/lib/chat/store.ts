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
import type { ChatThread, ChatThreadCounts } from './threads'
import { normalizeChatUser } from './user-normalize'

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

export interface ChatBookmark {
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
  /**
   * channel id → locally-tracked unread mention count. Incremented from the
   * `mentions` array on WS `posted` events (when the channel is inactive) and
   * reset on mark-read. Distinct from unreadByChannel so the sidebar can render
   * a mention highlight separately from the unread count.
   */
  mentionByChannel: Record<string, number>

  users: Record<string, ChatUser>
  statuses: Record<string, PresenceStatus>

  postsByChannel: Record<string, ChannelPosts>
  reactionsByPost: Record<string, ChatReaction[]>

  /** Saved/flagged post ids (from preferences) — drives the saved-messages view. */
  flagged: Set<string>

  /** `${channelId}:${rootId}` → list of typing users with timestamps. */
  typing: Record<string, TypingEntry[]>

  // ── Threads (Collapsed Reply Threads) ──
  /** thread id → thread (the id is the root post id). */
  threadsById: Record<string, ChatThread>
  /** team id → ordered thread ids the user follows (sorted by last_reply_at desc). */
  threadsInTeam: Record<string, string[]>
  /** team id → set of thread ids with unread replies/mentions. */
  unreadThreadsInTeam: Record<string, Set<string>>
  /** team id → thread counts envelope. */
  threadCounts: Record<string, ChatThreadCounts>
  /** thread ids the user manually marked unread (Alt-click); excluded from auto-read. */
  manuallyUnreadThreads: Set<string>

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
  /** Increment a channel's mention count (mentions array on WS posted). */
  incrementMention: (channelId: string, delta: number) => void
  /** Bulk-set unread counts (seeded from membership on channel load). */
  setUnread: (map: Record<string, number>) => void
  /** Bulk-set mention counts (seeded from membership on channel load). */
  setMentions: (map: Record<string, number>) => void
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
  /** Append newer posts (scroll down into a gap). */
  appendPosts: (channelId: string, posts: ChatPost[], nextPostId?: string) => void
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

  // ── Thread actions ──
  /** Receive a single thread (merge into the map + team list). */
  receiveThread: (teamId: string, thread: ChatThread) => void
  /** Receive a list of threads (bulk merge + optional counts). */
  receiveThreads: (teamId: string, threads: ChatThread[], counts?: ChatThreadCounts) => void
  /** Set a thread's follow state (optimistic). */
  setThreadFollow: (threadId: string, following: boolean) => void
  /** Set a thread's read state (unread counts + last_viewed_at). */
  setThreadReadState: (threadId: string, readState: { unread_replies?: number; unread_mentions?: number; last_viewed_at?: number }) => void
  /** Set the thread counts for a team. */
  setThreadCounts: (teamId: string, counts: ChatThreadCounts) => void
  /** Mark all threads in a team read (zero unreads). */
  markAllThreadsRead: (teamId: string) => void
  /** Toggle a thread's manually-unread flag (Alt-click). */
  toggleManuallyUnread: (threadId: string) => void

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
  mentionByChannel: {},
  users: {},
  statuses: {},
  postsByChannel: {},
  reactionsByPost: {},
  flagged: new Set<string>(),
  typing: {},

  threadsById: {},
  threadsInTeam: {},
  unreadThreadsInTeam: {},
  threadCounts: {},
  manuallyUnreadThreads: new Set<string>(),

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
  incrementMention: (channelId, delta) =>
    set((s) => ({ mentionByChannel: { ...s.mentionByChannel, [channelId]: Math.max(0, (s.mentionByChannel[channelId] ?? 0) + delta) } })),
  setUnread: (map) => set((s) => ({ unreadByChannel: { ...s.unreadByChannel, ...map } })),
  setMentions: (map) => set((s) => ({ mentionByChannel: { ...s.mentionByChannel, ...map } })),
  clearUnread: (channelId) =>
    set((s) => {
      const unreadByChannel = { ...s.unreadByChannel }
      const mentionByChannel = { ...s.mentionByChannel }
      unreadByChannel[channelId] = 0
      mentionByChannel[channelId] = 0
      return { unreadByChannel, mentionByChannel }
    }),
  removeChannel: (channelId) =>
    set((s) => {
      const channels = { ...s.channels }
      const memberships = { ...s.memberships }
      const unreadByChannel = { ...s.unreadByChannel }
      const mentionByChannel = { ...s.mentionByChannel }
      const postsByChannel = { ...s.postsByChannel }
      delete channels[channelId]
      delete memberships[channelId]
      delete unreadByChannel[channelId]
      delete mentionByChannel[channelId]
      delete postsByChannel[channelId]
      return { channels, memberships, unreadByChannel, mentionByChannel, postsByChannel }
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
      // Normalize at the boundary: the server's user JSON uses lowercase-
      // concatenated keys (firstname, notifyprops, …) while the UI reads the
      // UserProfile snake_case shape (first_name, notify_props, …).
      for (const u of users) next[u.id] = normalizeChatUser(u)
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

  appendPosts: (channelId, posts, nextPostId) =>
    set((s) => {
      const existing = s.postsByChannel[channelId] ?? emptyChannelPosts()
      let cp: ChannelPosts = { ...existing, byId: { ...existing.byId } }
      for (const p of posts) cp = upsertOrdered(cp, p)
      cp.order = cp.order
        .slice()
        .sort((a, b) => (cp.byId[b]?.create_at ?? 0) - (cp.byId[a]?.create_at ?? 0))
      if (nextPostId !== undefined) cp.nextPostId = nextPostId
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

  // ── Thread actions ──
  receiveThread: (teamId, thread) =>
    set((s) => {
      const threadsById = { ...s.threadsById, [thread.id]: thread }
      const teamList = s.threadsInTeam[teamId] ?? []
      let threadsInTeam = s.threadsInTeam
      if (thread.is_following && !teamList.includes(thread.id)) {
        const next = [thread.id, ...teamList]
        threadsInTeam = { ...s.threadsInTeam, [teamId]: next }
      }
      // Update the unread set membership based on the thread's unread state.
      const unreadSet = new Set(s.unreadThreadsInTeam[teamId] ?? [])
      if (thread.unread_replies > 0 || thread.unread_mentions > 0) unreadSet.add(thread.id)
      else unreadSet.delete(thread.id)
      return {
        threadsById,
        threadsInTeam,
        unreadThreadsInTeam: { ...s.unreadThreadsInTeam, [teamId]: unreadSet },
      }
    }),

  receiveThreads: (teamId, threads, counts) =>
    set((s) => {
      const threadsById = { ...s.threadsById }
      for (const t of threads) threadsById[t.id] = t
      // Sorted by last_reply_at desc (following only).
      const sorted = threads
        .filter((t) => t.is_following && t.last_reply_at !== 0)
        .sort((a, b) => b.last_reply_at - a.last_reply_at)
        .map((t) => t.id)
      const unreadSet = new Set<string>()
      for (const t of threads) {
        if (t.unread_replies > 0 || t.unread_mentions > 0) unreadSet.add(t.id)
      }
      const next: Partial<ChatState> = {
        threadsById,
        threadsInTeam: { ...s.threadsInTeam, [teamId]: sorted },
        unreadThreadsInTeam: { ...s.unreadThreadsInTeam, [teamId]: unreadSet },
      }
      if (counts) next.threadCounts = { ...s.threadCounts, [teamId]: counts }
      return next as ChatState
    }),

  setThreadFollow: (threadId, following) =>
    set((s) => {
      const t = s.threadsById[threadId]
      if (!t) return s
      return { threadsById: { ...s.threadsById, [threadId]: { ...t, is_following: following } } }
    }),

  setThreadReadState: (threadId, readState) =>
    set((s) => {
      const t = s.threadsById[threadId]
      if (!t) return s
      const updated: ChatThread = {
        ...t,
        unread_replies: readState.unread_replies ?? t.unread_replies,
        unread_mentions: readState.unread_mentions ?? t.unread_mentions,
        last_viewed_at: readState.last_viewed_at ?? t.last_viewed_at,
      }
      // Find the team this thread belongs to (via its channel) to update the unread set.
      const teamId = Object.keys(s.unreadThreadsInTeam).find((tid) => s.unreadThreadsInTeam[tid]?.has(threadId))
      const unreadThreadsInTeam = { ...s.unreadThreadsInTeam }
      if (teamId) {
        const set = new Set(s.unreadThreadsInTeam[teamId])
        if (updated.unread_replies > 0 || updated.unread_mentions > 0) set.add(threadId)
        else set.delete(threadId)
        unreadThreadsInTeam[teamId] = set
      }
      return { threadsById: { ...s.threadsById, [threadId]: updated }, unreadThreadsInTeam }
    }),

  setThreadCounts: (teamId, counts) =>
    set((s) => ({ threadCounts: { ...s.threadCounts, [teamId]: counts } })),

  markAllThreadsRead: (teamId) =>
    set((s) => {
      const threadsById = { ...s.threadsById }
      for (const id of Object.keys(threadsById)) {
        threadsById[id] = { ...threadsById[id], unread_replies: 0, unread_mentions: 0 }
      }
      return {
        threadsById,
        unreadThreadsInTeam: { ...s.unreadThreadsInTeam, [teamId]: new Set<string>() },
        threadCounts: { ...s.threadCounts, [teamId]: { ...(s.threadCounts[teamId] ?? { total: 0, total_unread_threads: 0, total_unread_mentions: 0 }), total_unread_threads: 0, total_unread_mentions: 0 } },
      }
    }),

  toggleManuallyUnread: (threadId) =>
    set((s) => {
      const next = new Set(s.manuallyUnreadThreads)
      if (next.has(threadId)) next.delete(threadId)
      else next.add(threadId)
      return { manuallyUnreadThreads: next }
    }),

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
      mentionByChannel: {},
      users: {},
      statuses: {},
      flagged: new Set<string>(),
      postsByChannel: {},
      reactionsByPost: {},
      typing: {},
      threadsById: {},
      threadsInTeam: {},
      unreadThreadsInTeam: {},
      threadCounts: {},
      manuallyUnreadThreads: new Set<string>(),
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
export function mentionCount(channelId: string, membership?: ChatChannelMember): number {
  const live = useChatStore.getState().mentionByChannel[channelId]
  return live ?? membership?.mention_count ?? 0
}

/** Convenience: typing entries for a channel (+optional thread root). */
export function selectTyping(channelId: string, rootId?: string | null): TypingEntry[] {
  const key = `${channelId}:${rootId || ''}`
  const entries = useChatStore.getState().typing[key] ?? []
  const now = Date.now()
  return entries.filter((e) => now - e.at < 4000)
}

export type { ChannelPosts, TypingEntry, ChatFileInfo }
