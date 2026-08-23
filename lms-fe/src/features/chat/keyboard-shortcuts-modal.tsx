'use client'

/**
 * Keyboard shortcuts help modal — ports the vendored
 * keyboard_shortcuts_modal.tsx. Renders the full KEYBOARD_SHORTCUTS catalog
 * grouped into Navigation / Messages / Browser columns. The shortcuts data is
 * a faithful port of keyboard_shortcuts.ts (description + key sequence).
 */

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTranslation } from '@/lib/i18n'

interface ShortcutDef {
  id: string
  descKey: string
  desc: string
  keys: string[][]
}

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'
const ALT = isMac ? '⌥' : 'Alt'
const SHIFT = 'Shift'

// Helpers to render key sequences with platform-aware modifiers.
const k = (...keys: string[]) => keys

const NAVIGATION: ShortcutDef[] = [
  { id: 'navPrev', descKey: 'shortcut.prevChannel', desc: 'Kênh trước', keys: [[ALT, '↑']] },
  { id: 'navNext', descKey: 'shortcut.nextChannel', desc: 'Kênh tiếp theo', keys: [[ALT, '↓']] },
  { id: 'navUnreadPrev', descKey: 'shortcut.prevUnread', desc: 'Kênh chưa đọc trước', keys: [[ALT, SHIFT, '↑']] },
  { id: 'navUnreadNext', descKey: 'shortcut.nextUnread', desc: 'Kênh chưa đọc tiếp', keys: [[ALT, SHIFT, '↓']] },
  { id: 'navSwitcher', descKey: 'shortcut.quickSwitch', desc: 'Chuyển kênh nhanh', keys: [[MOD, 'K']] },
  { id: 'navSettings', descKey: 'shortcut.settings', desc: 'Cài đặt', keys: [[MOD, SHIFT, 'A']] },
  { id: 'navMentions', descKey: 'shortcut.mentions', desc: 'Đề cập gần đây', keys: [[MOD, SHIFT, 'M']] },
  { id: 'navFocusCenter', descKey: 'shortcut.focusInput', desc: 'Focus ô nhập', keys: [[MOD, SHIFT, 'L']] },
  { id: 'navOpenCloseSidebar', descKey: 'shortcut.toggleRhs', desc: 'Mở/đóng khung phải', keys: [[MOD, '.']] },
  { id: 'navOpenChannelInfo', descKey: 'shortcut.channelInfo', desc: 'Thông tin kênh', keys: [[MOD, isMac ? SHIFT : ALT, 'I']] },
  { id: 'navToggleUnreads', descKey: 'shortcut.toggleUnreads', desc: 'Bật/tắt chỉ chưa đọc', keys: [[MOD, SHIFT, 'U']] },
]

const MESSAGES: ShortcutDef[] = [
  { id: 'msgEdit', descKey: 'shortcut.editLast', desc: 'Sửa tin nhắn cuối', keys: [['↑']] },
  { id: 'msgReply', descKey: 'shortcut.replyLast', desc: 'Trả lời tin nhắn cuối', keys: [[SHIFT, '↑']] },
  { id: 'msgCompUsername', descKey: 'shortcut.mentionUser', desc: 'Đề cập @người', keys: [['@', '[a-z]', 'Tab']] },
  { id: 'msgCompChannel', descKey: 'shortcut.mentionChannel', desc: 'Đề cập ~kênh', keys: [['~', '[a-z]', 'Tab']] },
  { id: 'msgCompEmoji', descKey: 'shortcut.emoji', desc: 'Emoji', keys: [[':', '[a-z]', 'Tab']] },
  { id: 'msgMarkdownBold', descKey: 'shortcut.bold', desc: 'In đậm', keys: [[MOD, 'B']] },
  { id: 'msgMarkdownItalic', descKey: 'shortcut.italic', desc: 'In nghiêng', keys: [[MOD, 'I']] },
  { id: 'msgMarkdownCode', descKey: 'shortcut.code', desc: 'Mã', keys: [[MOD, ALT, 'C']] },
  { id: 'msgMarkdownLink', descKey: 'shortcut.link', desc: 'Liên kết', keys: [[MOD, ALT, 'K']] },
  { id: 'msgSearchChannel', descKey: 'shortcut.searchChannel', desc: 'Tìm trong kênh', keys: [[MOD, 'F']] },
  { id: 'filesUpload', descKey: 'shortcut.upload', desc: 'Tải file lên', keys: [[MOD, 'U']] },
  { id: 'markAllRead', descKey: 'shortcut.markAllRead', desc: 'Đánh dấu đã đọc tất cả', keys: [[SHIFT, 'Esc']] },
]

const BROWSER: ShortcutDef[] = [
  { id: 'browserChannelPrev', descKey: 'shortcut.back', desc: 'Lùi lại', keys: [[ALT, '←']] },
  { id: 'browserChannelNext', descKey: 'shortcut.forward', desc: 'Tiến tới', keys: [[ALT, '→']] },
  { id: 'browserNewline', descKey: 'shortcut.newline', desc: 'Xuống dòng', keys: [[SHIFT, 'Enter']] },
]

interface ColumnProps {
  titleKey: string
  title: string
  shortcuts: ShortcutDef[]
}

function ShortcutColumn({ titleKey, title, shortcuts }: ColumnProps) {
  const { t } = useTranslation()
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-2">{t(titleKey, title)}</h3>
      <div className="space-y-2">
        {shortcuts.map((sc) => (
          <div key={sc.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{t(sc.descKey, sc.desc)}</span>
            <span className="flex items-center gap-1 shrink-0">
              {sc.keys.map((seq, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  {seq.map((key, j) => (
                    <kbd key={j} className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded border bg-muted text-[10px] font-medium">
                      {key}
                    </kbd>
                  ))}
                  {i < sc.keys.length - 1 && <span className="text-muted-foreground text-xs">+ </span>}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface KeyboardShortcutsModalProps {
  onClose: () => void
}

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] rounded-xl border bg-background shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 flex items-center gap-2 px-4 border-b shrink-0">
          <span className="font-medium text-sm">{t('chat.keyboardShortcuts', 'Phím tắt')}</span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            <ShortcutColumn titleKey="shortcut.navHeader" title="Điều hướng" shortcuts={NAVIGATION} />
            <ShortcutColumn titleKey="shortcut.msgHeader" title="Tin nhắn" shortcuts={MESSAGES} />
            <ShortcutColumn titleKey="shortcut.browserHeader" title="Trình duyệt" shortcuts={BROWSER} />
          </div>
        </ScrollArea>
        <div className="px-4 py-2.5 border-t text-xs text-muted-foreground">
          {t('chat.slashHint', 'Bắt đầu tin nhắn bằng / để xem danh sách lệnh.')}
        </div>
      </div>
    </div>
  )
}

/** Keypressed helper matching the vendored Keyboard.isKeyPressed. */
export function cmdOrCtrlPressed(e: KeyboardEvent | React.KeyboardEvent, allowAlt = false): boolean {
  const isMacPlatform = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
  if (isMacPlatform) return e.metaKey && (allowAlt || !e.altKey)
  return e.ctrlKey && (allowAlt || !e.altKey)
}

export function isKeyPressed(e: KeyboardEvent | React.KeyboardEvent, codes: [string, number]): boolean {
  return e.key === codes[0] || e.keyCode === codes[1]
}

export { MOD, ALT, SHIFT }
