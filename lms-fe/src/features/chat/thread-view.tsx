'use client'

/**
 * Thread viewer — ports the vendored webapp's thread pane (thread_viewer.tsx):
 *   - loads the root post + all replies via getPostThread (Client4)
 *   - renders root + replies oldest-first (sorted by create_at)
 *   - reply composer posts with root_id = the thread root
 *   - marks the thread read on open (updateThreadReadForUser)
 */

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { X, CornerUpRight, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/shared/avatar'
import { useThread, useUsers, useCurrentUserId, useFollowThread, useMarkThreadRead, useToggleReaction } from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { client4 } from '@/lib/chat/client'
import { userDisplayName, type ChatPost } from '@/lib/chat/types'
import { displayUsername } from '@/lib/chat/utils'
import { PostComposer } from './post-composer'
import { MessageContent } from './message-content'
import { FileAttachments } from './file-attachments'
import { QuickReactionBar, ReactionPills } from './reactions'
import { nameColorClass, MESSAGE_GROUP_WINDOW_MS } from './message-style'
import { CallPostCard } from '@/features/calls/call-post'
import { useTranslation } from '@/lib/i18n'

interface ThreadViewProps {
  channelId: string
  rootId: string
  teamId?: string
  onClose: () => void
}

export function ThreadView({ channelId, rootId, teamId, onClose }: ThreadViewProps) {
  const { t } = useTranslation()
  const userId = useCurrentUserId()
  const threadQuery = useThread(rootId)
  const users = useChatStore((s) => s.users)
  const rootPost = useChatStore((s) => s.postsByChannel[channelId]?.byId[rootId])
  const threadMeta = useChatStore((s) => s.threadsById[rootId])
  const follow = useFollowThread(teamId)
  const toggleReaction = useToggleReaction(userId)
  // Which thread message currently shows its extended emoji popover. Reset on
  // row un-hover so the popover never lingers invisibly on the next hover.
  const [emojiOpenId, setEmojiOpenId] = useState<string | null>(null)
  // TanStack Query's useMutation returns a NEW result object on every render
  // (the observer result is spread into a fresh object); only `mutate` is
  // referentially stable. Putting the mutation RESULT in the effect deps
  // below re-fired the effect on every render — each run re-fetched
  // getUserThread and re-ran the mutation, whose store updates re-rendered
  // this component, creating an infinite request loop against
  // /api/v4/users/{uid}/teams/{tid}/threads/{id}. Destructure the stable
  // `mutate` instead.
  const markReadMutate = useMarkThreadRead(teamId).mutate

  // Collect all post ids in this thread (root + replies) from the store.
  const posts = useMemo(() => {
    const byId = useChatStore.getState().postsByChannel[channelId]?.byId ?? {}
    const root = byId[rootId]
    const replies = Object.values(byId).filter((p): p is ChatPost => !!p && p.root_id === rootId && p.delete_at === 0)
    const list = root && root.delete_at === 0 ? [root, ...replies] : replies
    return list.sort((a, b) => a.create_at - b.create_at)
  }, [channelId, rootId, users, threadQuery.data])

  // Resolve author profiles.
  const authorIds = useMemo(() => Array.from(new Set(posts.map((p) => p.user_id))), [posts])
  useUsers(authorIds)

  // Mark thread read on open (gated — only if there's actually something to
  // clear, mirroring the vendored updateThreadRead gate).
  useEffect(() => {
    markReadMutate({ threadId: rootId })
    // Fetch thread metadata so the follow button + indicators reflect server state.
    if (userId && teamId) {
      client4.getUserThread(userId, teamId, rootId, false).then((full) => {
        const { post, ...meta } = full as typeof full & { post: ChatPost }
        void post
        useChatStore.getState().receiveThread(teamId, meta as import('@/lib/chat/threads').ChatThread)
      }).catch(() => { /* best-effort */ })
    }
  }, [rootId, teamId, userId, markReadMutate])

  const isFollowing = threadMeta?.is_following ?? false
  const unreadReplies = threadMeta?.unread_replies ?? 0

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="h-12 flex items-center gap-2 px-3 border-b shrink-0">
        <CornerUpRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{t('chat.thread', 'Chuỗi trả lời')}</span>
        {unreadReplies > 0 && (
          <span className="rounded-full bg-sky-100 dark:bg-sky-950 px-1.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">{unreadReplies} {t('chat.new', 'mới')}</span>
        )}
        <div className="flex-1" />
        <Button
          variant={isFollowing ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => follow.mutate({ threadId: rootId, follow: !isFollowing })}
          disabled={follow.isPending}
        >
          <Star className={`h-3.5 w-3.5 ${isFollowing ? 'fill-current' : ''}`} />
          {isFollowing ? t('chat.following', 'Đang theo dõi') : t('chat.follow', 'Theo dõi')}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {threadQuery.isLoading && posts.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-2.5">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-3/4" /></div>
                </div>
              ))}
            </div>
          ) : (
            posts.map((post, i) => {
              const author = users[post.user_id]
              const name = userDisplayName(author)
              const isOwn = post.user_id === userId
              const isRoot = post.id === rootId
              const groupStart = i === 0 || posts[i - 1].user_id !== post.user_id || post.create_at - posts[i - 1].create_at > MESSAGE_GROUP_WINDOW_MS
              if ((post.type as string) === 'custom_calls') {
                return <CallPostCard key={post.id} post={post} />
              }
              return (
                <div
                  key={post.id}
                  className={`group/row relative flex gap-2.5 ${isRoot ? 'pb-2 border-b mb-1' : groupStart ? 'py-1.5' : 'py-0.5'} ${isOwn ? 'flex-row-reverse' : ''}`}
                  onMouseLeave={() => setEmojiOpenId((id) => (id === post.id ? null : id))}
                >
                  {groupStart ? (
                    <Avatar name={name} size="sm" className="mt-0.5 shrink-0" />
                  ) : (
                    <div className="w-8 shrink-0 pt-1 text-center">
                      <span className="hidden group-hover/row:block text-[10px] tabular-nums text-muted-foreground/80 select-none">{format(new Date(post.create_at), 'HH:mm')}</span>
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[80%] ${isOwn ? 'items-end' : 'items-start'}`}>
                    {groupStart && (
                      <div className="flex items-baseline gap-2 mb-0.5 min-w-0">
                        {!isOwn && <span className={`text-[13px] font-semibold truncate ${nameColorClass(post.user_id)}`}>{name}</span>}
                        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{format(new Date(post.create_at), 'HH:mm')}</span>
                        {isOwn && <span className="hidden group-hover/row:inline text-[10px] text-muted-foreground/60">· {t('chat.you', 'bạn')}</span>}
                      </div>
                    )}
                    <div
                      className={`relative text-sm leading-relaxed wrap-break-word rounded-2xl px-3.5 py-2 ${
                        isOwn
                          ? `bg-primary text-primary-foreground rounded-br-sm ${!groupStart ? 'rounded-tr-sm' : ''}`
                          : `bg-muted text-foreground rounded-bl-sm ${!groupStart ? 'rounded-tl-sm' : ''}`
                      }`}
                    >
                      <MessageContent post={post} isOwn={isOwn} />
                      {post.file_ids && post.file_ids.length > 0 && <FileAttachments post={post} isOwn={false} />}
                      {/* Quick-reaction bar — hovers directly above the bubble,
                          anchored to its own edge (stays close to the message). */}
                      <QuickReactionBar
                        onToggle={(emoji) => toggleReaction.mutate({ postId: post.id, emojiName: emoji })}
                        align={isOwn ? 'end' : 'start'}
                        emojiOpen={emojiOpenId === post.id}
                        onEmojiOpenChange={(open) => setEmojiOpenId(open ? post.id : null)}
                      />
                    </div>
                    {/* Reactions — pill chips under the message */}
                    <ReactionPills
                      postId={post.id}
                      onToggle={(emoji) => toggleReaction.mutate({ postId: post.id, emojiName: emoji })}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      <PostComposer
        channelId={channelId}
        rootId={rootId}
        teamId={teamId}
        placeholder={t('chat.replyPlaceholder', 'Trả lời trong chuỗi…')}
      />
    </div>
  )
}
