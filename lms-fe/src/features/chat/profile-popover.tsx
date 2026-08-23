'use client'

/**
 * User profile popover — ports the vendored profile_popover. Shown on click of
 * a user's avatar/name: avatar + presence dot, full name, @username, email,
 * and action buttons (Send message / Mention). Uses a simple positioning
 * wrapper since lms-fe has no floating-ui dependency.
 */

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, AtSign, Mail, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/shared/avatar'
import { useChatStore } from '@/lib/chat/store'
import { useUsers, useStatuses, useOpenDirectChannel } from '@/lib/chat/hooks'
import { useLMSStore } from '@/store/lms-store'
import { displayUsername } from '@/lib/chat/utils'
import type { PresenceStatus } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'

interface ProfilePopoverProps {
  userId: string
  children: (open: () => void) => React.ReactNode
  onDirectMessage?: (channelId: string) => void
  onMention?: (username: string) => void
}

const STATUS_LABEL: Record<PresenceStatus, string> = {
  online: 'Trực tuyến',
  away: 'Vắng mặt',
  dnd: 'Không làm phiền',
  offline: 'Ngoại tuyến',
}
const STATUS_DOT: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  dnd: 'bg-rose-500',
  offline: 'bg-gray-400',
}

export function ProfilePopover({ userId, children, onDirectMessage, onMention }: ProfilePopoverProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const users = useChatStore((s) => s.users)
  const statuses = useChatStore((s) => s.statuses)
  const openDm = useOpenDirectChannel()
  const currentUserId = useLMSStore((s) => s.authUser?.id)

  useUsers([userId])
  useStatuses([userId])

  const user = users[userId]
  const status = statuses[userId] ?? 'offline'

  const handleOpen = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) {
      // Position below-right, clamped to viewport.
      const top = Math.min(rect.bottom + 4, window.innerHeight - 280)
      const left = Math.min(rect.left, window.innerWidth - 280)
      setPos({ top, left })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [open])

  const isSelf = userId === currentUserId

  return (
    <>
      <div ref={ref} className="inline-flex">
        {children(handleOpen)}
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 w-64 rounded-xl border bg-popover shadow-xl p-3" style={{ top: pos.top, left: pos.left }}>
            {user ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative">
                    <Avatar name={displayUsername(user)} size="md" />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-popover ${STATUS_DOT[status]}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{displayUsername(user)}</div>
                    <div className="text-xs text-muted-foreground truncate">@{user.username}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">{STATUS_LABEL[status]}</div>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  {user.email && (
                    <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3 w-3" /><span className="truncate">{user.email}</span></div>
                  )}
                  {user.last_activity_at > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3 w-3" /><span>{t('chat.lastActive', 'Hoạt động')}: {new Date(user.last_activity_at).toLocaleDateString()}</span></div>
                  )}
                </div>
                {!isSelf && (
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={async () => {
                      const ch = await openDm.mutateAsync(userId)
                      onDirectMessage?.(ch.id)
                      setOpen(false)
                    }}>
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> {t('chat.message', 'Nhắn tin')}
                    </Button>
                    {onMention && (
                      <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { onMention(user.username); setOpen(false) }}>
                        <AtSign className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">{t('chat.loading', 'Đang tải…')}</p>
            )}
          </div>
        </>
      )}
    </>
  )
}
