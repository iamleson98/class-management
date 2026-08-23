'use client'

/**
 * Channel info pane (RHS) — ports the vendored webapp's channel_members_rhs:
 *   - members listed admins-first, with a section separator
 *   - presence dots from the statuses map (status_change WS + getStatusesByIds poll)
 *   - channel header/purpose rendered as markdown
 */

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import { X, Users, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/shared/avatar'
import { useChannelMembers, useUsers, useStatuses } from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { displayUsername } from '@/lib/chat/utils'
import type { ChatChannel, PresenceStatus } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'

interface ChannelInfoProps {
  channel: ChatChannel
  onClose: () => void
}

const STATUS_DOT: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  dnd: 'bg-rose-500',
  offline: 'bg-gray-400',
}

export function ChannelInfo({ channel, onClose }: ChannelInfoProps) {
  const { t } = useTranslation()
  const membersQuery = useChannelMembers(channel.id)
  const memberUserIds = useMemo(() => (membersQuery.data ?? []).map((m) => m.user_id), [membersQuery.data])
  useUsers(memberUserIds)
  useStatuses(memberUserIds)
  const users = useChatStore((s) => s.users)
  const statuses = useChatStore((s) => s.statuses)

  // Sort: admins (channel_admin / system roles) first, then by display name.
  const sortedMembers = useMemo(() => {
    const list = (membersQuery.data ?? []).map((m) => ({ member: m, user: users[m.user_id] })).filter((x) => x.user)
    return list.sort((a, b) => {
      const aAdmin = a.member.roles?.includes('admin') ? 0 : 1
      const bAdmin = b.member.roles?.includes('admin') ? 0 : 1
      if (aAdmin !== bAdmin) return aAdmin - bAdmin
      return displayUsername(a.user).localeCompare(displayUsername(b.user))
    })
  }, [membersQuery.data, users])

  const firstAdminIdx = sortedMembers.findIndex((x) => !x.member.roles?.includes('admin'))
  const hasAdmins = firstAdminIdx > 0

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="h-12 flex items-center gap-2 px-3 border-b shrink-0">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm truncate">{channel.display_name}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {(channel.header || channel.purpose) && (
            <div className="space-y-2">
              {channel.header && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">{t('chat.header', 'Tiêu đề')}</div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm rounded-lg bg-muted/50 p-2.5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>{channel.header}</ReactMarkdown>
                  </div>
                </div>
              )}
              {channel.purpose && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">{t('chat.purpose', 'Mục đích')}</div>
                  <p className="text-sm text-muted-foreground">{channel.purpose}</p>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
              {t('chat.members', 'Thành viên')} · {sortedMembers.length}
            </div>
            {membersQuery.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}</div>
            ) : (
              <div className="space-y-0.5">
                {sortedMembers.map((x, i) => {
                  // Insert a "Members" separator before the first non-admin.
                  const showSeparator = hasAdmins && i === firstAdminIdx
                  return (
                    <div key={x.user.id}>
                      {showSeparator && (
                        <div className="pt-3 pb-1 px-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{t('chat.membersSection', 'Thành viên')}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-md hover:bg-muted/50">
                        <div className="relative">
                          <Avatar name={displayUsername(x.user)} size="xs" />
                          <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${STATUS_DOT[statuses[x.user.id] ?? 'offline']}`} />
                        </div>
                        <span className="text-sm truncate flex-1">{displayUsername(x.user)}</span>
                        {x.member.roles?.includes('admin') && <Shield className="h-3 w-3 text-sky-500" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
