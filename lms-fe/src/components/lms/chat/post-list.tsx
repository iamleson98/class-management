'use client'

import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import { format, isSameDay } from 'date-fns'
import {
  Hash, Lock, Pin, CornerUpRight, Smile, Download, Loader2, Bookmark,
} from 'lucide-react'
import { Avatar } from '@/components/lms/shared/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/lib/chat/store'
import {
  useChannelPosts, useEditPost, useDeletePost, useToggleReaction,
  useUsers, useCurrentUserId, usePinPost, useToggleFlag, useMarkPostUnread,
} from '@/lib/chat/hooks'
import { userDisplayName, type ChatPost } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'
import { TypingIndicator } from './typing-indicator'
import { MessageContent } from './message-content'
import { PostMenu } from './post-menu'
import { shortcodeToUnicode } from '@/lib/chat/emoji-data'

interface PostListProps {
  channelId: string
  onOpenThread: (rootId: string) => void
  onForward?: (post: ChatPost) => void
  onShowEditHistory?: (postId: string) => void
}

// A small set of quick reactions shown under each post.
const QUICK_EMOJIS = ['👍', '❤️', '🎉', '😂', '👀']

function sameDay(a: number, b: number): boolean {
  return isSameDay(new Date(a), new Date(b))
}

export function PostList({ channelId, onOpenThread, onForward, onShowEditHistory }: PostListProps) {
  const { t } = useTranslation()
  const userId = useCurrentUserId()
  const postMap = useChatStore((s) => s.postsByChannel[channelId]?.byId ?? {})
  const order = useChatStore((s) => s.postsByChannel[channelId]?.order ?? [])
  const channels = useChatStore((s) => s.channels)
  const { loadOlder, hasOlder, loading } = useChannelPosts(channelId)
  const editPost = useEditPost()
  const deletePost = useDeletePost()
  const toggleReaction = useToggleReaction(userId)
  const pinPost = usePinPost()
  const toggleFlag = useToggleFlag(userId)
  const markUnread = useMarkPostUnread(userId)
  const flagged = useChatStore((s) => s.flagged)

  const channel = channels[channelId]
  const scrollRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  // Resolve all unique author ids → profiles (one batched call).
  const authorIds = useMemo(
    () => Array.from(new Set(order.map((id) => postMap[id]?.user_id).filter(Boolean))) as string[],
    [order, postMap],
  )
  useUsers(authorIds)
  const users = useChatStore((s) => s.users)

  // Build the visible rows (root posts only; replies collapse into a count).
  // Posts come newest-first from the store; render oldest→newest for reading.
  const rows = useMemo(() => {
    const visible = order
      .map((id) => postMap[id])
      .filter((p): p is ChatPost => !!p && p.delete_at === 0 && !p.root_id)
      .reverse() // oldest-first for display
    const out: Array<{ type: 'date'; key: string; at: number } | { type: 'post'; key: string; post: ChatPost }> = []
    let lastDay = 0
    for (const post of visible) {
      if (!sameDay(lastDay, post.create_at)) {
        out.push({ type: 'date', key: `d-${post.create_at}`, at: post.create_at })
        lastDay = post.create_at
      }
      out.push({ type: 'post', key: post.id, post })
    }
    return out
  }, [order, postMap])

  // Auto-scroll to bottom when new posts arrive.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const viewport = el.querySelector('[data-radix-scroll-area-viewport]') ?? el
    viewport.scrollTop = viewport.scrollHeight
  }, [rows.length, channelId])

  // Load older when the user scrolls to the top.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const viewport = el.querySelector('[data-radix-scroll-area-viewport]') ?? el
    if (viewport.scrollTop < 50 && hasOlder && !loading) {
      loadOlder()
    }
  }, [hasOlder, loading, loadOlder])

  const startEdit = (post: ChatPost) => {
    setEditingId(post.id)
    setDraft(post.message)
  }
  const saveEdit = async (postId: string) => {
    await editPost.mutateAsync({ postId, message: draft })
    setEditingId(null)
    setDraft('')
  }

  if (order.length === 0 && loading) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea ref={scrollRef as never} className="flex-1 min-h-0" onScroll={handleScroll}>
        <div className="p-4 space-y-1 max-w-4xl mx-auto">
          {hasOlder && (
            <div className="flex justify-center py-2">
              <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loading}>
                {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {t('chat.loadOlder', 'Tải tin nhắn cũ hơn')}
              </Button>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                {channel?.type === 'P' ? <Lock className="h-5 w-5 text-muted-foreground" /> : <Hash className="h-5 w-5 text-muted-foreground" />}
              </div>
              <p className="text-sm text-muted-foreground">{t('chat.empty', 'Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!')}</p>
            </div>
          ) : (
            rows.map((row) =>
              row.type === 'date' ? (
                <div key={row.key} className="flex items-center justify-center py-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70 bg-muted/60 rounded-full px-3 py-1">
                    {format(new Date(row.at), 'dd/MM/yyyy')}
                  </span>
                </div>
              ) : (
                <PostRow
                  key={row.key}
                  post={row.post}
                  isOwn={row.post.user_id === userId}
                  authorName={userDisplayName(users[row.post.user_id])}
                  isFlagged={flagged.has(row.post.id)}
                  onOpenThread={() => onOpenThread(row.post.id)}
                  editing={editingId === row.post.id}
                  draft={draft}
                  setDraft={setDraft}
                  onStartEdit={() => startEdit(row.post)}
                  onSaveEdit={() => saveEdit(row.post.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={() => deletePost.mutate(row.post.id)}
                  onToggleReaction={(emoji) => toggleReaction.mutate({ postId: row.post.id, emojiName: emoji })}
                  onTogglePin={() => pinPost.mutate({ postId: row.post.id, pin: !row.post.is_pinned })}
                  onToggleFlag={() => toggleFlag.mutate({ postId: row.post.id, flag: !flagged.has(row.post.id) })}
                  onMarkUnread={() => markUnread.mutate({ postId: row.post.id, channelId: row.post.channel_id })}
                  onForward={() => onForward?.(row.post)}
                  onShowEditHistory={() => onShowEditHistory?.(row.post.id)}
                  canModerate={row.post.user_id === userId}
                />
              ),
            )
          )}
        </div>
      </ScrollArea>
      <TypingIndicator channelId={channelId} />
    </div>
  )
}

interface PostRowProps {
  post: ChatPost
  isOwn: boolean
  authorName: string
  isFlagged: boolean
  onOpenThread: () => void
  editing: boolean
  draft: string
  setDraft: (v: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  onToggleReaction: (emoji: string) => void
  onTogglePin: () => void
  onToggleFlag: () => void
  onMarkUnread: () => void
  onForward: () => void
  onShowEditHistory: () => void
  canModerate: boolean
}

function PostRow(props: PostRowProps) {
  const { post, isOwn, authorName, isFlagged, onOpenThread, editing, draft, setDraft, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onToggleReaction, onTogglePin, onToggleFlag, onMarkUnread, onForward, onShowEditHistory, canModerate } = props
  const { t } = useTranslation()
  const reactions = useChatStore((s) => s.reactionsByPost[post.id] ?? [])
  const currentUserId = useCurrentUserId()
  const [showEmoji, setShowEmoji] = useState(false)

  // Group reactions by emoji + whether the current user reacted.
  const grouped = useMemo(() => {
    const m: Record<string, { count: number; mine: boolean }> = {}
    for (const r of reactions) {
      if (!m[r.emoji_name]) m[r.emoji_name] = { count: 0, mine: false }
      m[r.emoji_name].count += 1
      if (r.user_id === currentUserId) m[r.emoji_name].mine = true
    }
    return m
  }, [reactions, currentUserId])

  return (
    <div className={`group flex gap-2.5 py-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar name={authorName} size="sm" className="mt-0.5" />
      <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className="flex items-baseline gap-2 mb-0.5">
          {!isOwn && <span className="text-xs font-semibold">{authorName}</span>}
          <span className="text-[10px] text-muted-foreground/70">{format(new Date(post.create_at), 'HH:mm')}</span>
          {post.edit_at > 0 && (
            <button
              onClick={onShowEditHistory}
              className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground italic"
            >
              ({t('chat.edited', 'đã sửa')})
            </button>
          )}
          {post.is_pinned && <Pin className="h-3 w-3 text-amber-500" />}
        </div>

        {editing ? (
          <div className="flex flex-col gap-1.5 w-full">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm resize-none min-h-16"
              autoFocus
            />
            <div className="flex gap-1.5 justify-end">
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>{t('common.cancel', 'Hủy')}</Button>
              <Button size="sm" onClick={onSaveEdit}>{t('common.save', 'Lưu')}</Button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-2xl px-3.5 py-2 text-sm break-words ${
              isOwn ? 'bg-sky-600 text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'
            }`}
          >
            <MessageContent post={post} isOwn={isOwn} />
            {post.file_ids && post.file_ids.length > 0 && <FileAttachments fileIds={post.file_ids} isOwn={isOwn} />}
          </div>
        )}

        {/* Reactions */}
        {Object.keys(grouped).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
            {Object.entries(grouped).map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => onToggleReaction(emoji)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${
                  info.mine
                    ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                    : 'bg-background border-border hover:bg-muted'
                }`}
              >
                <span>{shortcodeToUnicode(emoji) ?? `:${emoji}:`}</span>
                <span className="font-medium">{info.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Hover actions */}
        <div className={`flex items-center gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'flex-row-reverse' : ''}`}>
          <div className="relative">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowEmoji((v) => !v)}>
              <Smile className="h-3.5 w-3.5" />
            </Button>
            {showEmoji && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />
                <div className={`absolute top-full ${isOwn ? 'right-0' : 'left-0'} z-50 mt-1 flex gap-1 rounded-lg border bg-popover shadow-lg p-1.5`}>
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => { onToggleReaction(emoji); setShowEmoji(false) }}
                      className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center text-base"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenThread} title={t('chat.reply', 'Trả lời')}>
            <CornerUpRight className="h-3.5 w-3.5" />
          </Button>
          {isFlagged && <Bookmark className="h-3 w-3 text-amber-500" />}
          <PostMenu
            post={post}
            canEdit={canModerate}
            isFlagged={isFlagged}
            onReply={onOpenThread}
            onReact={onToggleReaction}
            onForward={() => onForward()}
            onMarkUnread={onMarkUnread}
            onToggleFlag={onToggleFlag}
            onTogglePin={onTogglePin}
            onEdit={onStartEdit}
            onDelete={onDelete}
            align={isOwn ? 'end' : 'start'}
          />
        </div>
      </div>
    </div>
  )
}

/** Render file attachments with image previews + download links. */
function FileAttachments({ fileIds, isOwn }: { fileIds: string[]; isOwn: boolean }) {
  const { t } = useTranslation()
  return (
    <div className={`flex flex-wrap gap-1.5 ${isOwn ? 'pt-1' : 'pt-1'}`}>
      {fileIds.map((fid) => (
        <a
          key={fid}
          href={`/api/v4/files/${fid}?download=1`}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
            isOwn ? 'bg-sky-700/50 hover:bg-sky-700/70' : 'bg-background hover:bg-background/70 border'
          }`}
        >
          <Download className="h-3 w-3" />
          <span className="truncate max-w-32">{t('chat.attachment', 'Tệp đính kèm')}</span>
        </a>
      ))}
    </div>
  )
}
