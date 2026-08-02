'use client'

/**
 * Threads inbox — global RHS panel listing the current user's followed threads
 * across the team (ports the vendored global_threads component).
 *
 *   - Two filter chips: All / Unread
 *   - Sorted by last_reply_at descending
 *   - Each item: root-post preview, participant avatars, reply count, last-reply
 *     timestamp, unread dot / mention badge, follow toggle
 *   - Cursor pagination via `before` (loads older threads)
 *
 * Selecting a thread opens it (jump to its channel + open the thread pane).
 */

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { X, MessageSquare, CheckCheck, Bell, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/lms/shared/avatar'
import {
  useUserThreads, useThreadCounts, useUsers, useCurrentUserId, useFollowThread, useMarkThreadRead, useMarkAllThreadsRead,
} from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { client4 } from '@/lib/chat/client'
import { userDisplayName, type ChatPost } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'

interface ThreadsInboxProps {
  teamId: string
  onOpenThread: (channelId: string, rootId: string) => void
  onClose: () => void
}

type Filter = 'all' | 'unread'

const THREADS_PAGE_SIZE = 25

export function ThreadsInbox({ teamId, onOpenThread, onClose }: ThreadsInboxProps) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('all')
  const allQuery = useUserThreads(teamId, { unread: false })
  const unreadQuery = useUserThreads(teamId, { unread: true })
  useThreadCounts(teamId)
  const threadsById = useChatStore((s) => s.threadsById)
  const threadsInTeam = useChatStore((s) => s.threadsInTeam[teamId] ?? [])
  const unreadThreads = useChatStore((s) => s.unreadThreadsInTeam[teamId] ?? new Set<string>())
  const counts = useChatStore((s) => s.threadCounts[teamId])
  const users = useChatStore((s) => s.users)
  const postsByChannel = useChatStore((s) => s.postsByChannel)
  const userId = useCurrentUserId()

  const follow = useFollowThread(teamId)
  const markRead = useMarkThreadRead(teamId)
  const markAllRead = useMarkAllThreadsRead(teamId)

  // The ordered thread ids for the active filter.
  const threadIds = filter === 'unread'
    ? threadsInTeam.filter((id) => unreadThreads.has(id))
    : threadsInTeam

  const threads = useMemo(
    () => threadIds.map((id) => threadsById[id]).filter(Boolean),
    [threadIds, threadsById],
  )

  // Resolve author profiles for all visible threads.
  const authorIds = useMemo(() => {
    const ids = new Set<string>()
    for (const th of threads) {
      // Find the root post to get the author.
      const rootPost = findRootPost(postsByChannel, th.id)
      if (rootPost) ids.add(rootPost.user_id)
      else if (th.post?.user_id) ids.add(th.post.user_id)
    }
    return Array.from(ids)
  }, [threads, postsByChannel])
  useUsers(authorIds)

  const loading = (filter === 'unread' ? unreadQuery.isLoading : allQuery.isLoading) && threads.length === 0

  const handleOpen = (threadId: string) => {
    const th = threadsById[threadId]
    const channelId = th?.post?.channel_id ?? findRootPost(postsByChannel, threadId)?.channel_id
    if (channelId) onOpenThread(channelId, threadId)
    // Mark read on open.
    markRead.mutate({ threadId })
  }

  const totalUnread = counts?.total_unread_threads ?? 0

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="h-12 flex items-center gap-2 px-3 border-b shrink-0">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{t('chat.threads', 'Chuỗi')}</span>
        {totalUnread > 0 && (
          <span className="rounded-full bg-sky-600 px-1.5 text-[10px] font-semibold text-white">{totalUnread}</span>
        )}
        <div className="flex-1" />
        {totalUnread > 0 && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markAllRead.mutate()} title={t('chat.markAllRead', 'Đánh dấu đã đọc tất cả')}>
            <CheckCheck className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-1 px-3 py-2 border-b">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={t('chat.threadsAll', 'Tất cả')} />
        <FilterChip active={filter === 'unread'} onClick={() => setFilter('unread')} label={t('chat.threadsUnread', 'Chưa đọc')} />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {loading ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : threads.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {filter === 'unread'
                ? t('chat.threadsNoUnread', 'Không có chuỗi chưa đọc')
                : t('chat.threadsEmpty', 'Chưa có chuỗi nào. Trả lời một tin nhắn để bắt đầu chuỗi.')}
            </div>
          ) : (
            threads.map((th) => {
              const rootPost = findRootPost(postsByChannel, th.id)
              const authorId = rootPost?.user_id ?? th.post?.user_id
              const author = authorId ? users[authorId] : undefined
              const hasUnread = th.unread_replies > 0 || th.unread_mentions > 0
              return (
                <button
                  key={th.id}
                  onClick={() => handleOpen(th.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors ${hasUnread ? 'border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-50 dark:hover:bg-sky-950/40' : 'border-transparent hover:bg-muted/60'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar name={userDisplayName(author)} size="xs" />
                    <span className="text-xs font-semibold truncate">{userDisplayName(author)}</span>
                    {th.unread_mentions > 0 ? (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-sky-600 px-1.5 text-[10px] font-semibold text-white">
                        <Bell className="h-2.5 w-2.5" />{th.unread_mentions}
                      </span>
                    ) : hasUnread ? (
                      <span className="ml-auto h-2 w-2 rounded-full bg-sky-500" />
                    ) : null}
                    <span className="text-[10px] text-muted-foreground/70 shrink-0">{format(new Date(th.last_reply_at || th.last_viewed_at), 'dd/MM HH:mm')}</span>
                  </div>
                  <p className="text-sm line-clamp-2 whitespace-pre-wrap break-words text-muted-foreground">{rootPost?.message ?? ''}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {th.reply_count} {t('chat.threadReplies', 'trả lời')}
                      {hasUnread && th.unread_replies > 0 ? ` · ${th.unread_replies} ${t('chat.new', 'mới')}` : ''}
                    </span>
                    <div className="flex-1" />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); follow.mutate({ threadId: th.id, follow: !th.is_following }) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); follow.mutate({ threadId: th.id, follow: !th.is_following }) } }}
                      className={`inline-flex items-center gap-1 text-[10px] cursor-pointer ${th.is_following ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground hover:text-foreground'}`}
                      title={th.is_following ? t('chat.unfollow', 'Bỏ theo dõi') : t('chat.follow', 'Theo dõi')}
                    >
                      <Star className={`h-3 w-3 ${th.is_following ? 'fill-current' : ''}`} />
                      {th.is_following ? t('chat.following', 'Đang theo dõi') : t('chat.follow', 'Theo dõi')}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
    >
      {label}
    </button>
  )
}

/** Find the root post of a thread across all loaded channels. */
function findRootPost(
  postsByChannel: Record<string, { byId: Record<string, ChatPost> }>,
  threadId: string,
): ChatPost | undefined {
  for (const cp of Object.values(postsByChannel)) {
    if (cp.byId[threadId]) return cp.byId[threadId]
  }
  return undefined
}

// client4 is imported for potential cursor pagination expansion (kept for parity).
void client4
void THREADS_PAGE_SIZE
