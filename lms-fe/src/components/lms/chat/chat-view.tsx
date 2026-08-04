'use client'

/**
 * ChatView — the top-level chat shell. Wires together the WebSocket connection,
 * the channel list, the active channel's post list + composer, and the right
 * pane state machine (search / thread / channel info / members / pinned /
 * saved / mentions) plus the modals (edit history, channel settings, new DM).
 *
 * Ports the vendored webapp's RHSStates + modal_controller pattern: a single
 * `rhs` string + `activeModal` string drive which panel/modal renders.
 */

import { useEffect, useMemo, useState } from 'react'
import { Hash, Lock, Search, Info, ArrowLeft, Bookmark, Pin, AtSign, CheckCheck, PenSquare, Users, MessageSquare, MoreVertical, Link2, Bell, BellOff, UserPlus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  useChatConnection, useMarkChannelRead, useChannelPosts, useMarkAllRead, useSeedFlagged, useCurrentUserId, useChannelCategories, usePresencePoll, useToggleFavorite, useUpdateChannelNotifyProps,
} from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { client4 } from '@/lib/chat/client'
import { ensureNotificationPermission } from '@/lib/chat/notifications'
import { useDocumentTitle } from '@/lib/chat/use-document-title'
import { usePresenceSync } from '@/lib/chat/use-presence-sync'
import type { ChatChannel, ChatPost, ChatUser } from '@/lib/chat/types'
import { useToast } from '@/hooks/use-toast'
import { ChannelList, NoChannelSelected } from './channel-list'
import { PostList } from './post-list'
import { PostComposer } from './post-composer'
import { ThreadView } from './thread-view'
import { ThreadsInbox } from './threads-inbox'
import { ChannelInfo } from './channel-info'
import { SearchPanel } from './search-panel'
import { PostListRhs } from './post-list-rhs'
import { EditHistoryModal } from './edit-history-modal'
import { ChannelSettingsModal } from './channel-settings-modal'
import { DmModal } from './dm-modal'
import { StatusMenu } from './status-menu'
import { KeyboardShortcutsModal } from './keyboard-shortcuts-modal'
import { QuickSwitcher } from './quick-switcher'
import { ChannelBookmarks } from './channel-bookmarks'
import { AccountSettingsModal } from './account-settings-modal'
import { ForwardModal } from './forward-modal'
import { CallButton } from './call-button'
import { CallWidget } from './call-widget'
import { useChatShortcuts } from '@/lib/chat/use-chat-shortcuts'
import { useCallsStore } from '@/lib/chat/calls-store'
import { useTranslation } from '@/lib/i18n'

type RHS = 'none' | 'thread' | 'info' | 'members' | 'search' | 'pinned' | 'saved' | 'mentions' | 'threads'
type Modal = 'none' | 'edit-history' | 'channel-settings' | 'dm' | 'shortcuts' | 'quick-switch' | 'account-settings'

export default function ChatView() {
  const { t } = useTranslation()
  const { connected } = useChatConnection()
  const userId = useCurrentUserId()
  // Keep the document title in sync with the unread/mention counts (ports the
  // webapp's `(N) Title` tab badge) and request notification permission.
  useDocumentTitle()
  // Push online/away to the server on window focus/blur.
  usePresenceSync()

  const activeChannelId = useChatStore((s) => s.activeChannelId)
  const setActiveChannel = useChatStore((s) => s.setActiveChannel)
  const setActiveThread = useChatStore((s) => s.setActiveThread)
  const activeThreadRootId = useChatStore((s) => s.activeThreadRootId)
  const channel = useChatStore((s) => (activeChannelId ? s.channels[activeChannelId] : undefined))
  // The channel id of an in-progress call, if any (drives the CallWidget overlay).
  const activeCallChannel = useCallsStore((s) => s.channelId)
  const teams = useChatStore((s) => s.teams)
  const unreadByChannel = useChatStore((s) => s.unreadByChannel)
  // Poll visible users' presence every ~60s (after activeChannelId is known).
  usePresencePoll(activeChannelId)

  const [rhs, setRhs] = useState<RHS>('none')
  const [modal, setModal] = useState<Modal>('none')
  const [editHistoryPostId, setEditHistoryPostId] = useState<string | null>(null)
  const [forwardPost, setForwardPost] = useState<ChatPost | null>(null)
  const markRead = useMarkChannelRead()
  const markAllRead = useMarkAllRead()
  useChannelPosts(activeChannelId)

  // Seed the flagged/saved set + preferences on connect.
  useSeedFlagged(userId)

  // Load sidebar categories (favorites/channels/DMs) for every team so the
  // sidebar grouping + favorite toggles work. Rendered as a hidden component
  // since hooks can't be called in a loop directly.
  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])

  // Global keyboard shortcuts (Ctrl+K, Ctrl+/, Ctrl+Shift+M, Ctrl+., Shift+Esc, …).
  useChatShortcuts({
    onToggleShortcuts: () => setModal((m) => (m === 'shortcuts' ? 'none' : 'shortcuts')),
    onQuickSwitcher: () => setModal((m) => (m === 'quick-switch' ? 'none' : 'quick-switch')),
    onToggleMentions: () => setRhs((r) => (r === 'mentions' ? 'none' : 'mentions')),
    onOpenSettings: () => setModal((m) => (m === 'account-settings' ? 'none' : 'account-settings')),
    onToggleRhs: () => setRhs((r) => (r === 'none' ? 'info' : 'none')),
    onFocusComposer: () => document.querySelector<HTMLTextAreaElement>('textarea[data-composer]')?.focus(),
    onMarkAllRead: () => { if (userId && teamId) markAllRead.mutate({ userId, teamId }) },
    onToggleUnreads: () => { /* sidebar filter toggle — optional */ },
    onChannelInfo: () => setRhs((r) => (r === 'info' ? 'none' : 'info')),
  })

  const teamId = channel?.team_id ?? teams[0]?.id
  const totalUnread = Object.values(unreadByChannel).reduce((a, b) => a + b, 0)
  // Total unread threads across the active team (drives the Threads inbox badge).
  const unreadThreadCount = useChatStore((s) => teamId ? s.threadCounts[teamId]?.total_unread_threads ?? 0 : 0)

  // Request desktop-notification permission once the socket connects (lazy, so
  // we only prompt after the user actually opens chat).
  useEffect(() => {
    if (connected) ensureNotificationPermission()
  }, [connected])

  // Auto-select the first channel on mount.
  useEffect(() => {
    if (!activeChannelId && teams.length > 0) {
      const allChannels = Object.values(useChatStore.getState().channels).filter((c) => c.delete_at === 0)
      if (allChannels.length > 0) setActiveChannel(allChannels[0].id)
    }
  }, [teams, activeChannelId, setActiveChannel])

  const selectChannel = (ch: ChatChannel) => {
    setActiveChannel(ch.id)
    setRhs('none')
    markRead.mutate(ch.id)
  }

  const openThread = (rootId: string) => {
    setActiveThread(rootId)
    setRhs('thread')
  }

  const jumpToPost = (post: ChatPost) => {
    setActiveChannel(post.channel_id)
    markRead.mutate(post.channel_id)
    if (post.root_id) openThread(post.root_id)
    else setRhs('none')
  }

  // Jump to a post by id (from an in-message permalink). Fetches the post to
  // learn its channel/thread, then jumps — matching the vendored focusPost flow.
  const jumpToPostId = async (postId: string) => {
    try {
      const post = await client4.getPost(postId)
      if (post) jumpToPost(post as unknown as ChatPost)
    } catch {
      // Not found / no permission — silently ignore (rare for permalinks).
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      {/* Load sidebar categories for every team (favorites/channels/DMs). */}
      <CategoryLoaders teamIds={teamIds} userId={userId} />
      <div className="flex h-[calc(100vh-3.5rem-2rem)] lg:h-[calc(100vh-3.5rem-3rem)] -m-4 sm:-m-6 border rounded-lg overflow-hidden bg-background">
        {/* Left: channel list */}
        <div className="w-64 shrink-0 border-r bg-card/50 hidden sm:flex sm:flex-col">
          <div className="h-12 flex items-center gap-2 px-3 border-b">
            <span className="font-semibold text-sm">{t('chat.title', 'Trò chuyện')}</span>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setModal('dm')} title={t('chat.newMessage', 'Tin nhắn mới')}>
              <PenSquare className="h-4 w-4" />
            </Button>
            {totalUnread > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => userId && teamId && markAllRead.mutate({ userId, teamId })} title={t('chat.markAllRead', 'Đánh dấu đã đọc tất cả')}>
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('chat.markAllRead', 'Đánh dấu đã đọc tất cả')}</TooltipContent>
              </Tooltip>
            )}
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-400'}`} title={connected ? t('chat.connected', 'Đã kết nối') : t('chat.connecting', 'Đang kết nối…')} />
          </div>
          <ChannelList selectedChannelId={activeChannelId} onSelect={selectChannel} />
        </div>

        {/* Center: messages */}
        <div className="flex-1 flex flex-col min-w-0">
          {!channel ? (
            <NoChannelSelected />
          ) : (
            <>
              <header className="h-12 flex items-center gap-2 px-4 border-b shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden" onClick={() => setRhs(rhs === 'info' ? 'none' : 'info')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {channel.type === 'P' ? <Lock className="h-4 w-4 text-muted-foreground" /> : channel.type === 'D' || channel.type === 'G' ? <Users className="h-4 w-4 text-muted-foreground" /> : <Hash className="h-4 w-4 text-muted-foreground" />}
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{channel.display_name}</div>
                  {channel.purpose && <div className="text-[11px] text-muted-foreground truncate max-w-[40vw]">{channel.purpose}</div>}
                </div>
                <div className="flex-1" />
                <StatusMenu>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title={t('chat.setStatus', 'Đặt trạng thái')}>
                    <span className="text-base">⋯</span>
                  </Button>
                </StatusMenu>
                <CallButton channelId={channel.id} enableVideo />
                <div className="flex items-center gap-0.5">
                  <HeaderBtn active={rhs === 'threads'} onClick={() => setRhs(rhs === 'threads' ? 'none' : 'threads')} icon={<MessageSquare className="h-4 w-4" />} label={t('chat.threads', 'Chuỗi')} badge={unreadThreadCount} />
                  <HeaderBtn active={rhs === 'saved'} onClick={() => setRhs(rhs === 'saved' ? 'none' : 'saved')} icon={<Bookmark className="h-4 w-4" />} label={t('chat.saved', 'Đã lưu')} />
                  <HeaderBtn active={rhs === 'mentions'} onClick={() => setRhs(rhs === 'mentions' ? 'none' : 'mentions')} icon={<AtSign className="h-4 w-4" />} label={t('chat.mentions', 'Đề cập')} />
                  <HeaderBtn active={rhs === 'pinned'} onClick={() => setRhs(rhs === 'pinned' ? 'none' : 'pinned')} icon={<Pin className="h-4 w-4" />} label={t('chat.pinned', 'Đã ghim')} />
                  <HeaderBtn active={rhs === 'search'} onClick={() => setRhs(rhs === 'search' ? 'none' : 'search')} icon={<Search className="h-4 w-4" />} label={t('chat.searchTitle', 'Tìm kiếm')} />
                  <HeaderBtn active={rhs === 'info'} onClick={() => setRhs(rhs === 'info' ? 'none' : 'info')} icon={<Info className="h-4 w-4" />} label={t('chat.channelInfo', 'Thông tin')} />
                  <ChannelActionsMenu
                    channel={channel}
                    teamId={teamId}
                    userId={userId}
                    onOpenSettings={() => setModal('channel-settings')}
                  />
                </div>
              </header>

              <ChannelBookmarks channelId={channel.id} />

              <PostList
                channelId={channel.id}
                onOpenThread={openThread}
                onForward={(post) => setForwardPost(post)}
                onShowEditHistory={(postId) => { setEditHistoryPostId(postId); setModal('edit-history') }}
                onJumpToPost={(postId) => jumpToPostId(postId)}
              />
              <PostComposer channelId={channel.id} teamId={teamId} />
            </>
          )}
        </div>

        {/* Right pane */}
        {rhs !== 'none' && channel && (
          <div className="w-80 lg:w-96 shrink-0 hidden md:flex md:flex-col">
            {rhs === 'thread' && activeThreadRootId ? (
              <ThreadView channelId={channel.id} rootId={activeThreadRootId} teamId={teamId} onClose={() => { setRhs('none'); setActiveThread(null) }} />
            ) : rhs === 'info' ? (
              <ChannelInfo channel={channel} onClose={() => setRhs('none')} />
            ) : rhs === 'search' ? (
              <SearchPanel teamId={teamId} onJump={jumpToPost} onClose={() => setRhs('none')} />
            ) : rhs === 'pinned' ? (
              <PostListRhs kind="pinned" channelId={channel.id} teamId={teamId} onJump={jumpToPost} onClose={() => setRhs('none')} />
            ) : rhs === 'saved' ? (
              <PostListRhs kind="flagged" teamId={teamId} onJump={jumpToPost} onClose={() => setRhs('none')} />
            ) : rhs === 'mentions' ? (
              <PostListRhs kind="mentions" teamId={teamId} onJump={jumpToPost} onClose={() => setRhs('none')} />
            ) : rhs === 'threads' ? (
              <ThreadsInbox teamId={teamId ?? ''} onOpenThread={(cid, rootId) => { selectChannel(useChatStore.getState().channels[cid] ?? { id: cid } as ChatChannel); openThread(rootId) }} onClose={() => setRhs('none')} />
            ) : null}
          </div>
        )}

        {/* Modals */}
        {modal === 'edit-history' && editHistoryPostId && (
          <EditHistoryModal postId={editHistoryPostId} onClose={() => { setModal('none'); setEditHistoryPostId(null) }} />
        )}
        {modal === 'channel-settings' && channel && userId && (
          <ChannelSettingsModal channel={channel} userId={userId} onClose={() => setModal('none')} />
        )}
        {modal === 'dm' && (
          <DmModal teamId={teamId} currentUserId={userId} onOpen={(cid) => selectChannel(useChatStore.getState().channels[cid] ?? { id: cid } as ChatChannel)} onClose={() => setModal('none')} />
        )}
        {modal === 'shortcuts' && (
          <KeyboardShortcutsModal onClose={() => setModal('none')} />
        )}
        {modal === 'quick-switch' && (
          <QuickSwitcher teamId={teamId} onSelect={(ch) => { selectChannel(ch); setModal('none') }} onClose={() => setModal('none')} />
        )}
        {modal === 'account-settings' && (
          <AccountSettingsModal onClose={() => setModal('none')} />
        )}
        {forwardPost && (
          <ForwardModal post={forwardPost} teamId={teamId} onClose={() => setForwardPost(null)} />
        )}
        {activeCallChannel && (
          <CallWidget channelId={activeCallChannel} />
        )}
      </div>
    </TooltipProvider>
  )
}

function HeaderBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className={`relative h-8 w-8 ${active ? 'bg-muted' : ''}`} onClick={onClick} aria-label={label}>
          {icon}
          {badge ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-sky-600 text-white text-[9px] font-semibold flex items-center justify-center">{badge > 99 ? '99+' : badge}</span>
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Renders a hidden `useChannelCategories` loader for each team so the sidebar's
 * favorites/channels/DMs grouping + favorite toggles work. Hooks can't be called
 * in a loop in the parent, so this maps over team ids and renders null.
 */
function CategoryLoaders({ teamIds, userId }: { teamIds: string[]; userId?: string }) {
  return (
    <>
      {teamIds.map((teamId) => (
        <CategoryLoader key={teamId} teamId={teamId} userId={userId} />
      ))}
    </>
  )
}

function CategoryLoader({ teamId, userId }: { teamId: string; userId?: string }) {
  useChannelCategories(teamId, userId)
  return null
}

/**
 * Channel actions menu — a dropdown on the channel header with: copy link,
 * mute/unmute notifications, favorite/unfavorite, add members, and channel
 * settings. Ports a subset of the vendored channel_header_menu.
 */
function ChannelActionsMenu({ channel, teamId, userId, onOpenSettings }: {
  channel: ChatChannel
  teamId?: string
  userId?: string
  onOpenSettings: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [showAddMembers, setShowAddMembers] = useState(false)
  const toggleFavorite = useToggleFavorite(userId)
  const updateNotifyProps = useUpdateChannelNotifyProps()

  // Favorite state from the categories store.
  const isFavorite = useChatStore((s) => {
    if (!teamId) return false
    const cats = s.categoriesByTeam[teamId]?.categories ?? []
    const fav = cats.find((c) => c.type === 'favorites')
    return !!fav?.channel_ids.includes(channel.id)
  })
  const isMuted = (channel as unknown as { notify_props?: { mark_unread?: string } }).notify_props?.mark_unread === 'mention'
  const isDM = channel.type === 'D' || channel.type === 'G'

  const copyLink = () => {
    const url = `${window.location.origin}/${teamId ?? channel.team_id}/${channel.type === 'D' ? 'messages' : 'channels'}/${channel.name}`
    void navigator.clipboard?.writeText(url)
  }

  const onMute = () => {
    if (!userId) return
    updateNotifyProps.mutate({
      channelId: channel.id, userId,
      props: { mark_unread: isMuted ? 'all' : 'mention' },
    })
  }

  const onFav = () => {
    if (!teamId) return
    toggleFavorite.mutate({ channelId: channel.id, teamId, favorite: !isFavorite })
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('chat.channelMenu', 'Menu kênh')}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('chat.channelMenu', 'Menu kênh')}</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-52 p-1">
          <MenuRow icon={<PenSquare className="h-3.5 w-3.5" />} label={t('chat.settings', 'Cài đặt kênh')} onClick={() => { setOpen(false); onOpenSettings() }} />
          <MenuRow icon={<Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current text-amber-500' : ''}`} />} label={isFavorite ? t('chat.unfavorite', 'Bỏ yêu thích') : t('chat.favorite', 'Yêu thích')} onClick={() => { onFav(); setOpen(false) }} />
          <MenuRow icon={isMuted ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />} label={isMuted ? t('chat.unmute', 'Bỏ tắt thông báo') : t('chat.mute', 'Tắt thông báo')} onClick={() => { onMute(); setOpen(false) }} />
          <MenuRow icon={<Link2 className="h-3.5 w-3.5" />} label={t('chat.copyLink', 'Sao chép liên kết')} onClick={() => { copyLink(); setOpen(false) }} />
          {!isDM && (
            <MenuRow icon={<UserPlus className="h-3.5 w-3.5" />} label={t('chat.addMembers', 'Thêm thành viên')} onClick={() => { setOpen(false); setShowAddMembers(true) }} />
          )}
        </PopoverContent>
      </Popover>

      {showAddMembers && (
        <AddMembersDialog channel={channel} onClose={() => setShowAddMembers(false)} />
      )}
    </>
  )
}

function MenuRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-left hover:bg-muted transition-colors">
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

/** Add-members dialog — search users by username/email and add to the channel. */
function AddMembersDialog({ channel, onClose }: { channel: ChatChannel; onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ChatUser[]>([])
  const [adding, setAdding] = useState<string | null>(null)

  // Debounced user search via autocompleteUsers.
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await import('@/lib/chat/client').then((m) => m.client4.autocompleteUsers(query, channel.team_id, channel.id, { limit: 10 }))
        setResults([...(res.users ?? []), ...(res.out_of_channel ?? [])] as ChatUser[])
      } catch { setResults([]) }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, channel.team_id, channel.id])

  const addMember = async (user: ChatUser) => {
    setAdding(user.id)
    try {
      await import('@/lib/chat/client').then((m) => m.client4.addToChannel(user.id, channel.id))
      toast({ title: t('chat.memberAdded', 'Đã thêm thành viên') })
      setResults((r) => r.filter((u) => u.id !== user.id))
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.addMemberFailed', 'Thêm thất bại'), variant: 'destructive' })
    } finally {
      setAdding(null)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('chat.addMembers', 'Thêm thành viên vào')} {channel.display_name}</DialogTitle>
        </DialogHeader>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('chat.searchUsers', 'Tìm người dùng…')} className="h-9" autoFocus />
        <div className="max-h-72 overflow-auto space-y-1">
          {results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{query ? t('chat.noResults', 'Không tìm thấy') : t('chat.searchUsersHint', 'Nhập tên để tìm')}</div>
          ) : results.map((user) => (
            <div key={user.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/60">
              <span className="text-sm font-medium flex-1 truncate">{user.username}</span>
              <Button size="sm" variant="ghost" disabled={adding === user.id} onClick={() => addMember(user)}>{t('common.add', 'Thêm')}</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
