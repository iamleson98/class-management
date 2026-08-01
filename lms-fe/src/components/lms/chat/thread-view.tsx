'use client'

/**
 * Thread viewer — ports the vendored webapp's thread pane (thread_viewer.tsx):
 *   - loads the root post + all replies via getPostThread (Client4)
 *   - renders root + replies oldest-first (sorted by create_at)
 *   - reply composer posts with root_id = the thread root
 *   - marks the thread read on open (updateThreadReadForUser)
 */

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import { format } from 'date-fns'
import { X, CornerUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/lms/shared/avatar'
import { useThread, useUsers, useCurrentUserId } from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { client4 } from '@/lib/chat/client'
import { userDisplayName, type ChatPost } from '@/lib/chat/types'
import { displayUsername } from '@/lib/chat/utils'
import { PostComposer } from './post-composer'
import { useTranslation } from '@/lib/i18n'
import { useEffect } from 'react'

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

  // Mark thread read on open (webapp: updateThreadRead when unread).
  useEffect(() => {
    if (userId && teamId) {
      client4.updateThreadReadForUser?.(userId, teamId, rootId, Date.now()).catch(() => {
        // best-effort; some server builds may not expose this
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId])

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="h-12 flex items-center gap-2 px-3 border-b shrink-0">
        <CornerUpRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{t('chat.thread', 'Chuỗi trả lời')}</span>
        <div className="flex-1" />
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
            posts.map((post) => {
              const author = users[post.user_id]
              const name = userDisplayName(author)
              const isOwn = post.user_id === userId
              const isRoot = post.id === rootId
              return (
                <div key={post.id} className={`flex gap-2.5 ${isRoot ? 'pb-3 border-b mb-1' : ''}`}>
                  <Avatar name={name} size="sm" className="mt-0.5" />
                  <div className="flex flex-col max-w-[80%]">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold">{name}</span>
                      <span className="text-[10px] text-muted-foreground/70">{format(new Date(post.create_at), 'HH:mm')}</span>
                    </div>
                    <div className={`rounded-2xl px-3.5 py-2 text-sm break-words ${isOwn ? 'bg-sky-600 text-white rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{post.message}</ReactMarkdown>
                      </div>
                    </div>
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
