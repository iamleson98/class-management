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
import { MESSAGE_COLUMN_CLASS, MESSAGE_COLUMN_PADDING } from './chat-layout'
import { useTranslation } from '@/lib/i18n'
import { TypingIndicator } from './typing-indicator'
import { MessageContent } from './message-content'
import { PostMenu } from './post-menu'
import { shortcodeToUnicode } from '@/lib/chat/emoji-data'
import { nameColorClass, startsMessageGroup } from './message-style'
import { CallPostCard } from '@/features/calls/call-post'

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

// Quick-reaction emoji bar (hover actions). These MUST be Mattermost emoji
// shortcode names (server-side reaction validation), NOT unicode glyphs —
// the server rejects unknown names with 404 (app.emoji.get_by_name.no_result).
// Rendered as glyphs via shortcodeToUnicode() below.
const QUICK_EMOJIS = ['+1', 'heart', 'tada', 'joy', 'eyes']
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
  type Row =
    | { type: 'date'; key: string; at: number }
    | { type: 'post'; key: string; post: ChatPost; replyCount: number; groupStart: boolean }
    | { type: 'unread'; key: string }
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
    const out: Row[] = []
    let lastDay = 0
    let unreadInserted = lastViewedAt === 0 // no divider if never viewed
    let prev: ChatPost | null = null
    for (const post of visible) {
      let afterDivider = false
      if (!sameDay(lastDay, post.create_at)) {
        out.push({ type: 'date', key: `d-${post.create_at}`, at: post.create_at })
        lastDay = post.create_at
        afterDivider = true
      }
      // Insert the unread divider before the first post newer than last_viewed_at.
      if (!unreadInserted && post.create_at > lastViewedAt) {
        out.push({ type: 'unread', key: 'unread-divider' })
        unreadInserted = true
        afterDivider = true
      }
      // Group consecutive same-sender posts (5-min window, broken by any
      // divider) so the avatar + name header render only on the first row.
      const groupStart = afterDivider || startsMessageGroup(prev, post)
      out.push({ type: 'post', key: post.id, post, replyCount: replyCountByRoot[post.id] ?? post.reply_count ?? 0, groupStart })
      prev = post
    }
    return out
  }, [order, postMap, membership])

  // The latest visible post, for screen-reader announcement (aria-live).
  const latestPostAria = useMemo(() => {
    const postRows = rows.filter((r): r is Extract<Row, { type: 'post' }> => r.type === 'post')
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
      <div className={`flex-1 space-y-4 ${MESSAGE_COLUMN_PADDING} py-4 ${MESSAGE_COLUMN_CLASS}`}>
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
        <div className={`py-4 pb-2 ${MESSAGE_COLUMN_PADDING} ${MESSAGE_COLUMN_CLASS}`}>
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
                <div key={row.key} className="flex items-center gap-3 py-4" role="separator" aria-label={format(new Date(row.at), 'dd/MM/yyyy')}>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {format(new Date(row.at), 'dd/MM/yyyy')}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              ) : row.type === 'unread' ? (
                // "New Messages" unread separator (ports new_message_separator).
                <div key={row.key} className="flex items-center gap-2 py-2" role="separator" aria-label={t('chat.newMessages', 'Tin nhắn mới')}>
                  <div className="flex-1 h-px bg-primary/50" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">{t('chat.newMessages', 'Tin nhắn mới')}</span>
                  <div className="flex-1 h-px bg-primary/50" />
                </div>
              ) : (
                <PostRow
                  key={row.key}
                  post={row.post}
                  replyCount={row.replyCount}
                  groupStart={row.groupStart}
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
  /** First row of a same-sender group — renders avatar + name header. */
  groupStart: boolean
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

/**
 * PostRow — one message row in the messenger layout (WhatsApp/Telegram
 * convention, per user request): peers' messages anchor to the LEFT with
 * their avatar, the logged-in user's messages mirror to the RIGHT. Consecutive
 * same-sender posts group compactly (avatar + name header only on the first
 * row; a hover timestamp replaces the avatar slot on continuations, keeping
 * bubbles aligned). Identity comes from the per-user name color; moderation
 * affordances (edit/delete) stay hover-revealed for everyone.
 */
function PostRow(props: PostRowProps) {
  const { post, replyCount, groupStart, isOwn, authorName, isFlagged, onOpenThread, editing, draft, setDraft, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onToggleReaction, onTogglePin, onToggleFlag, onMarkUnread, onForward, onShowEditHistory, onJumpToPost, onHover, canModerate } = props
  const { t } = useTranslation()
  const EMPTY: any[] = []
  const reactions = useChatStore((s) => s.reactionsByPost[post.id] ?? EMPTY)
  const threadMeta = useChatStore((s) => s.threadsById[post.id])
  const currentUserId = useCurrentUserId()
  const [showEmoji, setShowEmoji] = useState(false)
  const time = format(new Date(post.create_at), 'HH:mm')

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

  // Custom call posts render as interactive call cards.
  if ((post.type as string) === 'custom_calls') {
    return <CallPostCard post={post} />
  }

  return (
    <div
      className={`group/row relative flex gap-2.5 ${groupStart ? 'py-1.5' : 'py-0.5'} ${isOwn ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => onHover?.(post)}
      onMouseLeave={() => onHover?.(null)}
      role="article"
      tabIndex={0}
      aria-label={`${authorName} ${time}`}
    >
      {/* Avatar gutter — avatar on the group's first row (mirrored to the
          right for own messages), hover timestamp (replacing the avatar slot)
          on continuation rows so bubbles stay aligned within a group. */}
      {groupStart ? (
        <Avatar name={authorName} size="sm" className="mt-0.5 shrink-0" />
      ) : (
        <div className="w-8 shrink-0 pt-1 text-center">
          <span className="hidden group-hover/row:block text-[10px] tabular-nums text-muted-foreground/80 select-none">{time}</span>
        </div>
      )}

      {/* Content column — right-aligned for own messages */}
      <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {groupStart && (
          <div className="flex items-baseline gap-2 mb-0.5 min-w-0">
            {!isOwn && <span className={`text-[13px] font-semibold truncate ${nameColorClass(post.user_id)}`}>{authorName}</span>}
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{time}</span>
            {post.edit_at > 0 && (
              <button
                onClick={onShowEditHistory}
                className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground hover:underline italic shrink-0"
              >
                ({t('chat.edited', 'đã sửa')})
              </button>
            )}
            {isFlagged && <Bookmark className="h-3 w-3 text-amber-500 shrink-0" />}
            {post.is_pinned && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
          </div>
        )}

        {editing ? (
          <div className="flex flex-col gap-2 w-full rounded-xl border border-primary/40 focus-within:border-primary bg-background px-3 py-2.5 shadow-sm transition-colors">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="text-sm resize-none min-h-16 bg-transparent outline-none"
              autoFocus
            />
            <div className="flex gap-1.5 justify-end">
              <span className="mr-auto text-[11px] text-muted-foreground italic">{t('chat.editing', 'Đang chỉnh sửa')}</span>
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>{t('common.cancel', 'Hủy')}</Button>
              <Button size="sm" onClick={onSaveEdit}>{t('common.save', 'Lưu')}</Button>
            </div>
          </div>
        ) : (
          <div
            className={`text-sm leading-relaxed wrap-break-word rounded-2xl px-3.5 py-2 ${
              isOwn
                ? `bg-primary text-primary-foreground rounded-br-sm ${!groupStart ? 'rounded-tr-sm' : ''}`
                : `bg-muted text-foreground rounded-bl-sm ${!groupStart ? 'rounded-tl-sm' : ''}`
            }`}
          >
            <MessageContent post={post} isOwn={isOwn} onJumpToPost={onJumpToPost} />
            {post.file_ids && post.file_ids.length > 0 && <FileAttachments post={post} isOwn={false} />}
          </div>
        )}

        {/* Reactions — pill chips under the message */}
        {Object.keys(grouped).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(grouped).map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => onToggleReaction(emoji)}
                title={`:${emoji}:`}
                className={`inline-flex items-center gap-1 h-6 rounded-full px-2 text-xs border transition-all duration-150 active:scale-95 ${
                  info.mine
                    ? 'bg-primary/10 border-primary/40 text-primary dark:text-primary-foreground/90 dark:bg-primary/25 dark:border-primary/50'
                    : 'bg-background border-border hover:border-muted-foreground/40 hover:bg-muted'
                }`}
              >
                <span className="text-[13px] leading-none">{shortcodeToUnicode(emoji) ?? `:${emoji}:`}</span>
                <span className="font-semibold tabular-nums">{info.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread footer: reply count + reply button + unread indicators (ports ThreadFooter). */}
        {replyCount > 0 && !editing && (
          <button
            onClick={onOpenThread}
            className="mt-1 inline-flex items-center gap-1.5 h-7 rounded-full px-2 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {/* Unread mention badge (priority) or unread dot — only when following. */}
            {threadFollowing && threadUnreadMentions > 0 ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 h-4 min-w-4 text-[10px] font-semibold text-primary-foreground">{threadUnreadMentions}</span>
            ) : threadFollowing && threadUnreadReplies > 0 ? (
              <span className="h-2 w-2 rounded-full bg-primary" />
            ) : null}
            <CornerUpRight className="h-3.5 w-3.5" />
            <span className="tabular-nums">{replyCount}</span>
            {t('chat.threadReplies', 'trả lời')}
            {threadFollowing && threadUnreadReplies > 0 && (
              <span className="text-primary font-semibold">· {threadUnreadReplies} {t('chat.new', 'mới')}</span>
            )}
          </button>
        )}
      </div>

      {/* Hover toolbar — floats over the row's top corner on the opposite
          side of the bubbles, Discord-style: quick reactions + reply + overflow
          menu. Mirrored for own messages so it never covers the bubble. */}
      <div
        className={`absolute -top-3 z-10 flex items-center h-8 rounded-lg border bg-popover shadow-md opacity-0 scale-95 pointer-events-none group-hover/row:opacity-100 group-hover/row:scale-100 group-hover/row:pointer-events-auto focus-within:opacity-100 focus-within:scale-100 focus-within:pointer-events-auto transition-all duration-100 ease-out ${isOwn ? 'left-2' : 'right-2'}`}
        role="toolbar"
        aria-label={t('chat.messageActions', 'Thao tác tin nhắn')}
      >
        {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
          <button
            key={emoji}
            onClick={() => onToggleReaction(emoji)}
            title={`:${emoji}:`}
            className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-[15px] leading-none"
          >
            {shortcodeToUnicode(emoji) ?? `:${emoji}:`}
          </button>
        ))}
        <div className="relative">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setShowEmoji((v) => !v)} title={t('chat.addReaction', 'Thêm cảm xúc')}>
            <Smile className="h-4 w-4" />
          </Button>
          {showEmoji && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />
              <div className="absolute top-full right-0 z-50 mt-1 flex gap-1 rounded-lg border bg-popover shadow-lg p-1.5">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { onToggleReaction(emoji); setShowEmoji(false) }}
                    title={`:${emoji}:`}
                    className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center text-base"
                  >
                    {shortcodeToUnicode(emoji) ?? `:${emoji}:`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={onOpenThread} title={t('chat.reply', 'Trả lời')}>
          <CornerUpRight className="h-4 w-4" />
        </Button>
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
          align="end"
        />
      </div>
    </div>
  )
}
