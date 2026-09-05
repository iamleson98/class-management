'use client'

/**
 * Channel list — ports the vendored webapp's sidebar into shadcn/ui:
 *   - channels grouped by team, then by sidebar category (favorites → channels
 *     → direct_messages), mirroring the webapp's category-driven sidebar
 *   - unread + mention badges (mention shows as a filled pill)
 *   - presence dots on DM/GM channels (online/away/dnd)
 *   - per-row context menu (mark as read, favorite/unfavorite, leave) — a subset
 *     of the vendored sidebar_channel_menu
 *   - search filter (client-side on display name + channel name)
 *
 * The store already models `categoriesByTeam` and the favorite/move hooks
 * (useToggleFavorite, isFavoriteChannel); this component wires them into the UI.
 */

import { useMemo, useState, useCallback } from 'react'
import { Hash, Lock, Users, Search, MessageSquare, Star, MoreHorizontal, CheckCheck, LogOut, PhoneCall, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  useChannels, useToggleFavorite, useCurrentUserId,
} from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { client4 } from '@/lib/chat/client'
import { sortChannelsByTypeAndDisplayName } from '@/lib/chat/utils'
import { useCallsStore } from '@/features/calls/calls-store'
import { useToast } from '@/hooks/use-toast'
import type { ChatChannel, PresenceStatus } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'

interface ChannelListProps {
  selectedChannelId: string | null
  onSelect: (channel: ChatChannel) => void
}

const PRESENCE_COLOR: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  dnd: 'bg-rose-500',
  offline: 'bg-gray-400',
}

/** Resolve the "other" user in a DM channel (for presence + name). */
function dmOtherUserId(channel: ChatChannel, currentUserId?: string): string | undefined {
  const name = channel.name ?? ''
  // DM channel names are "__userId1____userId2".
  const parts = name.split('__').filter(Boolean)
  return parts.find((id) => id !== currentUserId) ?? parts[0]
}

export function ChannelList({ selectedChannelId, onSelect }: ChannelListProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const channelsQuery = useChannels()
  const teams = useChatStore((s) => s.teams)
  const channels = useChatStore((s) => s.channels)
  const unreadByChannel = useChatStore((s) => s.unreadByChannel)
  const mentionByChannel = useChatStore((s) => s.mentionByChannel)
  const statuses = useChatStore((s) => s.statuses)
  const userId = useCurrentUserId()

  // Group channels within a team into: favorites, channels (O/P), DMs (D/G).
  const grouped = useMemo(() => {
    const allChannels: ChatChannel[] = Object.values(channels).filter((c) => c.delete_at === 0)
    const filtered = query
      ? allChannels.filter(
          (c) =>
            c.display_name.toLowerCase().includes(query.toLowerCase()) ||
            c.name.toLowerCase().includes(query.toLowerCase()),
        )
      : allChannels
    return teams
      .map((team) => {
        const teamChannels = filtered
          .filter((c) => c.team_id === team.id)
          .sort((a, b) => sortChannelsByTypeAndDisplayName('vi', a, b))
        const favorites = teamChannels.filter((c) => isFav(c))
        const channelsGroup = teamChannels.filter((c) => (c.type === 'O' || c.type === 'P') && !isFav(c))
        const dms = teamChannels.filter((c) => (c.type === 'D' || c.type === 'G'))
        return { team, favorites, channels: channelsGroup, dms }
      })
      .filter((g) => g.favorites.length > 0 || g.channels.length > 0 || g.dms.length > 0)

    function isFav(_c: ChatChannel): boolean {
      // Favorites are derived from the categories store (type === 'favorites').
      // We read it inline to avoid re-render churn; the toggle hook refreshes it.
      const cats = useChatStore.getState().categoriesByTeam[_c.team_id]?.categories ?? []
      const fav = cats.find((cat) => cat.type === 'favorites')
      return !!fav?.channel_ids.includes(_c.id)
    }
  }, [teams, channels, query])

  return (
    <div className="flex flex-col h-full">
      <div className="p-2.5 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chat.search', 'Tìm kênh…')}
            className="h-8 pl-8 text-sm rounded-lg bg-muted/60 border-transparent focus-visible:bg-background"
          />
        </div>
      </div>

      {/* Native overflow scrolling — the Radix ScrollArea custom viewport breaks
          mouse-wheel scrolling in some browsers; native overflow always works. */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain">
        <div className="p-2">
          {channelsQuery.isLoading ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {query ? t('chat.noResults', 'Không tìm thấy kênh') : t('chat.noChannels', 'Bạn chưa thuộc kênh nào')}
            </div>
          ) : (
            grouped.map(({ team, favorites, channels: teamChannels, dms }) => (
              <div key={team.id} className="mb-3">
                {/* Team header */}
                <div className="px-3 py-1.5 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 truncate">
                    {team.display_name || team.name}
                  </span>
                </div>

                {/* Favorites */}
                {favorites.length > 0 && (
                  <CategorySection title={t('chat.favorites', 'Yêu thích')}>
                    {favorites.map((ch) => (
                      <ChannelRow
                        key={ch.id}
                        channel={ch}
                        selectedChannelId={selectedChannelId}
                        unread={unreadByChannel[ch.id] ?? 0}
                        mentions={mentionByChannel[ch.id] ?? 0}
                        presence={undefined}
                        onSelect={onSelect}
                      />
                    ))}
                  </CategorySection>
                )}

                {/* Channels (O/P) */}
                {teamChannels.length > 0 && (
                  <CategorySection title={t('chat.channels', 'Kênh')}>
                    {teamChannels.map((ch) => (
                      <ChannelRow
                        key={ch.id}
                        channel={ch}
                        selectedChannelId={selectedChannelId}
                        unread={unreadByChannel[ch.id] ?? 0}
                        mentions={mentionByChannel[ch.id] ?? 0}
                        presence={undefined}
                        onSelect={onSelect}
                      />
                    ))}
                  </CategorySection>
                )}

                {/* Direct messages */}
                {dms.length > 0 && (
                  <CategorySection title={t('chat.directMessages', 'Tin nhắn trực tiếp')}>
                    {dms.map((ch) => {
                      const otherId = dmOtherUserId(ch, userId)
                      return (
                        <ChannelRow
                          key={ch.id}
                          channel={ch}
                          selectedChannelId={selectedChannelId}
                          unread={unreadByChannel[ch.id] ?? 0}
                          mentions={mentionByChannel[ch.id] ?? 0}
                          presence={otherId ? statuses[otherId] : undefined}
                          onSelect={onSelect}
                        />
                      )
                    })}
                  </CategorySection>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/** A collapsible category section header + its channels. */
function CategorySection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors duration-100"
        aria-expanded={open}
      >
        <ChevronRight className={`h-3 w-3 shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        <span>{title}</span>
      </button>
      {open && <div className="space-y-0.5 pr-1.5">{children}</div>}
    </div>
  )
}

interface ChannelRowProps {
  channel: ChatChannel
  selectedChannelId: string | null
  unread: number
  mentions: number
  presence?: PresenceStatus
  onSelect: (channel: ChatChannel) => void
}

function ChannelRow({ channel, selectedChannelId, unread, mentions, presence, onSelect }: ChannelRowProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const isSelected = channel.id === selectedChannelId
  // Active-call indicator (ports the sidebar ChannelLinkLabel phone icon).
  const hasCall = useCallsStore((s) => !!s.activeCalls[channel.id])
  const isPrivate = channel.type === 'P'
  const isDM = channel.type === 'D' || channel.type === 'G'
  const toggleFavorite = useToggleFavorite(useCurrentUserId())
  const removeChannel = useChatStore((s) => s.removeChannel)
  const clearUnread = useChatStore((s) => s.clearUnread)
  const { toast } = useToast()

  const onLeave = useCallback(async () => {
    const { useLMSStore } = await import('@/store/lms-store')
    const meId = useLMSStore.getState().authUser?.id
    if (!meId) return
    try {
      await client4.removeFromChannel(meId, channel.id)
      removeChannel(channel.id)
      toast({ title: t('chat.leftChannel', 'Đã rời kênh') })
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.leaveFailed', 'Rời kênh thất bại'), variant: 'destructive' })
    }
  }, [channel.id, removeChannel, toast, t])

  const onMarkRead = useCallback(() => {
    client4.viewMyChannel(channel.id).then(() => clearUnread(channel.id)).catch(() => {})
  }, [channel.id, clearUnread])

  const onToggleFav = useCallback(() => {
    const teamId = channel.team_id
    if (!teamId) return
    const isFav = (() => {
      const cats = useChatStore.getState().categoriesByTeam[teamId]?.categories ?? []
      const fav = cats.find((cat) => cat.type === 'favorites')
      return !!fav?.channel_ids.includes(channel.id)
    })()
    toggleFavorite.mutate({ channelId: channel.id, teamId, favorite: !isFav })
  }, [channel.id, channel.team_id, toggleFavorite])

  return (
    <div className="group relative flex items-center">
      <button
        onClick={() => onSelect(channel)}
        className={`w-full flex items-center gap-2.5 h-9 pl-3 pr-2 rounded-lg text-sm transition-colors duration-100 text-left ${
          isSelected
            ? 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-foreground/90 font-medium'
            : unread > 0 || mentions > 0
              ? 'text-foreground font-medium hover:bg-muted/70'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
        }`}
      >
        {/* Unread dot on the leading edge (Discord convention) — bold text
            plus the dot together; mention count escalates to the pill below. */}
        {mentions === 0 && unread > 0 && (
          <span className="absolute left-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
        )}
        {isDM ? (
          <span className="relative shrink-0">
            <Users className="h-4 w-4 opacity-70" />
            {presence && (
              <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-background ${PRESENCE_COLOR[presence]}`} />
            )}
          </span>
        ) : isPrivate ? (
          <Lock className="h-4 w-4 shrink-0 opacity-70" />
        ) : (
          <Hash className="h-4 w-4 shrink-0 opacity-70" />
        )}
        <span className="truncate flex-1">{channel.display_name}</span>
        {hasCall && (
          <PhoneCall className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 animate-pulse" aria-label={t('chat.callInProgress', 'Cuộc gọi đang diễn ra')} />
        )}
        {mentions > 0 ? (
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums shrink-0">{mentions > 99 ? '99+' : mentions}</span>
        ) : unread > 0 ? (
          <span className="text-[11px] font-semibold text-primary dark:text-primary-foreground/80 tabular-nums shrink-0">{unread > 99 ? '99+' : unread}</span>
        ) : null}
      </button>

      {/* Per-row context menu (subset of the vendored sidebar_channel_menu). */}
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost" size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
            onClick={(e) => e.stopPropagation()}
            aria-label={t('chat.channelOptions', 'Tùy chọn kênh')}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1" onClick={(e) => e.stopPropagation()}>
          <MenuButton icon={<CheckCheck className="h-3.5 w-3.5" />} label={t('chat.markAsRead', 'Đánh dấu đã đọc')} onClick={() => { onMarkRead(); setMenuOpen(false) }} />
          <MenuButton icon={<Star className="h-3.5 w-3.5" />} label={t('chat.favorite', 'Yêu thích')} onClick={() => { onToggleFav(); setMenuOpen(false) }} />
          {channel.type !== 'D' && (
            <MenuButton icon={<LogOut className="h-3.5 w-3.5" />} label={t('chat.leaveChannel', 'Rời kênh')} danger onClick={() => { onLeave(); setMenuOpen(false) }} />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function MenuButton({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-left transition-colors hover:bg-muted ${danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground'}`}
    >
      {icon}
      {label}
    </button>
  )
}

/** Empty state shown when no channel is selected. */
export function NoChannelSelected() {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-6">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
        <MessageSquare className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{t('chat.selectChannel', 'Chọn một kênh để bắt đầu')}</p>
        <p className="text-sm text-muted-foreground mt-1">{t('chat.selectChannelHint', 'Các kênh lớp học của bạn nằm ở danh sách bên trái')}</p>
      </div>
    </div>
  )
}
