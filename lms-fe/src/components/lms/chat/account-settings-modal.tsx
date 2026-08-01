'use client'

/**
 * Account settings modal — ports the vendored user_settings_modal with its five
 * tabs (Display, Sidebar, Advanced, Notifications, Theme). Each tab saves its
 * preferences via savePreferences (display/sidebar/advanced/theme) or patchMe
 * (notifications, which live on user.notify_props). All preference keys + their
 * accepted values match the vendored constants exactly.
 */

import { useState, useEffect } from 'react'
import { X, Palette, Bell, Layout, Sidebar as SidebarIcon, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMyPreferences, useSavePreferences, usePatchMe, PREF } from '@/lib/chat/use-preferences'
import { useLMSStore } from '@/store/lms-store'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'

type Tab = 'display' | 'sidebar' | 'advanced' | 'notifications' | 'theme'

interface AccountSettingsModalProps {
  onClose: () => void
}

export function AccountSettingsModal({ onClose }: AccountSettingsModalProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('display')
  const prefsQuery = useMyPreferences()
  const savePrefs = useSavePreferences()
  const patchMe = usePatchMe()
  const authUser = useLMSStore((s) => s.authUser)

  const p = prefsQuery.data ?? {}

  const tabs: { id: Tab; labelKey: string; label: string; icon: typeof Layout }[] = [
    { id: 'display', labelKey: 'chat.tabDisplay', label: 'Hiển thị', icon: Layout },
    { id: 'sidebar', labelKey: 'chat.tabSidebar', label: 'Thanh bên', icon: SidebarIcon },
    { id: 'advanced', labelKey: 'chat.tabAdvanced', label: 'Nâng cao', icon: Zap },
    { id: 'notifications', labelKey: 'chat.tabNotifications', label: 'Thông báo', icon: Bell },
    { id: 'theme', labelKey: 'chat.tabTheme', label: 'Giao diện', icon: Palette },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] rounded-xl border bg-background shadow-xl flex" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar tabs */}
        <div className="w-44 shrink-0 border-r p-2 space-y-0.5">
          <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{t('chat.settings', 'Cài đặt')}</div>
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-left transition-colors ${tab === tb.id ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
            >
              <tb.icon className="h-4 w-4" />
              {t(tb.labelKey, tb.label)}
            </button>
          ))}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={onClose}>
            <X className="h-4 w-4 mr-2" /> {t('common.close', 'Đóng')}
          </Button>
        </div>

        {/* Tab content */}
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5">
              {tab === 'display' && <DisplayTab prefs={p} userId={authUser?.id ?? ''} onSave={savePrefs} />}
              {tab === 'sidebar' && <SidebarTab prefs={p} userId={authUser?.id ?? ''} onSave={savePrefs} />}
              {tab === 'advanced' && <AdvancedTab prefs={p} userId={authUser?.id ?? ''} onSave={savePrefs} />}
              {tab === 'notifications' && <NotificationsTab authUser={authUser} onSavePatch={patchMe} />}
              {tab === 'theme' && <ThemeTab prefs={p} userId={authUser?.id ?? ''} onSave={savePrefs} onApplied={() => toast({ title: t('chat.saved', 'Đã lưu') })} />}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

type PrefsMap = Record<string, string>
interface TabProps {
  prefs: PrefsMap
  userId: string
  onSave: ReturnType<typeof useSavePreferences>
}

const prefValue = (p: PrefsMap, category: string, name: string) => p[`${category}:${name}`]

function DisplayTab({ prefs, userId, onSave }: TabProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [military, setMilitary] = useState(prefValue(prefs, PREF.CATEGORY_DISPLAY_SETTINGS, PREF.USE_MILITARY_TIME) !== 'false')
  const [messageDisplay, setMessageDisplay] = useState(prefValue(prefs, PREF.CATEGORY_DISPLAY_SETTINGS, PREF.MESSAGE_DISPLAY) || 'clean')
  const [nameFormat, setNameFormat] = useState(prefValue(prefs, PREF.CATEGORY_DISPLAY_SETTINGS, PREF.NAME_NAME_FORMAT) || 'nickname_full_name')
  const [linkPreviews, setLinkPreviews] = useState(prefValue(prefs, PREF.CATEGORY_DISPLAY_SETTINGS, PREF.LINK_PREVIEW_DISPLAY) !== 'false')
  const [oneClickReactions, setOneClickReactions] = useState(prefValue(prefs, PREF.CATEGORY_DISPLAY_SETTINGS, PREF.ONE_CLICK_REACTIONS_ENABLED) !== 'false')
  const [clickToReply, setClickToReply] = useState(prefValue(prefs, PREF.CATEGORY_DISPLAY_SETTINGS, PREF.CLICK_TO_REPLY) !== 'false')
  const [availability, setAvailability] = useState(prefValue(prefs, PREF.CATEGORY_DISPLAY_SETTINGS, PREF.AVAILABILITY_STATUS_ON_POSTS) !== 'false')

  const save = async () => {
    await onSave.mutateAsync([
      { user_id: userId, category: PREF.CATEGORY_DISPLAY_SETTINGS, name: PREF.USE_MILITARY_TIME, value: military ? 'true' : 'false' },
      { user_id: userId, category: PREF.CATEGORY_DISPLAY_SETTINGS, name: PREF.MESSAGE_DISPLAY, value: messageDisplay },
      { user_id: userId, category: PREF.CATEGORY_DISPLAY_SETTINGS, name: PREF.NAME_NAME_FORMAT, value: nameFormat },
      { user_id: userId, category: PREF.CATEGORY_DISPLAY_SETTINGS, name: PREF.LINK_PREVIEW_DISPLAY, value: linkPreviews ? 'true' : 'false' },
      { user_id: userId, category: PREF.CATEGORY_DISPLAY_SETTINGS, name: PREF.ONE_CLICK_REACTIONS_ENABLED, value: oneClickReactions ? 'true' : 'false' },
      { user_id: userId, category: PREF.CATEGORY_DISPLAY_SETTINGS, name: PREF.CLICK_TO_REPLY, value: clickToReply ? 'true' : 'false' },
      { user_id: userId, category: PREF.CATEGORY_DISPLAY_SETTINGS, name: PREF.AVAILABILITY_STATUS_ON_POSTS, value: availability ? 'true' : 'false' },
    ])
    toast({ title: t('chat.saved', 'Đã lưu') })
  }

  return (
    <div className="space-y-5">
      <SettingRow label={t('chat.clockDisplay', 'Định dạng giờ')}>
        <Select value={military ? '24' : '12'} onValueChange={(v) => setMilitary(v === '24')}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="12">12 giờ</SelectItem><SelectItem value="24">24 giờ</SelectItem></SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label={t('chat.teammateNameDisplay', 'Hiển thị tên')}>
        <Select value={nameFormat} onValueChange={setNameFormat}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={PREF.DISPLAY_PREFER_NICKNAME_FULLNAME}>Biệt danh + Họ tên</SelectItem>
            <SelectItem value={PREF.DISPLAY_PREFER_FULL_NAME}>Họ và tên</SelectItem>
            <SelectItem value={PREF.DISPLAY_PREFER_USERNAME}>Tên đăng nhập</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label={t('chat.messageDisplay', 'Bố cục tin nhắn')}>
        <Select value={messageDisplay} onValueChange={setMessageDisplay}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="clean">Tiêu chuẩn</SelectItem><SelectItem value="compact">Gọn</SelectItem></SelectContent>
        </Select>
      </SettingRow>
      <SettingToggle label={t('chat.linkPreviews', 'Xem trước liên kết')} checked={linkPreviews} onChange={setLinkPreviews} />
      <SettingToggle label={t('chat.oneClickReactions', 'Thả cảm xúc nhanh')} checked={oneClickReactions} onChange={setOneClickReactions} />
      <SettingToggle label={t('chat.clickToReply', 'Nhấp để trả lời')} checked={clickToReply} onChange={setClickToReply} />
      <SettingToggle label={t('chat.availabilityOnPosts', 'Hiện trạng thái trên bài viết')} checked={availability} onChange={setAvailability} />
      <Button onClick={save} disabled={onSave.isPending}>{t('common.save', 'Lưu')}</Button>
    </div>
  )
}

function SidebarTab({ prefs, userId, onSave }: TabProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [showUnreads, setShowUnreads] = useState(prefValue(prefs, PREF.CATEGORY_SIDEBAR_SETTINGS, PREF.SHOW_UNREAD_SECTION) === 'true')
  const [limitDms, setLimitDms] = useState(prefValue(prefs, PREF.CATEGORY_SIDEBAR_SETTINGS, PREF.LIMIT_VISIBLE_DMS_GMS) || '20')

  const save = async () => {
    await onSave.mutateAsync([
      { user_id: userId, category: PREF.CATEGORY_SIDEBAR_SETTINGS, name: PREF.SHOW_UNREAD_SECTION, value: showUnreads ? 'true' : 'false' },
      { user_id: userId, category: PREF.CATEGORY_SIDEBAR_SETTINGS, name: PREF.LIMIT_VISIBLE_DMS_GMS, value: limitDms },
    ])
    toast({ title: t('chat.saved', 'Đã lưu') })
  }

  return (
    <div className="space-y-5">
      <SettingToggle label={t('chat.showUnreads', 'Hiện mục Chưa đọc')} checked={showUnreads} onChange={setShowUnreads} />
      <SettingRow label={t('chat.limitDms', 'Giới hạn tin nhắn trực tiếp hiển thị')}>
        <Select value={limitDms} onValueChange={setLimitDms}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="15">15</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="40">40</SelectItem></SelectContent>
        </Select>
      </SettingRow>
      <Button onClick={save} disabled={onSave.isPending}>{t('common.save', 'Lưu')}</Button>
    </div>
  )
}

function AdvancedTab({ prefs, userId, onSave }: TabProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [sendOnCtrlEnter, setSendOnCtrlEnter] = useState(prefValue(prefs, PREF.CATEGORY_ADVANCED_SETTINGS, PREF.ADVANCED_SEND_ON_CTRL_ENTER) === 'true')
  const [filterJoinLeave, setFilterJoinLeave] = useState(prefValue(prefs, PREF.CATEGORY_ADVANCED_SETTINGS, PREF.ADVANCED_FILTER_JOIN_LEAVE) === 'true')
  const [syncDrafts, setSyncDrafts] = useState(prefValue(prefs, PREF.CATEGORY_ADVANCED_SETTINGS, PREF.ADVANCED_SYNC_DRAFTS) !== 'false')

  const save = async () => {
    await onSave.mutateAsync([
      { user_id: userId, category: PREF.CATEGORY_ADVANCED_SETTINGS, name: PREF.ADVANCED_SEND_ON_CTRL_ENTER, value: sendOnCtrlEnter ? 'true' : 'false' },
      { user_id: userId, category: PREF.CATEGORY_ADVANCED_SETTINGS, name: PREF.ADVANCED_FILTER_JOIN_LEAVE, value: filterJoinLeave ? 'true' : 'false' },
      { user_id: userId, category: PREF.CATEGORY_ADVANCED_SETTINGS, name: PREF.ADVANCED_SYNC_DRAFTS, value: syncDrafts ? 'true' : 'false' },
    ])
    toast({ title: t('chat.saved', 'Đã lưu') })
  }

  return (
    <div className="space-y-5">
      <SettingToggle label={t('chat.sendOnCtrlEnter', 'Gửi bằng Ctrl+Enter')} checked={sendOnCtrlEnter} onChange={setSendOnCtrlEnter} />
      <SettingToggle label={t('chat.filterJoinLeave', 'Ẩn tin tham gia/rời kênh')} checked={filterJoinLeave} onChange={setFilterJoinLeave} />
      <SettingToggle label={t('chat.syncDrafts', 'Đồng bộ bản nháp')} checked={syncDrafts} onChange={setSyncDrafts} />
      <Button onClick={save} disabled={onSave.isPending}>{t('common.save', 'Lưu')}</Button>
    </div>
  )
}

function NotificationsTab({ authUser, onSavePatch }: { authUser: ReturnType<typeof useLMSStore.getState>['authUser']; onSavePatch: ReturnType<typeof usePatchMe> }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const notifyProps = ((authUser as Record<string, unknown> | null)?.notify_props ?? (authUser as Record<string, unknown> | null)?.notifyprops ?? {}) as Record<string, string>
  const [desktop, setDesktop] = useState(notifyProps.desktop || 'default')
  const [email, setEmail] = useState(notifyProps.email !== 'false')
  const [comments, setComments] = useState(notifyProps.comments || 'never')
  const [markUnread, setMarkUnread] = useState(notifyProps.mark_unread || 'all')

  const save = async () => {
    await onSavePatch.mutateAsync({ notify_props: { desktop, email: email ? 'true' : 'false', comments, mark_unread: markUnread } } as never)
    toast({ title: t('chat.saved', 'Đã lưu') })
  }

  return (
    <div className="space-y-5">
      <SettingRow label={t('chat.desktopNotif', 'Thông báo máy tính')}>
        <Select value={desktop} onValueChange={setDesktop}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t('chat.notifDefault', 'Mặc định')}</SelectItem>
            <SelectItem value="all">{t('chat.notifAll', 'Tất cả')}</SelectItem>
            <SelectItem value="mention">{t('chat.notifMention', 'Chỉ đề cập')}</SelectItem>
            <SelectItem value="none">{t('chat.notifNone', 'Tắt')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingToggle label={t('chat.emailNotif', 'Thông báo email')} checked={email} onChange={setEmail} />
      <SettingRow label={t('chat.commentsNotif', 'Phản hồi chuỗi')}>
        <Select value={comments} onValueChange={setComments}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t('chat.commentsAny', 'Mọi phản hồi')}</SelectItem>
            <SelectItem value="root">{t('chat.commentsRoot', 'Chỉ chuỗi của tôi')}</SelectItem>
            <SelectItem value="never">{t('chat.commentsNever', 'Không')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label={t('chat.markUnread', 'Đánh dấu chưa đọc')}>
        <Select value={markUnread} onValueChange={setMarkUnread}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('chat.unreadAll', 'Tất cả')}</SelectItem>
            <SelectItem value="mention">{t('chat.unreadMention', 'Chỉ đề cập')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <Button onClick={save} disabled={onSavePatch.isPending}>{t('common.save', 'Lưu')}</Button>
    </div>
  )
}

const THEMES = [
  { key: 'denim', label: 'Denim', colors: { sidebarBg: '#1f3e5f', linkColor: '#2389d7', buttonBg: '#2389d7' } },
  { key: 'sapphire', label: 'Sapphire', colors: { sidebarBg: '#325579', linkColor: '#1666c9', buttonBg: '#1666c9' } },
  { key: 'quartz', label: 'Quartz', colors: { sidebarBg: '#4a4a4a', linkColor: '#2566b1', buttonBg: '#2566b1' } },
  { key: 'indigo', label: 'Indigo', colors: { sidebarBg: '#262a43', linkColor: '#2a66e6', buttonBg: '#2a66e6' } },
  { key: 'onyx', label: 'Onyx', colors: { sidebarBg: '#222222', linkColor: '#3eadff', buttonBg: '#3eadff' } },
]

function ThemeTab({ prefs, userId, onSave, onApplied }: TabProps & { onApplied: () => void }) {
  const { t } = useTranslation()
  const current = prefValue(prefs, PREF.CATEGORY_THEME, '') ? JSON.parse(prefValue(prefs, PREF.CATEGORY_THEME, '')).type || 'denim' : 'denim'
  const [selected, setSelected] = useState(current)
  const apply = async (key: string) => {
    setSelected(key)
    const theme = THEMES.find((th) => th.key === key)
    if (!theme) return
    await onSave.mutateAsync([{ user_id: userId, category: PREF.CATEGORY_THEME, name: '', value: JSON.stringify({ type: key, ...theme.colors }) }])
    onApplied()
  }
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEMES.map((th) => (
          <button key={th.key} onClick={() => apply(th.key)} className={`rounded-lg border-2 p-3 text-left transition-colors ${selected === th.key ? 'border-sky-500' : 'border-border hover:border-muted-foreground/40'}`}>
            <div className="flex gap-1 mb-2">
              <span className="h-5 w-5 rounded" style={{ background: th.colors.sidebarBg }} />
              <span className="h-5 w-5 rounded" style={{ background: th.colors.linkColor }} />
              <span className="h-5 w-5 rounded" style={{ background: th.colors.buttonBg }} />
            </div>
            <div className="text-sm font-medium">{th.label}</div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">{t('chat.themeNote', 'Giao diện kênh trò chuyện áp dụng cho các màu nhấn.')}</p>
    </div>
  )
}

// ─── Reusable setting rows ──────────────────────────────────────────

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-sm font-normal">{label}</Label>
      {children}
    </div>
  )
}

function SettingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-sm font-normal">{label}</Label>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
    </div>
  )
}
