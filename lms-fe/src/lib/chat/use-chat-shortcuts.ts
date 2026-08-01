'use client'

/**
 * Global chat keyboard shortcuts — binds the combos the vendored webapp binds
 * on window: Ctrl+/ (shortcuts help), Ctrl+K (quick switcher), Ctrl+Shift+M
 * (recent mentions), Ctrl+. (toggle RHS), Ctrl+Shift+L (focus composer),
 * Shift+Esc (mark all read). The handler invokes callbacks the chat shell
 * provides, so the shell decides what each shortcut does.
 */

import { useEffect } from 'react'
import { cmdOrCtrlPressed, isKeyPressed } from '@/components/lms/chat/keyboard-shortcuts-modal'

const KEY_CODES = {
  FORWARD_SLASH: ['/', 191] as [string, number],
  K: ['k', 75] as [string, number],
  M: ['m', 77] as [string, number],
  A: ['a', 65] as [string, number],
  PERIOD: ['.', 190] as [string, number],
  L: ['l', 76] as [string, number],
  ESCAPE: ['Escape', 27] as [string, number],
  U: ['u', 85] as [string, number],
  I: ['i', 73] as [string, number],
}

export interface ShortcutHandlers {
  onToggleShortcuts?: () => void
  onQuickSwitcher?: () => void
  onToggleMentions?: () => void
  onToggleRhs?: () => void
  onFocusComposer?: () => void
  onMarkAllRead?: () => void
  onToggleUnreads?: () => void
  onChannelInfo?: () => void
  onOpenSettings?: () => void
}

/** Bind chat keyboard shortcuts for the lifetime of the chat view. */
export function useChatShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      // Ctrl/Cmd combos.
      if (cmdOrCtrlPressed(e, true)) {
        if (isKeyPressed(e, KEY_CODES.FORWARD_SLASH)) {
          e.preventDefault()
          handlers.onToggleShortcuts?.()
          return
        }
        if (!e.shiftKey && isKeyPressed(e, KEY_CODES.K) && !e.altKey) {
          if (!isTyping) {
            e.preventDefault()
            handlers.onQuickSwitcher?.()
          }
          return
        }
        if (e.shiftKey && isKeyPressed(e, KEY_CODES.M)) {
          e.preventDefault()
          handlers.onToggleMentions?.()
          return
        }
        if (e.shiftKey && isKeyPressed(e, KEY_CODES.A)) {
          e.preventDefault()
          handlers.onOpenSettings?.()
          return
        }
        if (e.shiftKey && isKeyPressed(e, KEY_CODES.L)) {
          e.preventDefault()
          handlers.onFocusComposer?.()
          return
        }
        if (isKeyPressed(e, KEY_CODES.PERIOD)) {
          e.preventDefault()
          handlers.onToggleRhs?.()
          return
        }
        if (e.shiftKey && isKeyPressed(e, KEY_CODES.U)) {
          e.preventDefault()
          handlers.onToggleUnreads?.()
          return
        }
        const channelInfoCombo = (typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)) ? e.shiftKey : e.altKey
        if (isKeyPressed(e, KEY_CODES.I) && channelInfoCombo) {
          e.preventDefault()
          handlers.onChannelInfo?.()
          return
        }
      }

      // Shift+Esc → mark all read (non-typing only).
      if (e.shiftKey && isKeyPressed(e, KEY_CODES.ESCAPE) && !isTyping) {
        e.preventDefault()
        handlers.onMarkAllRead?.()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}
