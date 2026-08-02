/**
 * Thread domain types — ports the vendored webapp's UserThread shape
 * (@mattermost/types/threads) so the new lms-fe chat can model threads the
 * same way the server does.
 *
 * A "Thread" in Mattermost is scoped to the current user: it carries the
 * per-user state (unread_replies, unread_mentions, is_following, last_viewed_at)
 * alongside the global thread metadata (reply_count, last_reply_at, participants).
 * The thread's `id` IS the root post id.
 */

import type { ChatPost } from './types'

export interface ChatThreadParticipant {
  id: string
}

export interface ChatThread {
  /** The thread id — identical to the root post id. */
  id: string
  /** Total replies in the thread (excluding the root). */
  reply_count: number
  /** Epoch ms of the most recent reply (0 if no replies). */
  last_reply_at: number
  /** Epoch ms the current user last viewed the thread. */
  last_viewed_at: number
  /** Users who participated (root author + repliers). */
  participants: ChatThreadParticipant[]
  /** Unread replies since the current user last viewed. */
  unread_replies: number
  /** Unread mentions in this thread since last viewed. */
  unread_mentions: number
  /** Whether the current user is following the thread. */
  is_following: boolean
  /** The root post's channel + author. */
  post: {
    channel_id: string
    user_id: string
  }
}

/** Thread counts envelope (from getUserThreads with totalsOnly). */
export interface ChatThreadCounts {
  total: number
  total_unread_threads: number
  total_unread_mentions: number
  total_unread_urgent_mentions?: number
}

/** Threads list envelope (from getUserThreads with extended/threadsOnly). */
export interface ChatThreadList {
  total: number
  total_unread_threads: number
  total_unread_mentions: number
  total_unread_urgent_mentions?: number
  threads: (ChatThread & { post: ChatPost })[]
}

/**
 * Whether a thread is "synthetic" — derived from a Post because no server-side
 * UserThread has been hydrated yet. Synthetic threads lack unread/last_viewed
 * state. We treat a thread as synthetic when last_reply_at is 0 (no hydration).
 */
export function threadIsSynthetic(thread: ChatThread): boolean {
  return thread.last_reply_at === 0
}
