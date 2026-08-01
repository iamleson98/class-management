/**
 * Persistent drafts — ports the vendored webapp's local draft storage
 * (actions/views/drafts.ts → setGlobalItem → localStorage). Drafts are keyed
 * per channel (`draft_{channelId}`) and per thread root (`comment_draft_{rootId}`),
 * matching the webapp's StoragePrefixes so behavior is identical.
 *
 * Server-synced drafts (Client4.upsertDraft) are available on the server but
 * gated behind a config flag; this implementation mirrors the default local
 * storage path which is what most deployments use.
 */

const DRAFT_PREFIX = 'draft_'
const COMMENT_DRAFT_PREFIX = 'comment_draft_'

function key(channelId: string, rootId?: string | null): string {
  return rootId ? COMMENT_DRAFT_PREFIX + rootId : DRAFT_PREFIX + channelId
}

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export interface DraftData {
  message: string
  fileIds: string[]
  updatedAt: number
}

export function loadDraft(channelId: string, rootId?: string | null): DraftData | null {
  const storage = safeStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(key(channelId, rootId))
    if (!raw) return null
    return JSON.parse(raw) as DraftData
  } catch {
    return null
  }
}

export function saveDraft(channelId: string, rootId: string | null | undefined, data: DraftData): void {
  const storage = safeStorage()
  if (!storage) return
  try {
    storage.setItem(key(channelId, rootId), JSON.stringify(data))
  } catch {
    // ignore quota errors
  }
}

export function clearDraft(channelId: string, rootId?: string | null): void {
  const storage = safeStorage()
  if (!storage) return
  try {
    storage.removeItem(key(channelId, rootId))
  } catch {
    // ignore
  }
}

/** React hook that binds a draft to a channel/thread, persisting on change. */
import { useEffect, useRef, useState } from 'react'

export function useDraft(channelId: string, rootId?: string | null) {
  const [message, setMessage] = useState(() => loadDraft(channelId, rootId)?.message ?? '')
  const [fileIds, setFileIds] = useState<string[]>(() => loadDraft(channelId, rootId)?.fileIds ?? [])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reload when the channel/thread changes.
  useEffect(() => {
    const d = loadDraft(channelId, rootId)
    setMessage(d?.message ?? '')
    setFileIds(d?.fileIds ?? [])
  }, [channelId, rootId])

  // Persist (debounced) on change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (message.trim() || fileIds.length > 0) {
        saveDraft(channelId, rootId, { message, fileIds, updatedAt: Date.now() })
      } else {
        clearDraft(channelId, rootId)
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [message, fileIds, channelId, rootId])

  return { message, setMessage, fileIds, setFileIds, clear: () => { setMessage(''); setFileIds([]); clearDraft(channelId, rootId) } }
}
