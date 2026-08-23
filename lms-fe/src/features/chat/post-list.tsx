'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useCallback, useState } from 'react'
import { format, isSameDay } from 'date-fns'
import {
  Hash, Lock, Pin, CornerUpRight, Smile, Loader2, Bookmark,
} from 'lucide-react'
import { Avatar } from '@/components/shared/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { FileAttachments } from './file-attachments'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  /** Jump to a permalinks post (switches channel/thread if needed). */
  onJumpToPost?: (postId: string) => void
}

// Scroll thresholds ported from the vendored post_list_virtualized.tsx.
const HEIGHT_TRIGGER_FOR_MORE_POSTS = 1000 // px from an edge to trigger paging
const BUFFER_TO_BE_CONSIDERED_BOTTOM = 100 // px: within this of the bottom = "at bottom"

// A small set of quick reactions shown under each post.
const QUICK_EMOJIS = ['👍', '❤️', '🎉', '😂', '👀']
const EMPTY_POST_MAP: Record<string, ChatPost> = Object.freeze({})
const EMPTY_POST_ORDER = Object.freeze([])

function sameDay(a: number, b: number): boolean {
  return isSameDay(new Date(a), new Date(b))
}

export function PostList({ channelId, onOpenThread, onForward, onShowEditHistory, onJumpToPost }: PostListProps) {
  const { t } = useTranslation()
  const userId = useCurrentUserId()
  const channelPosts = useChatStore((s) => s.postsByChannel[channelId])
  const postMap = useMemo(() => channelPosts?.byId ?? EMPTY_POST_MAP, [channelPosts])
  const order = useMemo(() => channelPosts?.order ?? EMPTY_POST_ORDER, [channelPosts])
  const channels = useChatStore((s) => s.channels)
  const membership = useChatStore((s) => s.memberships[channelId])
  const { loadOlder, loadNewer, hasOlder, hasNewer, loading } = useChannelPosts(channelId)
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
  // Post pending deletion — renders a confirm dialog (ports DeletePostModal).
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  // The post currently hovered (used as the target for single-key shortcuts).
  const hoveredPostRef = useRef<ChatPost | null>(null)
  const setHoveredPost = useCallback((post: ChatPost | null) => { hoveredPostRef.current = post }, [])

  // ── Scroll-position bookkeeping (ports the vendored class component's
  //    getSnapshotBeforeUpdate / componentDidUpdate scroll correction) ──
  // Whether the user is currently parked at the bottom of the list. Drives the
  // "only auto-scroll to bottom when already there" behavior so reading history
  // isn't interrupted by an incoming post.
  const atBottomRef = useRef(true)
  // Snapshot taken just before a top-prepend (loadOlder) mutates the list, used
  // to keep the viewport anchored to the same post after height changes.
  const pendingScrollRestore = useRef<{ top: number; height: number } | null>(null)
  // The newest post id we last saw, to detect genuine new-message appends.
  const prevNewestId = useRef<string | undefined>(order[0])
  // Track channel switches so the initial scroll-to-bottom only fires on switch,
  // not on every post arrival.
  const didInitialScroll = useRef(false)

  // Resolve all unique author ids → profiles (one batched call).
  const authorIds = useMemo(
    () => Array.from(new Set(order.map((id) => postMap[id]?.user_id).filter(Boolean))) as string[],
    [order, postMap],
  )
  useUsers(authorIds)
  const users = useChatStore((s) => s.users)

  // Build the visible rows (root posts only; replies counted for a thread
  // indicator). Posts come newest-first from the store; render oldest→newest.
  // Also injects a "New Messages" unread divider at the last-viewed boundary.
  const rows = useMemo(() => {
    const lastViewedAt = membership?.last_viewed_at ?? 0
    // Count replies per root post from the full post map (root + replies).
    const replyCountByRoot: Record<string, number> = {}
    for (const id of order) {
      const p = postMap[id]
      if (p && p.delete_at === 0 && p.root_id) {
        replyCountByRoot[p.root_id] = (replyCountByRoot[p.root_id] ?? 0) + 1
      }
    }
    const visible = order
      .map((id) => postMap[id])
      .filter((p): p is ChatPost => !!p && p.delete_at === 0 && !p.root_id)
      .reverse() // oldest-first for display
    type Row =
      | { type: 'date'; key: string; at: number }
      | { type: 'post'; key: string; post: ChatPost; replyCount: number }
      | { type: 'unread'; key: string }
    const out: Row[] = []
    let lastDay = 0
    let unreadInserted = lastViewedAt === 0 // no divider if never viewed
    for (const post of visible) {
      if (!sameDay(lastDay, post.create_at)) {
        out.push({ type: 'date', key: `d-${post.create_at}`, at: post.create_at })
        lastDay = post.create_at
      }
      // Insert the unread divider before the first post newer than last_viewed_at.
      if (!unreadInserted && post.create_at > lastViewedAt) {
        out.push({ type: 'unread', key: 'unread-divider' })
        unreadInserted = true
      }
      out.push({ type: 'post', key: post.id, post, replyCount: replyCountByRoot[post.id] ?? post.reply_count ?? 0 })
    }
    return out
  }, [order, postMap, membership])

  // The latest visible post, for screen-reader announcement (aria-live).
  const latestPostAria = useMemo(() => {
    const postRows = rows.filter((r): r is { type: 'post'; key: string; post: ChatPost; replyCount: number } => r.type === 'post')
    const latest = postRows[postRows.length - 1]
    if (!latest) return ''
    const author = users[latest.post.user_id]
    const name = userDisplayName(author)
    return `${name}: ${latest.post.message}`
  }, [rows, users])

  // The oldest displayed post id — used to detect a top-prepend (older posts
  // loaded) vs. a bottom-append (new post) so we can correct scroll correctly.
  const oldestDisplayedId = rows.find((r) => r.type === 'post')?.key
  const prevOldestId = useRef<string | undefined>(oldestDisplayedId)

  // Reset the initial-scroll flag whenever the channel changes so the first
  // render of a new channel snaps to the bottom once.
  useEffect(() => {
    didInitialScroll.current = false
    atBottomRef.current = true
    prevNewestId.current = order[0]
  }, [channelId, order])

  // Resolve the scrollable viewport from the ScrollArea. Queried fresh each
  // call (the ref's current node can change across renders).
  const getViewport = useCallback((): HTMLElement | null => {
    const el = scrollRef.current
    if (!el) return null
    return (el.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null) ?? el
  }, [])

  // Set scrollTop on a viewport in a way that satisfies the hooks immutability
  // rule (assigning through a local, hook-untraced variable).
  const setScrollTop = useCallback((node: HTMLElement | null, value: number) => {
    if (node) node.scrollTop = value
  }, [])

  // Capture the viewport geometry before a top-prepend mutates the DOM, so the
  // layout effect below can restore the anchor. We detect a prepend by the
  // oldest id changing (older posts were added above the current oldest).
  const captureBeforePrepend = useCallback(() => {
    const viewport = getViewport()
    if (!viewport) return
    pendingScrollRestore.current = { top: viewport.scrollTop, height: viewport.scrollHeight }
  }, [getViewport])

  // Restore scroll position after a top-prepend, or auto-scroll to bottom on a
  // new message — but only if the user was already at the bottom.
  useLayoutEffect(() => {
    const viewport = getViewport()
    if (!viewport) return

    // Initial load / channel switch → snap to bottom once.
    if (!didInitialScroll.current) {
      setScrollTop(viewport, viewport.scrollHeight)
      didInitialScroll.current = true
      prevOldestId.current = oldestDisplayedId
      prevNewestId.current = order[0]
      return
    }

    // Top-prepend (older posts loaded): keep the viewport anchored.
    if (oldestDisplayedId !== prevOldestId.current && pendingScrollRestore.current) {
      const { top, height } = pendingScrollRestore.current
      const newHeight = viewport.scrollHeight
      setScrollTop(viewport, top + (newHeight - height))
      pendingScrollRestore.current = null
      prevOldestId.current = oldestDisplayedId
      prevNewestId.current = order[0]
      return
    }

    // New message appended at the bottom → only follow if the user was at the
    // bottom (don't yank them down while reading history).
    if (order[0] !== prevNewestId.current && atBottomRef.current) {
      setScrollTop(viewport, viewport.scrollHeight)
    }
    prevOldestId.current = oldestDisplayedId
    prevNewestId.current = order[0]
  }, [rows.length, channelId, oldestDisplayedId, order])

  // Scroll handler: track at-bottom state + trigger bidirectional paging.
  const handleScroll = useCallback(() => {
    const viewport = getViewport()
    if (!viewport) return
    const { scrollTop, scrollHeight, clientHeight } = viewport
    const offsetFromBottom = scrollHeight - clientHeight - scrollTop

    // Update "at bottom" (drives smart auto-scroll on new posts).
    atBottomRef.current = offsetFromBottom <= BUFFER_TO_BE_CONSIDERED_BOTTOM && scrollHeight > 0

    // Bidirectional paging (ports the virtualized list's edge triggers).
    if (scrollTop < HEIGHT_TRIGGER_FOR_MORE_POSTS && hasOlder && !loading) {
      captureBeforePrepend()
      loadOlder()
    } else if (offsetFromBottom < HEIGHT_TRIGGER_FOR_MORE_POSTS && hasNewer && !loading) {
      loadNewer()
    }
  }, [getViewport, hasOlder, hasNewer, loading, loadOlder, loadNewer, captureBeforePrepend])

  const startEdit = (post: ChatPost) => {
    setEditingId(post.id)
    setDraft(post.message)
  }
  const saveEdit = async (postId: string) => {
    await editPost.mutateAsync({ postId, message: draft })
    setEditingId(null)
    setDraft('')
  }

  // Per-message keyboard shortcuts (ports dot_menu handleMenuKeydown). Single-key
  // shortcuts act on the hovered post, but only when the composer isn't focused
  // (so typing a message doesn't trigger actions).
  const openThreadHandler = useRef(onOpenThread)
  useEffect(() => { openThreadHandler.current = onOpenThread }, [onOpenThread])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea/contenteditable, or with a modifier.
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const post = hoveredPostRef.current
      if (!post) return
      switch (e.key.toLowerCase()) {
        case 'r': // Reply
          e.preventDefault(); openThreadHandler.current(post.id); break
        case 'e': // Edit (own posts only)
          if (post.user_id === userId) { e.preventDefault(); startEdit(post) }
          break
        case 'c': // Copy text
          e.preventDefault(); void navigator.clipboard?.writeText(post.message); break
        case 'p': // Pin/unpin
          e.preventDefault(); pinPost.mutate({ postId: post.id, pin: !post.is_pinned }); break
        case 's': // Save/flag
          e.preventDefault(); toggleFlag.mutate({ postId: post.id, flag: !flagged.has(post.id) }); break
        case 'u': // Mark unread
          e.preventDefault(); markUnread.mutate({ postId: post.id, channelId: post.channel_id }); break
        case 'k': // Copy permalink
          e.preventDefault(); void navigator.clipboard?.writeText(`${window.location.origin}/pl/${post.id}`); break
        default:
          if (e.key === 'Delete' && post.user_id === userId) { e.preventDefault(); setPendingDeleteId(post.id) }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [userId, pinPost, toggleFlag, flagged, markUnread])

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
      <ScrollArea ref={scrollRef as never} className="flex-1 min-h-0" onScroll={handleScroll} aria-label={t('chat.messageList', 'Danh sách tin nhắn')} role="log">
        <div className="p-4 space-y-1 max-w-4xl mx-auto">
          {hasNewer && (
            <div className="flex justify-center py-2">
              <Button variant="ghost" size="sm" onClick={loadNewer} disabled={loading}>
                {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {t('chat.loadNewer', 'Tải tin nhắn mới hơn')}
              </Button>
            </div>
          )}
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
              ) : row.type === 'unread' ? (
                // "New Messages" unread separator (ports new_message_separator).
                <div key={row.key} className="flex items-center gap-2 py-2" role="separator" aria-label={t('chat.newMessages', 'Tin nhắn mới')}>
                  <div className="flex-1 h-px bg-sky-500/40" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">{t('chat.newMessages', 'Tin nhắn mới')}</span>
                  <div className="flex-1 h-px bg-sky-500/40" />
                </div>
              ) : (
                <PostRow
                  key={row.key}
                  post={row.post}
                  replyCount={row.replyCount}
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
                  onDelete={() => setPendingDeleteId(row.post.id)}
                  onToggleReaction={(emoji) => toggleReaction.mutate({ postId: row.post.id, emojiName: emoji })}
                  onTogglePin={() => pinPost.mutate({ postId: row.post.id, pin: !row.post.is_pinned })}
                  onToggleFlag={() => toggleFlag.mutate({ postId: row.post.id, flag: !flagged.has(row.post.id) })}
                  onMarkUnread={() => markUnread.mutate({ postId: row.post.id, channelId: row.post.channel_id })}
                  onForward={() => onForward?.(row.post)}
                  onShowEditHistory={() => onShowEditHistory?.(row.post.id)}
                  onJumpToPost={onJumpToPost}
                  onHover={setHoveredPost}
                  canModerate={row.post.user_id === userId}
                />
              ),
            )
          )}
        </div>
      </ScrollArea>
      <TypingIndicator channelId={channelId} />
      {/* Screen-reader announcement of the latest post (ports latest_post_reader). */}
      <span className="sr-only" aria-live="polite" aria-atomic="false">
        {latestPostAria}
      </span>

      {/* Delete confirmation (ports the vendored DeletePostModal). */}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chat.deletePostTitle', 'Xóa tin nhắn?')}</AlertDialogTitle>
            <AlertDialogDescription>{t('chat.deletePostConfirm', 'Hành động này không thể hoàn tác. Tin nhắn sẽ bị xóa vĩnh viễn.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Hủy')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (pendingDeleteId) deletePost.mutate(pendingDeleteId); setPendingDeleteId(null) }}
            >
              {t('common.delete', 'Xóa')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface PostRowProps {
  post: ChatPost
  replyCount: number
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
  onJumpToPost?: (postId: string) => void
  onHover?: (post: ChatPost | null) => void
  canModerate: boolean
}

function PostRow(props: PostRowProps) {
  const { post, replyCount, isOwn, authorName, isFlagged, onOpenThread, editing, draft, setDraft, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onToggleReaction, onTogglePin, onToggleFlag, onMarkUnread, onForward, onShowEditHistory, onJumpToPost, onHover, canModerate } = props
  const { t } = useTranslation()
  const EMPTY: any[] = []
  const reactions = useChatStore((s) => s.reactionsByPost[post.id] ?? EMPTY)
  const threadMeta = useChatStore((s) => s.threadsById[post.id])
  const currentUserId = useCurrentUserId()
  const [showEmoji, setShowEmoji] = useState(false)

  // Thread unread state (drives the dot + mention badge on thread roots).
  const threadUnreadReplies = threadMeta?.unread_replies ?? 0
  const threadUnreadMentions = threadMeta?.unread_mentions ?? 0
  const threadFollowing = threadMeta?.is_following ?? false

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
    <div
      className={`group flex gap-2.5 py-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => onHover?.(post)}
      onMouseLeave={() => onHover?.(null)}
      role="article"
      tabIndex={0}
      aria-label={`${authorName} ${format(new Date(post.create_at), 'HH:mm')}`}
    >
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
            className={`rounded-2xl px-3.5 py-2 text-sm wrap-break-word ${
              isOwn ? 'bg-sky-600 text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'
            }`}
          >
            <MessageContent post={post} isOwn={isOwn} onJumpToPost={onJumpToPost} />
            {post.file_ids && post.file_ids.length > 0 && <FileAttachments post={post} isOwn={isOwn} />}
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

        {/* Thread footer: reply count + reply button + unread indicators (ports ThreadFooter). */}
        {replyCount > 0 && !editing && (
          <button
            onClick={onOpenThread}
            className={`mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-400 hover:underline ${isOwn ? 'self-end' : 'self-start'}`}
          >
            {/* Unread mention badge (priority) or unread dot — only when following. */}
            {threadFollowing && threadUnreadMentions > 0 ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-600 px-1 text-[9px] font-semibold text-white">{threadUnreadMentions}</span>
            ) : threadFollowing && threadUnreadReplies > 0 ? (
              <span className="h-2 w-2 rounded-full bg-sky-500" />
            ) : null}
            <CornerUpRight className="h-3 w-3" />
            {replyCount} {t('chat.threadReplies', 'trả lời')}
            {threadFollowing && threadUnreadReplies > 0 && (
              <span className="text-sky-700 dark:text-sky-300 font-medium">· {threadUnreadReplies} {t('chat.new', 'mới')}</span>
            )}
          </button>
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
