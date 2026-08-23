'use client'

/**
 * Post dot menu — ports the vendored webapp's dot_menu.tsx. The full set of
 * per-message actions: reply, react (emoji picker submenu), forward, mark
 * unread, save/flag, pin, copy text, copy link, edit, delete. Rendered inside
 * a Popover; the react submenu opens a nested EmojiPicker.
 */

import { useState } from 'react'
import {
  MoreVertical, CornerUpRight, Smile, Forward, MailQuestion, Bookmark,
  BookmarkCheck, Pin, Copy, Link2, Pencil, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EmojiPicker } from './emoji-picker'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'
import type { ChatPost } from '@/lib/chat/types'

interface PostMenuProps {
  post: ChatPost
  canEdit: boolean
  isFlagged: boolean
  onReply: () => void
  onReact: (emoji: string) => void
  onForward: () => void
  onMarkUnread: () => void
  onToggleFlag: () => void
  onTogglePin: () => void
  onEdit: () => void
  onDelete: () => void
  teamId?: string
  align?: 'start' | 'end'
}

export function PostMenu(props: PostMenuProps) {
  const { post, canEdit, isFlagged, onReply, onReact, onForward, onMarkUnread, onToggleFlag, onTogglePin, onEdit, onDelete, align = 'start' } = props
  const { t } = useTranslation()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)

  const copyText = () => {
    navigator.clipboard?.writeText(post.message_source || post.message)
    setOpen(false)
    toast({ title: t('chat.copiedText', 'Đã sao chép nội dung') })
  }

  const copyLink = () => {
    const permalink = `${window.location.origin}/pl/${post.id}`
    navigator.clipboard?.writeText(permalink)
    setOpen(false)
    toast({ title: t('chat.copiedLink', 'Đã sao chép liên kết') })
  }

  const item = (icon: React.ReactNode, label: string, onClick: () => void, opts: { danger?: boolean } = {}) => (
    <button
      onClick={() => { onClick(); setOpen(false) }}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-md text-left transition-colors hover:bg-muted ${opts.danger ? 'text-destructive hover:bg-destructive/10' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setShowEmoji(false) }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More">
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-52 p-1" aria-label="Post extra options">
        {showEmoji ? (
          <EmojiPicker onSelect={(emoji) => { onReact(emoji); setShowEmoji(false); setOpen(false) }} onClose={() => setShowEmoji(false)} />
        ) : (
          <div className="space-y-0.5">
            {item(<CornerUpRight className="h-3.5 w-3.5" />, t('chat.reply', 'Trả lời'), onReply)}
            {item(<Smile className="h-3.5 w-3.5" />, t('chat.addReaction', 'Thả cảm xúc'), () => setShowEmoji(true))}
            {item(<Forward className="h-3.5 w-3.5" />, t('chat.forward', 'Chuyển tiếp'), onForward)}
            {item(<MailQuestion className="h-3.5 w-3.5" />, t('chat.markUnread', 'Đánh dấu chưa đọc'), onMarkUnread)}
            {item(
              isFlagged ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />,
              isFlagged ? t('chat.unsave', 'Bỏ lưu') : t('chat.save', 'Lưu tin nhắn'),
              onToggleFlag,
            )}
            {item(
              <Pin className={`h-3.5 w-3.5 ${post.is_pinned ? 'fill-current' : ''}`} />,
              post.is_pinned ? t('chat.unpin', 'Bỏ ghim') : t('chat.pin', 'Ghim'),
              onTogglePin,
            )}
            {item(<Copy className="h-3.5 w-3.5" />, t('chat.copyText', 'Sao chép chữ'), copyText)}
            {item(<Link2 className="h-3.5 w-3.5" />, t('chat.copyLink', 'Sao chép liên kết'), copyLink)}
            {canEdit && item(<Pencil className="h-3.5 w-3.5" />, t('chat.edit', 'Sửa'), onEdit)}
            {item(<Trash2 className="h-3.5 w-3.5" />, t('chat.delete', 'Xóa'), onDelete, { danger: true })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
