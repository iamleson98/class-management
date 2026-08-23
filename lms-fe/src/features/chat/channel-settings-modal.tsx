'use client'

/**
 * Channel settings modal — combines edit header, edit purpose, and notification
 * preferences (ports edit_channel_header_modal / edit_channel_purpose_modal /
 * channel_notifications_modal) into one dialog with tabs.
 */

import { useState, useEffect } from 'react'
import { X, Settings, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { usePatchChannel, useUpdateChannelNotifyProps } from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { useToast } from '@/hooks/use-toast'
import type { ChatChannel } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'

interface ChannelSettingsModalProps {
  channel: ChatChannel
  userId: string
  onClose: () => void
}

type Tab = 'general' | 'notifications'

export function ChannelSettingsModal({ channel, userId, onClose }: ChannelSettingsModalProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('general')
  const [header, setHeader] = useState(channel.header || '')
  const [purpose, setPurpose] = useState(channel.purpose || '')
  const [displayName, setDisplayName] = useState(channel.display_name || '')
  const [desktop, setDesktop] = useState('default')
  const [markUnread, setMarkUnread] = useState('all')

  const patch = usePatchChannel()
  const updateNotify = useUpdateChannelNotifyProps()

  useEffect(() => {
    // Seed notify props from the channel membership.
    const m = useChatStore.getState().memberships[channel.id]
    if (m?.notify_props) {
      setDesktop(m.notify_props.desktop ?? 'default')
      setMarkUnread(m.notify_props.mark_unread ?? 'all')
    }
  }, [channel.id])

  const saveGeneral = async () => {
    try {
      await patch.mutateAsync({ channelId: channel.id, patch: { header, purpose, display_name: displayName } })
      toast({ title: t('chat.saved', 'Đã lưu') })
      onClose()
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.saveFailed', 'Lưu thất bại'), variant: 'destructive' })
    }
  }

  const saveNotifications = async () => {
    try {
      await updateNotify.mutateAsync({ channelId: channel.id, userId, props: { desktop, mark_unread: markUnread } })
      toast({ title: t('chat.saved', 'Đã lưu') })
      onClose()
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.saveFailed', 'Lưu thất bại'), variant: 'destructive' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] rounded-xl border bg-background shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 flex items-center gap-2 px-4 border-b shrink-0">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm truncate">{channel.display_name}</span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex border-b shrink-0">
          {(['general', 'notifications'] as Tab[]).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === tb ? 'border-sky-500 text-sky-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tb === 'general' ? t('chat.general', 'Chung') : t('chat.notifications', 'Thông báo')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {tab === 'general' ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('chat.displayNameLabel', 'Tên hiển thị')}</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('chat.headerLabel', 'Tiêu đề (Markdown)')}</Label>
                <Textarea value={header} onChange={(e) => setHeader(e.target.value)} rows={3} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('chat.purposeLabel', 'Mục đích')}</Label>
                <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} className="text-sm" />
              </div>
              <Button onClick={saveGeneral} disabled={patch.isPending} className="w-full">{t('common.save', 'Lưu')}</Button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('chat.desktopNotif', 'Thông báo máy tính')}</Label>
                <Select value={desktop} onValueChange={setDesktop}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{t('chat.notifDefault', 'Mặc định')}</SelectItem>
                    <SelectItem value="all">{t('chat.notifAll', 'Tất cả')}</SelectItem>
                    <SelectItem value="mention">{t('chat.notifMention', 'Chỉ đề cập')}</SelectItem>
                    <SelectItem value="none">{t('chat.notifNone', 'Tắt')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('chat.markUnread', 'Đánh dấu chưa đọc')}</Label>
                <Select value={markUnread} onValueChange={setMarkUnread}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('chat.unreadAll', 'Tất cả tin nhắn')}</SelectItem>
                    <SelectItem value="mention">{t('chat.unreadMention', 'Chỉ đề cập (tắt tiếng)')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{markUnread === 'mention' ? t('chat.mutedHint', 'Kênh này đã được tắt tiếng.') : ''}</p>
              </div>
              <Button onClick={saveNotifications} disabled={updateNotify.isPending} className="w-full">
                <Bell className="h-3.5 w-3.5 mr-1.5" /> {t('common.save', 'Lưu')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
