'use client'

/**
 * Typing indicator — ported from the vendored webapp's MsgTyping
 * (src/chat/channels/src/components/msg_typing/msg_typing.tsx).
 *
 * The state machine lives in the chat store: setTyping arms a per-event
 * timeout (matching the typing throttle) and clearTyping fires on posted/
 * timeout. This component just reads the current typing users for the
 * channel (+optional thread root) and renders the pluralized label.
 */

import { useMemo } from 'react'
import { useChatStore } from '@/lib/chat/store'
import { useUsers } from '@/lib/chat/hooks'
import { displayUsername } from '@/lib/chat/utils'
import { useTranslation } from '@/lib/i18n'
import { useLMSStore } from '@/store/lms-store'

interface TypingIndicatorProps {
  channelId: string
  /** Thread root id — typing is scoped per channel+root, matching the store key. */
  rootId?: string | null
}

export function TypingIndicator({ channelId, rootId }: TypingIndicatorProps) {
  const { t } = useTranslation()
  const authUserId = useLMSStore((s) => s.authUser?.id)
  // Subscribe to typing state so we re-render on changes.
  const typingState = useChatStore((s) => s.typing)
  const users = useChatStore((s) => s.users)
  const entries = useMemo(() => {
    const key = `${channelId}:${rootId || ''}`
    const now = Date.now()
    return (typingState[key] ?? []).filter((e) => now - e.at < 4000 && e.userId !== authUserId)
  }, [typingState, channelId, rootId, authUserId])

  // Lazily load profiles for anyone typing (mirrors the webapp's fillInMissingInfo).
  const userIds = useMemo(() => entries.map((e) => e.userId), [entries])
  useUsers(userIds)

  const names = useMemo(() => entries.map((e) => displayUsername(users[e.userId])), [entries, users])

  if (names.length === 0) return null

  const text =
    names.length === 1
      ? t('chat.typing.one', '{user} đang soạn tin nhắn…', { user: names[0] })
      : t('chat.typing.many', '{users} và {last} đang soạn tin nhắn…', {
          users: names.slice(0, -1).join(', '),
          last: names[names.length - 1],
        })

  return (
    <div className="px-4 pb-1 h-5 flex items-center">
      <span className="text-[11px] text-muted-foreground italic">{text}</span>
    </div>
  )
}
