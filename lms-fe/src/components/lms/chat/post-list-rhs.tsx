'use client'

/**
 * Post-list RHS — a shared right pane that renders a list of posts for the
 * Saved/Flagged, Pinned, and Recent Mentions views (ports the webapp's rhs_thread
 * usage behind RHSStates.FLAG / PIN / MENTION). Each post is clickable to jump
 * to its channel (and thread if it's a reply).
 */

import { useMemo } from 'react'
import { format } from 'date-fns'
import { X, Bookmark, Pin, AtSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/lms/shared/avatar'
import {
  useFlaggedPosts, usePinnedPosts, useSearchPosts, useUsers, useCurrentUserId,
} from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { userDisplayName, type ChatPost } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'

type PostListKind = 'flagged' | 'pinned' | 'mentions'

interface PostListRhsProps {
  kind: PostListKind
  channelId?: string
  teamId?: string
  onJump: (post: ChatPost) => void
  onClose: () => void
}

const CONFIG: Record<PostListKind, { icon: typeof Bookmark; titleKey: string; titleDefault: string }> = {
  flagged: { icon: Bookmark, titleKey: 'chat.saved', titleDefault: 'Tin nhắn đã lưu' },
  pinned: { icon: Pin, titleKey: 'chat.pinned', titleDefault: 'Tin nhắn đã ghim' },
  mentions: { icon: AtSign, titleKey: 'chat.mentions', titleDefault: 'Đề cập đến tôi' },
}

export function PostListRhs({ kind, channelId, teamId, onJump, onClose }: PostListRhsProps) {
  const { t } = useTranslation()
  const userId = useCurrentUserId()
  const channels = useChatStore((s) => s.channels)
  const users = useChatStore((s) => s.users)
  const cfg = CONFIG[kind]

  // Mentions uses a search for the user's mention keys.
  const mentionSearch = useSearchPosts(teamId)

  const flaggedQuery = useFlaggedPosts(userId, teamId)
  const pinnedQuery = usePinnedPosts(channelId ?? null)

  const posts: ChatPost[] = useMemo(() => {
    if (kind === 'flagged') return flaggedQuery.data ?? []
    if (kind === 'pinned') return pinnedQuery.data ?? []
    // mentions: trigger search once on mount via the parent; here just read.
    return (mentionSearch.data ?? []).slice().sort((a, b) => b.create_at - a.create_at)
  }, [kind, flaggedQuery.data, pinnedQuery.data, mentionSearch.data])

  // Mentions: fire the search (built from current user's username) on mount.
  // useSearchPosts is a mutation; the parent ChatView triggers it. To keep this
  // panel self-contained, trigger it here when kind === 'mentions'.
  useMemo(() => {
    if (kind === 'mentions' && userId && teamId && !mentionSearch.isPending && !mentionSearch.data) {
      const me = useChatStore.getState().users[userId]
      if (me?.username) mentionSearch.mutate(`@${me.username}`)
    }
  }, [kind, userId, teamId, mentionSearch])

  const authorIds = useMemo(() => Array.from(new Set(posts.map((p) => p.user_id))), [posts])
  useUsers(authorIds)

  const loading = flaggedQuery.isLoading || pinnedQuery.isLoading

  const Icon = cfg.icon

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="h-12 flex items-center gap-2 px-3 border-b shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{t(cfg.titleKey, cfg.titleDefault)}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-1">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
          ) : posts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {kind === 'flagged' && t('chat.noSaved', 'Chưa có tin nhắn nào được lưu')}
              {kind === 'pinned' && t('chat.noPinned', 'Chưa có tin nhắn nào được ghim')}
              {kind === 'mentions' && t('chat.noMentions', 'Chưa có đề cập nào')}
            </div>
          ) : (
            posts.map((post) => {
              const author = users[post.user_id]
              const channel = channels[post.channel_id]
              return (
                <button
                  key={post.id}
                  onClick={() => onJump(post)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-muted/60 transition-colors border border-transparent hover:border-border"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar name={userDisplayName(author)} size="xs" />
                    <span className="text-xs font-semibold truncate">{userDisplayName(author)}</span>
                    <span className="text-[10px] text-muted-foreground/70 ml-auto">{format(new Date(post.create_at), 'dd/MM/yy HH:mm')}</span>
                  </div>
                  <p className="text-sm line-clamp-3 whitespace-pre-wrap break-words">{post.message}</p>
                  {channel && <div className="mt-1 text-[10px] text-muted-foreground/70 truncate">#{channel.display_name}</div>}
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
