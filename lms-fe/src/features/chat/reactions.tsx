'use client'

/**
 * Shared chat reaction UI (used by the channel post list and the thread view):
 *
 *  - QUICK_EMOJIS: the popular shortcodes offered in the hover bar.
 *  - QuickReactionBar: the hover-revealed reaction bar. It hugs the message
 *    bubble — rendered inside the (relative) bubble, floating directly ABOVE
 *    it, anchored to the bubble's own edge — so it always stays close to the
 *    message (Telegram-style) instead of floating at the far corner of the
 *    row. Trailing actions (reply, overflow menu) can be passed as children.
 *  - ReactionPills: the always-visible grouped reaction chips rendered under
 *    the message bubble.
 *
 * Emoji names MUST be Mattermost emoji shortcode names (server-side reaction
 * validation), NOT unicode glyphs — the server rejects unknown names with 404
 * (app.emoji.get_by_name.no_result). They are rendered as glyphs via
 * shortcodeToUnicode().
 */

import { useMemo } from 'react'
import { Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/lib/chat/store'
import { useCurrentUserId } from '@/lib/chat/hooks'
import { shortcodeToUnicode } from '@/lib/chat/emoji-data'
import { useTranslation } from '@/lib/i18n'
import type { ChatReaction } from '@/lib/chat/types'

export const QUICK_EMOJIS = ['+1', 'heart', 'tada', 'joy', 'eyes']

// Module-scope empty list: keeps the zustand selector's return value stable
// for posts without reactions (a per-render [] would change identity on every
// snapshot and force needless re-renders). Read-only by convention.
const EMPTY_REACTIONS: ChatReaction[] = []

interface QuickReactionBarProps {
  onToggle: (emojiName: string) => void
  /** Bubble edge the bar anchors to — 'end' for own bubbles, 'start' for peers'. */
  align?: 'start' | 'end'
  /** Controlled open state of the extended emoji popover; the parent resets it when the row un-hovers. */
  emojiOpen: boolean
  onEmojiOpenChange: (open: boolean) => void
  /** Trailing actions (reply button, overflow menu) rendered after the emoji buttons. */
  children?: React.ReactNode
}

/**
 * QuickReactionBar — popular reaction icons + emoji picker, hovering directly
 * above the message bubble. Must be rendered inside the bubble element (the
 * positioning context, `relative`), which keeps it glued to the message.
 */
export function QuickReactionBar({ onToggle, align = 'start', emojiOpen, onEmojiOpenChange, children }: QuickReactionBarProps) {
  const { t } = useTranslation()
  return (
    <div
      className={`absolute bottom-full z-10 mb-1 flex items-center h-8 rounded-lg border bg-popover shadow-md opacity-0 scale-95 pointer-events-none group-hover/row:opacity-100 group-hover/row:scale-100 group-hover/row:pointer-events-auto focus-within:opacity-100 focus-within:scale-100 focus-within:pointer-events-auto transition-all duration-100 ease-out ${align === 'end' ? 'right-0' : 'left-0'}`}
      role="toolbar"
      aria-label={t('chat.messageActions', 'Thao tác tin nhắn')}
    >
      {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          title={`:${emoji}:`}
          className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-[15px] leading-none"
        >
          {shortcodeToUnicode(emoji) ?? `:${emoji}:`}
        </button>
      ))}
      <div className="relative">
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => onEmojiOpenChange(!emojiOpen)} title={t('chat.addReaction', 'Thêm cảm xúc')}>
          <Smile className="h-4 w-4" />
        </Button>
        {emojiOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => onEmojiOpenChange(false)} />
            <div className="absolute top-full right-0 z-50 mt-1 flex gap-1 rounded-lg border bg-popover shadow-lg p-1.5">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onToggle(emoji); onEmojiOpenChange(false) }}
                  title={`:${emoji}:`}
                  className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center text-base"
                >
                  {shortcodeToUnicode(emoji) ?? `:${emoji}:`}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {children}
    </div>
  )
}

interface ReactionPillsProps {
  postId: string
  onToggle: (emojiName: string) => void
  className?: string
}

/**
 * ReactionPills — grouped reaction chips (emoji + count, highlighted when the
 * current user reacted), rendered directly under the message bubble.
 */
export function ReactionPills({ postId, onToggle, className = '' }: ReactionPillsProps) {
  const reactions = useChatStore((s) => s.reactionsByPost[postId] ?? EMPTY_REACTIONS)
  const currentUserId = useCurrentUserId()

  const grouped = useMemo(() => {
    const m: Record<string, { count: number; mine: boolean }> = {}
    for (const r of reactions) {
      if (!m[r.emoji_name]) m[r.emoji_name] = { count: 0, mine: false }
      m[r.emoji_name].count += 1
      if (r.user_id === currentUserId) m[r.emoji_name].mine = true
    }
    return m
  }, [reactions, currentUserId])

  if (Object.keys(grouped).length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 mt-1.5 ${className}`}>
      {Object.entries(grouped).map(([emoji, info]) => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          title={`:${emoji}:`}
          className={`inline-flex items-center gap-1 h-6 rounded-full px-2 text-xs border transition-all duration-150 active:scale-95 ${
            info.mine
              ? 'bg-primary/10 border-primary/40 text-primary dark:text-primary-foreground/90 dark:bg-primary/25 dark:border-primary/50'
              : 'bg-background border-border hover:border-muted-foreground/40 hover:bg-muted'
          }`}
        >
          <span className="text-[13px] leading-none">{shortcodeToUnicode(emoji) ?? `:${emoji}:`}</span>
          <span className="font-semibold tabular-nums">{info.count}</span>
        </button>
      ))}
    </div>
  )
}
