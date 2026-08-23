'use client'

/**
 * Quick channel switcher (Ctrl+K) — ports the vendored quick_switch_modal.
 * Fuzzy-filters the channels the user can see and jumps to the selected one.
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, X, Hash, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/lib/chat/store'
import { client4 } from '@/lib/chat/client'
import type { ChatChannel } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'

interface QuickSwitcherProps {
  teamId?: string
  onSelect: (channel: ChatChannel) => void
  onClose: () => void
}

export function QuickSwitcher({ teamId, onSelect, onClose }: QuickSwitcherProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [remote, setRemote] = useState<ChatChannel[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const channels = useChatStore((s) => s.channels)

  useEffect(() => { inputRef.current?.focus() }, [])

  const matches = useMemo(() => {
    const all = Object.values(channels).filter((c) => c.delete_at === 0)
    if (!query.trim()) return all.sort((a, b) => (b.last_post_at || 0) - (a.last_post_at || 0)).slice(0, 20)
    const q = query.toLowerCase()
    return all
      .filter((c) => c.display_name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.display_name.toLowerCase().startsWith(q)) - Number(a.display_name.toLowerCase().startsWith(q)))
      .slice(0, 20)
  }, [channels, query])

  // Fetch remote autocomplete when local matches are thin.
  useEffect(() => {
    if (!teamId || !query.trim() || matches.length >= 5) {
      setRemote([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await client4.autocompleteChannels(teamId, query.trim())
        if (!cancelled) setRemote(res as unknown as ChatChannel[])
      } catch {
        if (!cancelled) setRemote([])
      }
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, teamId, matches.length])

  const list = matches.length > 0 ? matches : remote

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => (i + 1) % list.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => (i - 1 + list.length) % list.length) }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[index]) onSelect(list[index]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-popover shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setIndex(0) }} onKeyDown={onKeyDown} placeholder={t('chat.findChannel', 'Tìm kênh…')} className="border-0 focus-visible:ring-0 text-sm" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <ScrollArea className="max-h-72">
          <div className="p-1">
            {list.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{t('chat.noChannels', 'Không tìm thấy kênh')}</div>
            ) : (
              list.map((ch, i) => (
                <button
                  key={ch.id}
                  onClick={() => onSelect(ch)}
                  onMouseEnter={() => setIndex(i)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors ${i === index ? 'bg-muted' : 'hover:bg-muted/60'}`}
                >
                  {ch.type === 'P' ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Hash className="h-4 w-4 text-muted-foreground" />}
                  <span className="truncate flex-1">{ch.display_name}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
