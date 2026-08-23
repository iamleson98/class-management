'use client'

/**
 * Status menu — ports the vendored user_account_menu presence items + custom
 * status modal. Lets the current user set online/away/dnd/offline and a custom
 * status (emoji + text). Mounted in the chat header.
 */

import { useState } from 'react'
import { Circle, Clock, MinusCircle, X, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { EmojiPicker } from './emoji-picker'
import { useUpdateStatus, useUpdateCustomStatus, useUnsetCustomStatus } from '@/lib/chat/hooks'
import { useLMSStore } from '@/store/lms-store'
import { useCurrentUserId } from '@/lib/chat/hooks'
import type { PresenceStatus } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'

const STATUS_ITEMS: { value: PresenceStatus; labelKey: string; label: string; icon: typeof Circle; dot: string }[] = [
  { value: 'online', labelKey: 'chat.online', label: 'Trực tuyến', icon: Circle, dot: 'text-emerald-500' },
  { value: 'away', labelKey: 'chat.away', label: 'Vắng mặt', icon: Clock, dot: 'text-amber-500' },
  { value: 'dnd', labelKey: 'chat.dnd', label: 'Không làm phiền', icon: MinusCircle, dot: 'text-rose-500' },
  { value: 'offline', labelKey: 'chat.offline', label: 'Ngoại tuyến', icon: Circle, dot: 'text-gray-400' },
]

interface StatusMenuProps {
  children: React.ReactNode
}

export function StatusMenu({ children }: StatusMenuProps) {
  const { t } = useTranslation()
  const userId = useCurrentUserId()
  const authUser = useLMSStore((s) => s.authUser)
  const updateStatus = useUpdateStatus()
  const updateCustom = useUpdateCustomStatus()
  const unsetCustom = useUnsetCustomStatus()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [emoji, setEmoji] = useState('💬')
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)

  // Parse existing custom status from props.
  const customStatus = (() => {
    try {
      const raw = (authUser?.props as Record<string, string> | undefined)?.customStatus
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })()

  const setStatus = (status: PresenceStatus) => {
    if (userId) updateStatus.mutate({ userId, status })
    setOpen(false)
  }

  const saveCustom = () => {
    updateCustom.mutate({ emoji, text })
    setEditing(false)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(false) }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        {editing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Popover open={showEmoji} onOpenChange={setShowEmoji}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 text-lg">{emoji}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0" align="start">
                  <EmojiPicker onSelect={(e) => { setEmoji(e); setShowEmoji(false) }} onClose={() => setShowEmoji(false)} />
                </PopoverContent>
              </Popover>
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('chat.statusPlaceholder', 'Trạng thái của bạn…')} className="text-sm" autoFocus />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{t('common.cancel', 'Hủy')}</Button>
              <Button size="sm" onClick={saveCustom}>{t('common.save', 'Lưu')}</Button>
            </div>
          </div>
        ) : (
          <>
            {customStatus && (
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded-md bg-muted/50">
                <span className="text-base">{customStatus.emoji || '💬'}</span>
                <span className="text-sm flex-1 truncate">{customStatus.text}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { unsetCustom.mutate(); setOpen(false) }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <button onClick={() => setEditing(true)} className="w-full flex items-center gap-2.5 px-2 py-1.5 text-sm rounded-md hover:bg-muted text-left">
              <Smile className="h-4 w-4 text-muted-foreground" /> {t('chat.setCustomStatus', 'Đặt trạng thái')}
            </button>
            <div className="h-px bg-border my-1" />
            {STATUS_ITEMS.map((item) => (
              <button key={item.value} onClick={() => setStatus(item.value)} className="w-full flex items-center gap-2.5 px-2 py-1.5 text-sm rounded-md hover:bg-muted text-left">
                <item.icon className={`h-4 w-4 ${item.dot} ${item.value === 'online' ? 'fill-current' : ''}`} />
                {t(item.labelKey, item.label)}
              </button>
            ))}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
