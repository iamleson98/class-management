/**
 * Chat React hooks — the bridge between the Client4/WS service layer and the
 * UI. Each hook wires a slice of the chat store to React, using React Query
 * for REST fetching (cache + retry) and the Zustand store for real-time data
 * driven by WebSocket events.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client4, connectWebSocket, disconnectWebSocket, configureClient4, wsClient } from './client'
import { bindChatWebSocket } from './websocket-events'
import { bindCallsWebSocket } from './calls-events'
import { useChatStore, unreadCount, mentionCount } from './store'
import { useLMSStore } from '@/store/lms-store'
import type { ChatChannel, ChatPost, ChatUser, PresenceStatus } from './types'
import type { CustomEmoji } from './emoji-data'

type PresenceStatusLike = PresenceStatus

// ─── Connection lifecycle ───────────────────────────────────────────

/**
 * Connect the WebSocket on mount, disconnect on unmount. Binds the event
 * dispatcher once. Mounted by the top-level ChatView so the socket lives for
 * the whole chat session. Also configures Client4 (same-origin base).
 */
export function useChatConnection(): { connected: boolean } {
  const connected = useChatStore((s) => s.connected)
  const reset = useChatStore((s) => s.reset)
  const queryClient = useQueryClient()

  useEffect(() => {
    configureClient4()
    bindChatWebSocket()
    bindCallsWebSocket()
    connectWebSocket()
    return () => {
      disconnectWebSocket()
      // Drop all cached chat data + WS state when leaving chat.
      reset()
      queryClient.removeQueries({ queryKey: ['chat'] })
    }
  }, [reset, queryClient])

  return { connected }
}

// ─── Current user ───────────────────────────────────────────────────

/** The current Mattermost user id (from the lms-fe auth store). */
export function useCurrentUserId(): string | undefined {
  return useLMSStore((s) => s.authUser?.id)
}

// ─── Teams + channels ───────────────────────────────────────────────

const POSTS_PER_PAGE = 60

/** Maximum characters allowed in a post (webapp DEFAULT_CHARS_PER_POST). */
export const MAX_POST_CHARS = 4000

/**
 * Load my teams + the channels/memberships for each, polling so newly
 * provisioned class channels (or enrollment changes) appear without a reload.
 * Seeds the store; components read channels via useChatStore selectors.
 */
export function useChannels() {
  const setTeams = useChatStore((s) => s.setTeams)
  const upsertChannels = useChatStore((s) => s.upsertChannels)
  const setMemberships = useChatStore((s) => s.setMemberships)
  const setUnread = useChatStore((s) => s.setUnread)
  const setMentions = useChatStore((s) => s.setMentions)

  const teamsQuery = useQuery({
    queryKey: ['chat', 'teams'],
    queryFn: async () => {
      configureClient4()
      const teams = await client4.getMyTeams()
      setTeams(teams as unknown as ChatStateTeams)
      const [allChannels, allMembers] = await Promise.all([
        Promise.all(teams.map((t) => client4.getMyChannels(t.id))).then((r) => r.flat()),
        Promise.all(teams.map((t) => client4.getMyChannelMembers(t.id))).then((r) => r.flat()),
      ])
      const channels = allChannels as unknown as ChatChannel[]
      const members = allMembers as unknown as Parameters<typeof setMemberships>[0]
      upsertChannels(channels)
      setMemberships(members)
      // Seed the unread counter per channel from the membership delta. The
      // server exposes total_msg_count on the channel object at runtime even
      // though the vendored Channel type omits it; read it defensively.
      const channelsById = new Map(channels.map((c) => [c.id, c]))
      const unread: Record<string, number> = {}
      const mentions: Record<string, number> = {}
      for (const m of members) {
        const total = (channelsById.get(m.channel_id) as unknown as { total_msg_count?: number })?.total_msg_count ?? 0
        unread[m.channel_id] = Math.max(0, total - m.msg_count)
        mentions[m.channel_id] = m.mention_count ?? 0
      }
      setUnread(unread)
      setMentions(mentions)
      return { teams, channels, members }
    },
    // Poll so new class channels (after enroll/admin provisioning) show up.
    refetchInterval: 20_000,
    staleTime: 15_000,
  })

  return teamsQuery
}

type ChatStateTeams = ReturnType<typeof useChatStore.getState>['teams']

/**
 * Load a channel's posts (around the unread boundary on first open), keep
 * them fresh via getPostsSince on reconnect/visibility, and mark the channel
 * read on focus. Drives the post list component.
 */
export function useChannelPosts(channelId: string | null) {
  const userId = useCurrentUserId()
  const setChannelPosts = useChatStore((s) => s.setChannelPosts)
  const prependPosts = useChatStore((s) => s.prependPosts)
  const appendPosts = useChatStore((s) => s.appendPosts)
  const setLoading = useChatStore((s) => s.setChannelPostsLoading)
  const cpState = useChatStore((s) => (channelId ? s.postsByChannel[channelId] : undefined))

  // Initial load (getPostsUnread) + reconnect sync (getPostsSince).
  useQuery({
    queryKey: ['chat', 'posts-init', channelId],
    queryFn: async () => {
      if (!channelId || !userId) return null
      setLoading(channelId, true)
      try {
        const list = await client4.getPostsUnread(channelId, userId, POSTS_PER_PAGE, POSTS_PER_PAGE)
        const posts = (list.order ?? []).map((id) => list.posts[id]).filter(Boolean) as ChatPost[]
        setChannelPosts(channelId, posts, { prevPostId: list.prev_post_id, nextPostId: list.next_post_id, reset: true })
        return list
      } finally {
        setLoading(channelId, false)
      }
    },
    enabled: !!channelId && !!userId,
    // Re-fetch on window focus (reconnect/visibility) to catch missed events.
    refetchOnWindowFocus: true,
    staleTime: Infinity, // initial load is one-shot per channel
  })

  // Load older messages (scroll up) via getPostsBefore using prevPostId cursor.
  const loadOlder = useCallback(async () => {
    if (!channelId || !cpState || cpState.loading) return
    if (!cpState.prevPostId) return // at oldest
    const oldestId = cpState.order[cpState.order.length - 1]
    if (!oldestId) return
    setLoading(channelId, true)
    try {
      const list = await client4.getPostsBefore(channelId, oldestId, 0, POSTS_PER_PAGE)
      const posts = (list.order ?? []).map((id) => list.posts[id]).filter(Boolean) as ChatPost[]
      prependPosts(channelId, posts, list.prev_post_id)
    } finally {
      setLoading(channelId, false)
    }
  }, [channelId, cpState, prependPosts, setLoading])

  // Load newer messages (scroll down into a gap) via getPostsAfter using nextPostId cursor.
  // Live posts still arrive via websocket; this covers the scrolled-up-with-gap case.
  const loadNewer = useCallback(async () => {
    if (!channelId || !cpState || cpState.loading) return
    if (!cpState.nextPostId) return // at newest
    const newestId = cpState.order[0]
    if (!newestId) return
    setLoading(channelId, true)
    try {
      const list = await client4.getPostsAfter(channelId, newestId, 0, POSTS_PER_PAGE)
      const posts = (list.order ?? []).map((id) => list.posts[id]).filter(Boolean) as ChatPost[]
      appendPosts(channelId, posts, list.next_post_id)
    } finally {
      setLoading(channelId, false)
    }
  }, [channelId, cpState, appendPosts, setLoading])

  return {
    loadOlder,
    loadNewer,
    hasOlder: !!cpState?.prevPostId,
    hasNewer: !!cpState?.nextPostId,
    loading: cpState?.loading ?? false,
  }
}

/** Mark a channel read (viewMyChannel) — called when a channel is opened/focused. */
export function useMarkChannelRead() {
  const clearUnread = useChatStore((s) => s.clearUnread)
  return useMutation({
    mutationFn: async (channelId: string) => {
      const res = await client4.viewMyChannel(channelId)
      return res
    },
    onSuccess: (_data, channelId) => {
      clearUnread(channelId)
    },
  })
}

// ─── Posts mutations ────────────────────────────────────────────────

export function useSendPost() {
  const upsertPost = useChatStore((s) => s.upsertPost)
  return useMutation({
    mutationFn: async (args: { channelId: string; message: string; rootId?: string; fileIds?: string[] }) => {
      const post = await client4.createPost({
        channel_id: args.channelId,
        message: args.message,
        root_id: args.rootId ?? '',
        file_ids: args.fileIds ?? [],
      } as Parameters<typeof client4.createPost>[0])
      return post as unknown as ChatPost
    },
    onSuccess: (post) => upsertPost(post),
  })
}

export function useEditPost() {
  const editPost = useChatStore((s) => s.editPost)
  return useMutation({
    mutationFn: async (args: { postId: string; message: string }) => {
      const post = await client4.patchPost({ id: args.postId, message: args.message } as Parameters<typeof client4.patchPost>[0])
      return post as unknown as ChatPost
    },
    onSuccess: (post) => editPost(post),
  })
}

export function useDeletePost() {
  const deletePost = useChatStore((s) => s.deletePost)
  return useMutation({
    mutationFn: async (postId: string) => {
      await client4.deletePost(postId)
      return postId
    },
    onSuccess: (postId) => deletePost(postId),
  })
}

// ─── Typing ─────────────────────────────────────────────────────────

/**
 * Throttled outbound typing indicator. WebSocketClient exposes userTyping
 * directly (it sends the `user_typing` WS message); Client4 does not.
 */
export function useTypingSender() {
  const lastSent = useRef(0)
  return useCallback((channelId: string, rootId?: string) => {
    const now = Date.now()
    if (now - lastSent.current < 3000) return
    lastSent.current = now
    try {
      wsClient.userTyping(channelId, rootId ?? '')
    } catch {
      // ignore — non-critical
    }
  }, [])
}

// ─── Reactions ──────────────────────────────────────────────────────

export function useToggleReaction(currentUserId?: string) {
  const addReactionStore = useChatStore((s) => s.addReaction)
  const removeReactionStore = useChatStore((s) => s.removeReaction)
  return useMutation({
    mutationFn: async (args: { postId: string; emojiName: string }) => {
      if (!currentUserId) throw new Error('not authenticated')
      const existing = useChatStore.getState().reactionsByPost[args.postId] ?? []
      const already = existing.some((r) => r.user_id === currentUserId && r.emoji_name === args.emojiName)
      if (already) {
        await client4.removeReaction(currentUserId, args.postId, args.emojiName)
        return { added: false, emojiName: args.emojiName }
      }
      const reaction = await client4.addReaction(currentUserId, args.postId, args.emojiName)
      return { added: true, reaction: reaction as unknown as { post_id: string; user_id: string; emoji_name: string } }
    },
    onSuccess: (res, args) => {
      if (res.added && res.reaction) {
        addReactionStore({ post_id: res.reaction.post_id, user_id: res.reaction.user_id, emoji_name: res.reaction.emoji_name, create_at: Date.now() })
      } else {
        if (currentUserId) removeReactionStore(args.postId, currentUserId, args.emojiName)
      }
    },
  })
}

/** Load reactions for a post (one-time per post). */
export function usePostReactions(postId: string | undefined) {
  const setReactions = useChatStore((s) => s.setReactions)
  return useQuery({
    queryKey: ['chat', 'reactions', postId],
    queryFn: async () => {
      if (!postId) return []
      const reactions = await client4.getReactionsForPost(postId)
      setReactions(postId, reactions as unknown as Parameters<typeof setReactions>[1])
      return reactions
    },
    enabled: !!postId,
    staleTime: Infinity,
  })
}

// ─── Files ──────────────────────────────────────────────────────────

export function useUploadFile() {
  return useMutation({
    mutationFn: async (args: { channelId: string; file: File }) => {
      const form = new FormData()
      form.append('channel_id', args.channelId)
      form.append('files', args.file)
      const res = await client4.uploadFile(form)
      return res.file_infos
    },
  })
}

// ─── Threads ────────────────────────────────────────────────────────

/** Fetch a full thread (root + replies) for the thread pane. */
export function useThread(rootId: string | null) {
  const upsertPost = useChatStore((s) => s.upsertPost)
  return useQuery({
    queryKey: ['chat', 'thread', rootId],
    queryFn: async () => {
      if (!rootId) return null
      const list = await client4.getPostThread(rootId)
      const posts = (list.order ?? []).map((id) => list.posts[id]).filter(Boolean) as ChatPost[]
      for (const p of posts) upsertPost(p)
      return posts
    },
    enabled: !!rootId,
    refetchInterval: rootId ? 5000 : false,
  })
}

// ─── Collapsed Reply Threads (CRT) ──────────────────────────────────
// Ports the vendored mattermost-redux thread actions. The thread id IS the
// root post id. Following is optimistic (flip local → API → refetch counts).

const THREADS_PAGE_SIZE = 25

/**
 * Load the user's threads for a team (the global inbox list). Pass
 * { unread: true } for the unread-only list. Seeds the store + counts.
 */
export function useUserThreads(teamId: string | undefined, opts: { unread?: boolean } = {}) {
  const receiveThreads = useChatStore((s) => s.receiveThreads)
  const unread = !!opts.unread
  return useQuery({
    queryKey: ['chat', 'user-threads', teamId, unread],
    queryFn: async () => {
      if (!teamId) return []
      const res = await client4.getUserThreads('me', teamId, {
        perPage: THREADS_PAGE_SIZE,
        extended: true,
        threadsOnly: true,
        totalsOnly: false,
        unread,
      })
      const threads = (res.threads ?? []).map((t) => {
        // Strip the embedded root post; store it as a normal post, keep thread meta.
        const { post, ...meta } = t as typeof t & { post: ChatPost }
        if (post) upsertPostOnce(post)
        return meta as import('./threads').ChatThread
      })
      receiveThreads(teamId, threads, {
        total: res.total,
        total_unread_threads: res.total_unread_threads,
        total_unread_mentions: res.total_unread_mentions,
        total_unread_urgent_mentions: res.total_unread_urgent_mentions,
      })
      return threads
    },
    enabled: !!teamId,
    staleTime: 10_000,
  })
}

// upsertPost without re-grabbing the store hook (used inside queryFn).
function upsertPostOnce(post: ChatPost): void {
  useChatStore.getState().upsertPost(post)
}

/** Load thread counts for a team (totalsOnly). Seeds the store. */
export function useThreadCounts(teamId: string | undefined) {
  const setThreadCounts = useChatStore((s) => s.setThreadCounts)
  const userId = useCurrentUserId()
  return useQuery({
    queryKey: ['chat', 'thread-counts', teamId],
    queryFn: async () => {
      if (!teamId || !userId) return null
      const res = await client4.getUserThreads(userId, teamId, { totalsOnly: true })
      const counts = {
        total: res.total,
        total_unread_threads: res.total_unread_threads,
        total_unread_mentions: res.total_unread_mentions,
        total_unread_urgent_mentions: res.total_unread_urgent_mentions,
      }
      setThreadCounts(teamId, counts)
      return counts
    },
    enabled: !!teamId && !!userId,
    refetchInterval: 30_000,
  })
}

/** Follow / unfollow a thread (optimistic). */
export function useFollowThread(teamId?: string) {
  const setThreadFollow = useChatStore((s) => s.setThreadFollow)
  const receiveThread = useChatStore((s) => s.receiveThread)
  const userId = useCurrentUserId()
  return useMutation({
    mutationFn: async (args: { threadId: string; follow: boolean }) => {
      if (!teamId) throw new Error('team required')
      await client4.updateThreadFollowForUser(userId ?? 'me', teamId, args.threadId, args.follow)
      return args
    },
    onMutate: (args) => {
      // Optimistic flip.
      setThreadFollow(args.threadId, args.follow)
      return args
    },
    onSuccess: (args) => {
      // Re-fetch the thread metadata so the store reflects the server's view
      // (counts, last_viewed, etc.) — matches the vendored getMyTeamUnreads refresh.
      if (teamId) {
        client4.getUserThread(userId ?? 'me', teamId, args.threadId, false)
          .then((full) => {
            const { post, ...meta } = full as typeof full & { post: ChatPost }
            void post
            receiveThread(teamId, meta as import('./threads').ChatThread)
          })
          .catch(() => {})
      }
    },
    onError: (_e, args) => {
      // Roll back the optimistic flip.
      setThreadFollow(args.threadId, !args.follow)
    },
  })
}

/**
 * Mark a thread read up to now (gated — only hits the server if there's
 * actually something to clear). Mirrors the vendored updateThreadRead gate.
 */
export function useMarkThreadRead(teamId?: string) {
  const setThreadReadState = useChatStore((s) => s.setThreadReadState)
  const userId = useCurrentUserId()
  return useMutation({
    mutationFn: async (args: { threadId: string }) => {
      const thread = useChatStore.getState().threadsById[args.threadId]
      if (!thread) return
      // Gate: only call the server if there is unread state to clear.
      if (thread.last_viewed_at >= thread.last_reply_at && !thread.unread_mentions && !thread.unread_replies) return
      const now = Date.now()
      await client4.updateThreadReadForUser(userId ?? 'me', teamId ?? '', args.threadId, now)
      setThreadReadState(args.threadId, { unread_replies: 0, unread_mentions: 0, last_viewed_at: now })
    },
  })
}

/** Mark all threads in a team read. */
export function useMarkAllThreadsRead(teamId?: string) {
  const markAllThreadsRead = useChatStore((s) => s.markAllThreadsRead)
  const userId = useCurrentUserId()
  return useMutation({
    mutationFn: async () => {
      if (!teamId) return
      await client4.updateThreadsReadForUser(userId ?? 'me', teamId)
      markAllThreadsRead(teamId)
    },
  })
}

/** Mark a thread unread from a specific post (Alt-click / menu). */
export function useMarkThreadUnread(teamId?: string) {
  const setThreadReadState = useChatStore((s) => s.setThreadReadState)
  const userId = useCurrentUserId()
  return useMutation({
    mutationFn: async (args: { threadId: string; postId: string }) => {
      if (!teamId) return
      await client4.markThreadAsUnreadForUser(userId ?? 'me', teamId, args.threadId, args.postId)
      setThreadReadState(args.threadId, { unread_replies: 1, unread_mentions: 0 })
    },
  })
}

// ─── Members + presence ─────────────────────────────────────────────

/** Channel members (user ids) for the info pane. */
export function useChannelMembers(channelId: string | null) {
  return useQuery({
    queryKey: ['chat', 'members', channelId],
    queryFn: async () => {
      if (!channelId) return []
      // Page through all members.
      const members: Awaited<ReturnType<typeof client4.getChannelMembers>> = []
      let page = 0
      const perPage = 200
      for (;;) {
        const batch = await client4.getChannelMembers(channelId, page, perPage)
        members.push(...batch)
        if (batch.length < perPage) break
        page += 1
        if (page > 20) break // safety cap
      }
      return members
    },
    enabled: !!channelId,
    staleTime: 60_000,
  })
}

/** Resolve a set of user ids to profiles (cached, batched). */
export function useUsers(userIds: string[]) {
  const upsertUsers = useChatStore((s) => s.upsertUsers)
  const key = userIds.slice().sort().join(',')
  return useQuery({
    queryKey: ['chat', 'users', key],
    queryFn: async () => {
      if (userIds.length === 0) return []
      const users = (await client4.getProfilesByIds(userIds)) as unknown as ChatUser[]
      upsertUsers(users)
      return users
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

/** Presence polling for a set of user ids; seeds + refreshes statuses. */
export function useStatuses(userIds: string[]) {
  const setStatuses = useChatStore((s) => s.setStatuses)
  const key = userIds.slice().sort().join(',')
  return useQuery({
    queryKey: ['chat', 'statuses', key],
    queryFn: async () => {
      if (userIds.length === 0) return {}
      const list = await client4.getStatusesByIds(userIds)
      // Normalize to { userId: status }.
      const map: Record<string, import('./types').PresenceStatus> = {}
      for (const s of list) map[s.user_id] = s.status as import('./types').PresenceStatus
      setStatuses(map)
      return map
    },
    enabled: userIds.length > 0,
    refetchInterval: 30_000,
    staleTime: 25_000,
  })
}

/**
 * Poll presence for "visible" users — recent posters in the active channel +
 * DM partners + the current user (ports addVisibleUsersInCurrentChannelAndSelfToStatusPoll).
 * Runs every ~60s. The status_change WS event keeps statuses live between polls.
 */
export function usePresencePoll(activeChannelId: string | null) {
  const setStatuses = useChatStore((s) => s.setStatuses)
  const channels = useChatStore((s) => s.channels)
  const activeChannelPosts = useChatStore((s) => (activeChannelId ? s.postsByChannel[activeChannelId] : undefined))
  const userId = useCurrentUserId()

  const visibleIds = useMemo(() => {
    const ids = new Set<string>()
    if (userId) ids.add(userId)

    if (activeChannelId && activeChannelPosts) {
      for (const id of activeChannelPosts.order.slice(0, 30)) {
        const p = activeChannelPosts.byId[id]
        if (p?.user_id) ids.add(p.user_id)
      }
    }

    for (const ch of Object.values(channels)) {
      if ((ch.type === 'D' || ch.type === 'G') && ch.name) {
        const parts = ch.name.split('__').filter(Boolean)
        for (const pid of parts) if (pid !== userId) ids.add(pid)
      }
    }

    return Array.from(ids).sort()
  }, [activeChannelId, activeChannelPosts, channels, userId])

  const key = visibleIds.join(',')
  return useQuery({
    queryKey: ['chat', 'presence-poll', key],
    queryFn: async () => {
      if (visibleIds.length === 0) return {}
      const list = await client4.getStatusesByIds(visibleIds)
      const map: Record<string, import('./types').PresenceStatus> = {}
      for (const st of list) map[st.user_id] = st.status as import('./types').PresenceStatus
      setStatuses(map)
      return map
    },
    enabled: visibleIds.length > 0,
    refetchInterval: 60_000,
    staleTime: 45_000,
  })
}

// ─── Search ─────────────────────────────────────────────────────────

export function useSearchPosts(teamId: string | undefined, isOrSearch = false) {
  return useMutation({
    mutationFn: async (terms: string) => {
      if (!teamId || !terms.trim()) return []
      const results = await client4.searchPosts(teamId, terms, isOrSearch)
      const posts = (results.order ?? []).map((id) => results.posts[id]).filter(Boolean) as ChatPost[]
      return posts
    },
  })
}

// ─── Pinned messages (pinPost / unpinPost / getPinnedPosts) ─────────

export function usePinPost() {
  const editPost = useChatStore((s) => s.editPost)
  return useMutation({
    mutationFn: async (args: { postId: string; pin: boolean }) => {
      if (args.pin) await client4.pinPost(args.postId)
      else await client4.unpinPost(args.postId)
      return args
    },
    onSuccess: (args) => {
      // Reflect the pinned flag locally.
      for (const cp of Object.values(useChatStore.getState().postsByChannel)) {
        if (cp.byId[args.postId]) {
          editPost({ ...cp.byId[args.postId], is_pinned: args.pin } as ChatPost)
          break
        }
      }
    },
  })
}

/** Fetch the pinned posts for a channel (one-time, RHS view). */
export function usePinnedPosts(channelId: string | null) {
  return useQuery({
    queryKey: ['chat', 'pinned', channelId],
    queryFn: async () => {
      if (!channelId) return []
      const list = await client4.getPinnedPosts(channelId)
      return (list.order ?? []).map((id) => list.posts[id]).filter(Boolean) as ChatPost[]
    },
    enabled: !!channelId,
    staleTime: 30_000,
  })
}

// ─── Saved / flagged messages (preferences) ─────────────────────────

const FLAG_CATEGORY = 'flagged_post'
export const PREFERENCE_CATEGORY = { FLAGGED_POST: FLAG_CATEGORY } as const

/** Toggle a post's saved/flagged state via user preferences. */
export function useToggleFlag(userId?: string) {
  const flagged = useChatStore((s) => s.flagged)
  const setFlagged = useChatStore((s) => s.setFlagged as ((ids: Set<string>) => void) | undefined)
  return useMutation({
    mutationFn: async (args: { postId: string; flag: boolean }) => {
      if (!userId) throw new Error('not authenticated')
      if (args.flag) {
        await client4.savePreferences(userId, [{ user_id: userId, category: FLAG_CATEGORY, name: args.postId, value: 'true' }])
      } else {
        await client4.deletePreferences(userId, [{ user_id: userId, category: FLAG_CATEGORY, name: args.postId, value: 'true' }])
      }
      return args
    },
    onSuccess: (args) => {
      if (!setFlagged) return
      const next = new Set(flagged)
      if (args.flag) next.add(args.postId)
      else next.delete(args.postId)
      setFlagged(next)
    },
  })
}

/** Seed the flagged-post ids from getMyPreferences (called on chat connect). */
export function useSeedFlagged(userId?: string) {
  const setFlagged = useChatStore((s) => s.setFlagged as ((ids: Set<string>) => void) | undefined)
  return useQuery({
    queryKey: ['chat', 'my-preferences'],
    queryFn: async () => {
      const prefs = (await client4.getMyPreferences()) as unknown as Array<{ category: string; name: string }>
      const ids = new Set(prefs.filter((p) => p.category === FLAG_CATEGORY).map((p) => p.name))
      setFlagged?.(ids)
      return ids
    },
    enabled: !!userId && !!setFlagged,
    staleTime: Infinity,
  })
}

/** Fetch the current user's flagged posts (RHS view). */
export function useFlaggedPosts(userId?: string, teamId?: string) {
  return useQuery({
    queryKey: ['chat', 'flagged', userId, teamId],
    queryFn: async () => {
      if (!userId) return []
      const list = await client4.getFlaggedPosts(userId, undefined, teamId)
      return (list.order ?? []).map((id) => list.posts[id]).filter(Boolean) as ChatPost[]
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

// ─── Mark unread + mark all read ────────────────────────────────────

export function useMarkPostUnread(userId?: string) {
  const incrementUnread = useChatStore((s) => s.incrementUnread)
  return useMutation({
    mutationFn: async (args: { postId: string; channelId: string }) => {
      if (!userId) throw new Error('not authenticated')
      await client4.markPostAsUnread(userId, args.postId)
      return args
    },
    onSuccess: (args) => incrementUnread(args.channelId, 1),
  })
}

export function useMarkAllRead() {
  const setUnread = useChatStore((s) => s.setUnread)
  const setMentions = useChatStore((s) => s.setMentions)
  return useMutation({
    mutationFn: async (args: { userId: string; teamId?: string }) => {
      if (args.teamId) await client4.markAllInTeamAsRead(args.userId, args.teamId)
      else await client4.markAllMessagesAsRead(args.userId)
    },
    onSuccess: () => {
      // Zero every channel's unread + mention counts locally.
      const state = useChatStore.getState()
      const map: Record<string, number> = {}
      for (const cid of Object.keys(state.unreadByChannel)) map[cid] = 0
      setUnread(map)
      const mentionMap: Record<string, number> = {}
      for (const cid of Object.keys(state.mentionByChannel)) mentionMap[cid] = 0
      setMentions(mentionMap)
    },
  })
}

// ─── Edit history ───────────────────────────────────────────────────

export function usePostEditHistory(postId: string | null) {
  return useQuery({
    queryKey: ['chat', 'edit-history', postId],
    queryFn: async () => {
      if (!postId) return []
      return (await client4.getPostEditHistory(postId)) as unknown as ChatPost[]
    },
    enabled: !!postId,
    staleTime: Infinity,
  })
}

// ─── Channel header/purpose edit + notifications ────────────────────

export function usePatchChannel() {
  const upsertChannels = useChatStore((s) => s.upsertChannels)
  return useMutation({
    mutationFn: async (args: { channelId: string; patch: Record<string, unknown> }) => {
      const updated = await client4.patchChannel(args.channelId, args.patch as never)
      return updated
    },
    onSuccess: (updated) => upsertChannels([updated as unknown as ChatChannel]),
  })
}

export function useUpdateChannelNotifyProps() {
  return useMutation({
    mutationFn: async (args: { channelId: string; userId: string; props: Record<string, unknown> }) =>
      client4.updateChannelNotifyProps({
        channel_id: args.channelId,
        user_id: args.userId,
        ...args.props,
      } as never),
  })
}

// ─── DM / GM channels ───────────────────────────────────────────────

/** Open (or create) a direct channel with one other user. */
export function useOpenDirectChannel() {
  const upsertChannels = useChatStore((s) => s.upsertChannels)
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const channel = await client4.createDirectChannel([otherUserId])
      return channel as unknown as ChatChannel
    },
    onSuccess: (channel) => upsertChannels([channel]),
  })
}

/** Create a group channel with multiple users. */
export function useCreateGroupChannel() {
  const upsertChannels = useChatStore((s) => s.upsertChannels)
  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const channel = await client4.createGroupChannel(userIds)
      return channel as unknown as ChatChannel
    },
    onSuccess: (channel) => upsertChannels([channel]),
  })
}

// ─── Custom emoji ───────────────────────────────────────────────────
// Loads all custom emojis (paged) and merges them into the shared EmojiMap so
// :shortcode: resolution + the picker render them. Server must have custom
// emoji enabled; the call returns empty otherwise (no error).

/** Load custom emojis into the shared emojiMap. Called once on chat connect. */
export function useCustomEmojis(enabled = true) {
  return useQuery({
    queryKey: ['chat', 'custom-emojis'],
    queryFn: async () => {
      if (!enabled) return []
      const all: Awaited<ReturnType<typeof client4.getCustomEmojis>> = []
      for (let page = 0; page < 20; page++) {
        const batch = await client4.getCustomEmojis(page, 100)
        all.push(...batch)
        if (batch.length < 100) break
      }
      // Merge into the emoji map.
      const { emojiMap } = await import('./emoji-data')
      const map = new Map<string, CustomEmoji>()
      for (const e of all) map.set(e.name, e as unknown as CustomEmoji)
      emojiMap.setCustomEmojis(map)
      return all
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Emoji preferences (skin tone + recent emojis) ──────────────────
// Ports the vendored emoji_picker preferences: category "emoji", names
// "emoji_skintone" and "recent_emojis". Stored server-side via Client4
// preferences; the hooks expose a live value + a setter that persists.

const EMOJI_PREF_CATEGORY = 'emoji'
const EMOJI_SKINTONE_PREF = 'emoji_skintone'
const RECENT_EMOJIS_PREF = 'recent_emojis'

/** Read + write the user's preferred emoji skin tone ('default'|'1F3FB'|…). */
export function useSkinTone(userId?: string) {
  const [skinTone, setSkinTone] = useState<string>('default')
  const queryClient = useQueryClient()

  // Load the saved skin tone once.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    client4.getMyPreferences().then((prefs) => {
      if (cancelled) return
      const p = (prefs as unknown as Array<{ category: string; name: string; value: string }>).find(
        (x) => x.category === EMOJI_PREF_CATEGORY && x.name === EMOJI_SKINTONE_PREF,
      )
      if (p?.value) setSkinTone(p.value)
    }).catch(() => { /* non-critical */ })
    return () => { cancelled = true }
  }, [userId])

  const change = useCallback((next: string) => {
    setSkinTone(next)
    if (!userId) return
    const pref = { user_id: userId, category: EMOJI_PREF_CATEGORY, name: EMOJI_SKINTONE_PREF, value: next }
    if (next === 'default') {
      client4.deletePreferences(userId, [pref]).catch(() => {})
    } else {
      client4.savePreferences(userId, [pref]).catch(() => {})
    }
    void queryClient.invalidateQueries({ queryKey: ['chat', 'my-preferences'] })
  }, [userId, queryClient])

  return { skinTone, setSkinTone: change }
}

/** Read + write the user's recent-emoji short_names (most-recent-first, capped). */
export function useRecentEmojis(userId?: string) {
  const [recent, setRecent] = useState<string[]>([])
  const queryClient = useQueryClient()

  // Load saved recents once.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    client4.getMyPreferences().then((prefs) => {
      if (cancelled) return
      const p = (prefs as unknown as Array<{ category: string; name: string; value: string }>).find(
        (x) => x.category === EMOJI_PREF_CATEGORY && x.name === RECENT_EMOJIS_PREF,
      )
      if (p?.value) {
        try { setRecent(JSON.parse(p.value)) } catch { /* ignore bad json */ }
      }
    }).catch(() => { /* non-critical */ })
    return () => { cancelled = true }
  }, [userId])

  const add = useCallback((name: string) => {
    setRecent((prev) => {
      const next = [name, ...prev.filter((n) => n !== name)].slice(0, 27)
      if (userId) {
        const pref = { user_id: userId, category: EMOJI_PREF_CATEGORY, name: RECENT_EMOJIS_PREF, value: JSON.stringify(next) }
        client4.savePreferences(userId, [pref]).catch(() => {})
        void queryClient.invalidateQueries({ queryKey: ['chat', 'my-preferences'] })
      }
      return next
    })
  }, [userId, queryClient])

  return { recent, addRecent: add }
}

// ─── Channel categories / favorites ─────────────────────────────────
// Ports the vendored channel_categories redux actions. Favorites are just
// "move channel into the team's favorites-typed category".

/** Load sidebar categories for a team (one-time per team, then WS-refreshed). */
export function useChannelCategories(teamId: string | undefined, userId?: string) {
  const setCategories = useChatStore((s) => s.setCategories)
  return useQuery({
    queryKey: ['chat', 'categories', teamId],
    queryFn: async () => {
      if (!teamId || !userId) return null
      const ordered = await client4.getChannelCategories(userId, teamId)
      setCategories(teamId, ordered.categories as unknown as Parameters<typeof setCategories>[1], ordered.order)
      return ordered
    },
    enabled: !!teamId && !!userId,
    staleTime: 60_000,
  })
}

/** Move a channel into a category (the primitive behind favorite/unfavorite/drag). */
export function useMoveChannelToCategory() {
  const setCategories = useChatStore((s) => s.setCategories)
  return useMutation({
    mutationFn: async (args: { userId: string; teamId: string; categoryId: string; channelId: string }) => {
      // Build the update payload: add channel to target category, remove from others.
      const state = useChatStore.getState().categoriesByTeam[args.teamId]
      const cats = state?.categories ?? []
      const updates = cats.map((c) => {
        if (c.id === args.categoryId) {
          if (c.channel_ids.includes(args.channelId)) return c
          return { ...c, channel_ids: [args.channelId, ...c.channel_ids.filter((id) => id !== args.channelId)] }
        }
        if (c.channel_ids.includes(args.channelId)) {
          return { ...c, channel_ids: c.channel_ids.filter((id) => id !== args.channelId) }
        }
        return c
      })
      const result = await client4.updateChannelCategories(args.userId, args.teamId, updates as never)
      return result
    },
    onSuccess: (result, args) => setCategories(args.teamId, result as unknown as Parameters<typeof setCategories>[1], useChatStore.getState().categoriesByTeam[args.teamId]?.order ?? []),
  })
}

/** Favorite / unfavorite a channel (move into/out of the team's favorites category). */
export function useToggleFavorite(userId?: string) {
  const moveChannel = useMoveChannelToCategory()
  return useMutation({
    mutationFn: async (args: { channelId: string; teamId: string; favorite: boolean }) => {
      if (!userId) throw new Error('not authenticated')
      const state = useChatStore.getState().categoriesByTeam[args.teamId]
      const cats = state?.categories ?? []
      // Find the favorites category (or the channels/DM category to unfavorite back into).
      const channel = useChatStore.getState().channels[args.channelId]
      const targetType = args.favorite ? 'favorites' : (channel?.type === 'D' || channel?.type === 'G' ? 'direct_messages' : 'channels')
      const target = cats.find((c) => c.type === targetType)
      if (!target) throw new Error('category not found')
      await moveChannel.mutateAsync({ userId, teamId: args.teamId, categoryId: target.id, channelId: args.channelId })
    },
  })
}

/** Whether a channel is currently favorited. */
export function isFavoriteChannel(teamId: string | undefined, channelId: string): boolean {
  if (!teamId) return false
  const cats = useChatStore.getState().categoriesByTeam[teamId]?.categories ?? []
  const fav = cats.find((c) => c.type === 'favorites')
  return !!fav?.channel_ids.includes(channelId)
}

// ─── Channel bookmarks ──────────────────────────────────────────────
// Requires the Connection-Id header on mutations; we read the connection id
// from the WS hello event (captured in the store). GET needs no connection id.

/** The current WS connection id (set from the hello event in websocket-events). */
export function useConnectionId(): string {
  return useChatStore((s) => s.connectionId ?? '')
}

/** Load bookmarks for a channel. */
export function useChannelBookmarks(channelId: string | null) {
  const setBookmarks = useChatStore((s) => s.setBookmarks)
  return useQuery({
    queryKey: ['chat', 'bookmarks', channelId],
    queryFn: async () => {
      if (!channelId) return []
      const bookmarks = await client4.getChannelBookmarks(channelId)
      setBookmarks(channelId, bookmarks as unknown as Parameters<typeof setBookmarks>[1])
      return bookmarks
    },
    enabled: !!channelId,
    staleTime: 30_000,
  })
}

export function useCreateBookmark() {
  const upsertBookmark = useChatStore((s) => s.upsertBookmark)
  return useMutation({
    mutationFn: async (args: { channelId: string; bookmark: Parameters<typeof client4.createChannelBookmark>[1]; connectionId: string }) =>
      client4.createChannelBookmark(args.channelId, args.bookmark, args.connectionId),
    onSuccess: (bookmark) => upsertBookmark(bookmark as unknown as Parameters<typeof upsertBookmark>[0]),
  })
}

export function useDeleteBookmark() {
  const removeBookmark = useChatStore((s) => s.removeBookmark)
  return useMutation({
    mutationFn: async (args: { channelId: string; bookmarkId: string; connectionId: string }) =>
      client4.deleteChannelBookmark(args.channelId, args.bookmarkId, args.connectionId),
    onSuccess: (deleted, args) => removeBookmark(args.channelId, args.bookmarkId),
  })
}

/** Edit an existing bookmark (PATCH). Response may include updated + deleted. */
export function useUpdateBookmark() {
  const upsertBookmark = useChatStore((s) => s.upsertBookmark)
  const setBookmarks = useChatStore((s) => s.setBookmarks)
  const removeBookmark = useChatStore((s) => s.removeBookmark)
  return useMutation({
    mutationFn: async (args: { channelId: string; bookmarkId: string; patch: Parameters<typeof client4.updateChannelBookmark>[2]; connectionId: string }) => {
      const res = await client4.updateChannelBookmark(args.channelId, args.bookmarkId, args.patch, args.connectionId)
      return res as unknown as { updated?: Parameters<typeof upsertBookmark>[0]; deleted?: Parameters<typeof removeBookmark>[1] }
    },
    onSuccess: (res, args) => {
      // The response carries the full sorted list when ordering changes, OR an
      // updated bookmark. Apply whatever is present.
      if (res.updated) upsertBookmark(res.updated)
      // If the edit caused a reorder, the server returns the full list via the
      // WS channel_bookmark_* events which already update the store; nothing to do.
      void setBookmarks
      void args
    },
  })
}

/** Reorder a bookmark (POST sort_order). Returns the full sorted list. */
export function useReorderBookmark() {
  const setBookmarks = useChatStore((s) => s.setBookmarks)
  return useMutation({
    mutationFn: async (args: { channelId: string; bookmarkId: string; newOrder: number; connectionId: string }) => {
      const list = await client4.updateChannelBookmarkSortOrder(args.channelId, args.bookmarkId, args.newOrder, args.connectionId)
      return list as unknown as Parameters<typeof setBookmarks>[1]
    },
    onSuccess: (list, args) => setBookmarks(args.channelId, list),
  })
}

// ─── User status + custom status ────────────────────────────────────
export function useUpdateStatus() {
  const setStatus = useChatStore((s) => s.setStatus)
  return useMutation({
    mutationFn: async (args: { userId: string; status: string }) => client4.updateStatus({ user_id: args.userId, status: args.status } as never),
    onSuccess: (_data, args) => setStatus(args.userId, args.status as PresenceStatusLike),
  })
}

export function useUpdateCustomStatus() {
  return useMutation({
    mutationFn: async (customStatus: { emoji: string; text: string; duration?: string; expires_at?: number }) =>
      client4.updateCustomStatus(customStatus as never),
  })
}

export function useUnsetCustomStatus() {
  return useMutation({ mutationFn: async () => client4.unsetCustomStatus() })
}

// ─── Selector hooks (re-export store selectors for components) ──────

export { unreadCount, mentionCount }
