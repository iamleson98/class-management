'use client'

/**
 * Channel list — ports the vendored webapp's sidebar logic into shadcn/ui:
 *   - channels grouped by team (teaching / operations) then sorted by type+name
 *     (channel_utils.sortChannelsByTypeAndDisplayName)
 *   - unread + mention badges via calculateUnreadCount
 *   - search filter (client-side on display name + channel name)
 *
 * The server scopes membership: a user only ever receives channels they belong
 * to, so this list is automatically focused per the requirement.
 */

import { useMemo, useState } from 'react'
import { Hash, Lock, Users, Search, MessageSquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useChannels } from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { sortChannelsByTypeAndDisplayName } from '@/lib/chat/utils'
import type { ChatChannel } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'

interface ChannelListProps {
  selectedChannelId: string | null
  onSelect: (channel: ChatChannel) => void
}

export function ChannelList({ selectedChannelId, onSelect }: ChannelListProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const channelsQuery = useChannels()
  const teams = useChatStore((s) => s.teams)
  const channels = useChatStore((s) => s.channels)
  const unreadByChannel = useChatStore((s) => s.unreadByChannel)
  const memberships = useChatStore((s) => s.memberships)

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
      .map((team) => ({
        team,
        channels: filtered
          .filter((c) => c.team_id === team.id)
          .sort((a, b) => sortChannelsByTypeAndDisplayName('vi', a, b)),
      }))
      .filter((g) => g.channels.length > 0)
  }, [teams, channels, query])

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chat.search', 'Tìm kênh…')}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
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
            grouped.map(({ team, channels: teamChannels }) => (
              <div key={team.id} className="mb-3">
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {team.display_name || team.name}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {teamChannels.map((channel) => {
                    const isSelected = channel.id === selectedChannelId
                    const isPrivate = channel.type === 'P'
                    const unread = unreadByChannel[channel.id] ?? 0
                    const mentions = memberships[channel.id]?.mention_count ?? 0
                    return (
                      <button
                        key={channel.id}
                        onClick={() => onSelect(channel)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors text-left ${
                          isSelected
                            ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-medium'
                            : unread > 0 || mentions > 0
                              ? 'text-foreground hover:bg-muted/60 font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        }`}
                      >
                        {isPrivate ? (
                          <Lock className="h-4 w-4 shrink-0 opacity-70" />
                        ) : (
                          <Hash className="h-4 w-4 shrink-0 opacity-70" />
                        )}
                        <span className="truncate flex-1">{channel.display_name}</span>
                        {mentions > 0 ? (
                          <Badge className="h-4 min-w-4 px-1 text-[10px] bg-sky-600 text-white hover:bg-sky-600">{mentions}</Badge>
                        ) : unread > 0 ? (
                          <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">{unread > 99 ? '99+' : unread}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
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
