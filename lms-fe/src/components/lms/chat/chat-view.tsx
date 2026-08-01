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

import { useEffect, useState } from 'react'
import { Hash, Lock, Search, Info, ArrowLeft, Bookmark, Pin, AtSign, CheckCheck, PenSquare, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import {
  useChatConnection, useMarkChannelRead, useChannelPosts, useMarkAllRead, useSeedFlagged, useCurrentUserId,
} from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import type { ChatChannel, ChatPost } from '@/lib/chat/types'
import { ChannelList, NoChannelSelected } from './channel-list'
import { PostList } from './post-list'
import { PostComposer } from './post-composer'
import { ThreadView } from './thread-view'
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
import { useChatShortcuts } from '@/lib/chat/use-chat-shortcuts'
import { useTranslation } from '@/lib/i18n'

type RHS = 'none' | 'thread' | 'info' | 'members' | 'search' | 'pinned' | 'saved' | 'mentions'
type Modal = 'none' | 'edit-history' | 'channel-settings' | 'dm' | 'shortcuts' | 'quick-switch' | 'account-settings'

export default function ChatView() {
  const { t } = useTranslation()
  const { connected } = useChatConnection()
  const userId = useCurrentUserId()

  const activeChannelId = useChatStore((s) => s.activeChannelId)
  const setActiveChannel = useChatStore((s) => s.setActiveChannel)
  const setActiveThread = useChatStore((s) => s.setActiveThread)
  const activeThreadRootId = useChatStore((s) => s.activeThreadRootId)
  const channel = useChatStore((s) => (activeChannelId ? s.channels[activeChannelId] : undefined))
  const teams = useChatStore((s) => s.teams)
  const unreadByChannel = useChatStore((s) => s.unreadByChannel)

  const [rhs, setRhs] = useState<RHS>('none')
  const [modal, setModal] = useState<Modal>('none')
  const [editHistoryPostId, setEditHistoryPostId] = useState<string | null>(null)
  const [forwardPost, setForwardPost] = useState<ChatPost | null>(null)
  const markRead = useMarkChannelRead()
  const markAllRead = useMarkAllRead()
  useChannelPosts(activeChannelId)

  // Seed the flagged/saved set + preferences on connect.
  useSeedFlagged(userId)

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

  return (
    <TooltipProvider delayDuration={300}>
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
                <div className="flex items-center gap-0.5">
                  <HeaderBtn active={rhs === 'saved'} onClick={() => setRhs(rhs === 'saved' ? 'none' : 'saved')} icon={<Bookmark className="h-4 w-4" />} label={t('chat.saved', 'Đã lưu')} />
                  <HeaderBtn active={rhs === 'mentions'} onClick={() => setRhs(rhs === 'mentions' ? 'none' : 'mentions')} icon={<AtSign className="h-4 w-4" />} label={t('chat.mentions', 'Đề cập')} />
                  <HeaderBtn active={rhs === 'pinned'} onClick={() => setRhs(rhs === 'pinned' ? 'none' : 'pinned')} icon={<Pin className="h-4 w-4" />} label={t('chat.pinned', 'Đã ghim')} />
                  <HeaderBtn active={rhs === 'search'} onClick={() => setRhs(rhs === 'search' ? 'none' : 'search')} icon={<Search className="h-4 w-4" />} label={t('chat.searchTitle', 'Tìm kiếm')} />
                  <HeaderBtn active={rhs === 'info'} onClick={() => setRhs(rhs === 'info' ? 'none' : 'info')} icon={<Info className="h-4 w-4" />} label={t('chat.channelInfo', 'Thông tin')} />
                  <HeaderBtn active={false} onClick={() => setModal('channel-settings')} icon={<PenSquare className="h-4 w-4" />} label={t('chat.settings', 'Cài đặt kênh')} />
                </div>
              </header>

              <ChannelBookmarks channelId={channel.id} />

              <PostList
                channelId={channel.id}
                onOpenThread={openThread}
                onForward={(post) => setForwardPost(post)}
                onShowEditHistory={(postId) => { setEditHistoryPostId(postId); setModal('edit-history') }}
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
      </div>
    </TooltipProvider>
  )
}

function HeaderBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className={`h-8 w-8 ${active ? 'bg-muted' : ''}`} onClick={onClick}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
