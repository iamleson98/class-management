'use client'

/**
 * Presence sync — pushes the current user's active/away status to the server on
 * window focus/blur (ports the vendored logged_in.tsx focus listeners +
 * WebSocketClient.userUpdateActiveStatus).
 *
 *   - On window focus → push 'online' (unless a manual status is set).
 *   - On window blur → after a short idle threshold → push 'away'.
 *
 * Manual statuses (DND, custom "on vacation", etc.) are never overridden: we
 * read the current user's stored status and skip the push if it's manually set
 * to anything other than online/away/offline (the auto-managed set).
 *
 * The server also runs its own idle timeout, so this is best-effort + faster
 * than relying solely on the server.
 */

import { useEffect } from 'react'
import { wsClient } from './client'
import { useChatStore } from './store'
import { useLMSStore } from '@/store/lms-store'

const AWAY_DELAY_MS = 60_000 // push 'away' 60s after blur (mirrors typical idle)

/** Statuses that are "auto-managed" and OK to override via focus/blur. */
const AUTO_MANAGED = new Set(['online', 'away', 'offline'])

export function usePresenceSync(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let blurTimer: ReturnType<typeof setTimeout> | null = null

    const currentUserStatus = (): string | undefined => {
      const uid = useLMSStore.getState().authUser?.id
      if (!uid) return undefined
      return useChatStore.getState().statuses[uid]
    }

    const pushActive = (active: boolean) => {
      const status = currentUserStatus()
      // Don't override a manual (non-auto-managed) status like DND.
      if (status && !AUTO_MANAGED.has(status)) return
      try {
        wsClient.userUpdateActiveStatus(active, false)
      } catch {
        // ignore — non-critical
      }
    }

    const onFocus = () => {
      if (blurTimer) { clearTimeout(blurTimer); blurTimer = null }
      pushActive(true)
    }

    const onBlur = () => {
      if (blurTimer) clearTimeout(blurTimer)
      blurTimer = setTimeout(() => pushActive(false), AWAY_DELAY_MS)
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    // Push online on mount (the user just opened chat).
    pushActive(true)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      if (blurTimer) clearTimeout(blurTimer)
    }
  }, [])
}
