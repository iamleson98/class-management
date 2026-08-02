'use client'

/**
 * Document-title unread counter — ports the vendored webapp's behavior of
 * prefixing the unread/mention count to the tab title: `(3) Title`.
 *
 * Reads the live unread + mention counts from the store and updates
 * document.title whenever they change. The base title is captured on first run
 * so subsequent updates restore it when counts return to zero.
 */

import { useEffect, useRef } from 'react'
import { useChatStore } from './store'

export function useDocumentTitle(): void {
  const baseTitle = useRef<string>('')

  // Capture the page's title once (before we start mutating it).
  useEffect(() => {
    if (typeof document !== 'undefined' && !baseTitle.current) {
      baseTitle.current = document.title
    }
  }, [])

  // Subscribe to the unread + mention totals.
  const unreadByChannel = useChatStore((s) => s.unreadByChannel)
  const mentionByChannel = useChatStore((s) => s.mentionByChannel)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const base = baseTitle.current || document.title.replace(/^\(\d+\)\s*/, '')
    const totalMentions = Object.values(mentionByChannel).reduce((a, b) => a + b, 0)
    const totalUnread = Object.values(unreadByChannel).reduce((a, b) => a + b, 0)
    // Mentions take precedence (bold badge); fall back to unread count.
    const count = totalMentions || totalUnread
    if (count > 0) {
      document.title = `(${count > 99 ? '99+' : count}) ${base}`
    } else {
      document.title = base
    }
  }, [unreadByChannel, mentionByChannel])
}
