'use client'

/**
 * Direct-message creation modal — ports the vendored more_direct_channels.tsx.
 * Search users in the team (autocompleteUsers), pick one (DM) or many (GM),
 * then open (creating if needed) the channel via createDirect/createGroupChannel.
 */

import { useState, useEffect } from 'react'
import { X, Search, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar } from '@/components/shared/avatar'
import { client4 } from '@/lib/chat/client'
import { useOpenDirectChannel, useCreateGroupChannel } from '@/lib/chat/hooks'
import { displayUsername } from '@/lib/chat/utils'
import type { ChatUser } from '@/lib/chat/types'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'

interface DmModalProps {
  teamId?: string
  currentUserId?: string
  onOpen: (channelId: string) => void
  onClose: () => void
}

export function DmModal({ teamId, currentUserId, onOpen, onClose }: DmModalProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ChatUser[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const openDm = useOpenDirectChannel()
  const createGroup = useCreateGroupChannel()

  useEffect(() => {
    if (!teamId || query.trim().length < 1) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await client4.autocompleteUsers(query.trim(), teamId, '', { limit: 20 })
        if (!cancelled) setResults((res.users ?? []).filter((u) => u.id !== currentUserId) as ChatUser[])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, teamId, currentUserId])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const start = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    try {
      if (ids.length === 1) {
        const ch = await openDm.mutateAsync(ids[0])
        onOpen(ch.id)
      } else {
        const ch = await createGroup.mutateAsync(ids)
        onOpen(ch.id)
      }
      onClose()
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.dmFailed', 'Không thể mở tin nhắn'), variant: 'destructive' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[80vh] rounded-xl border bg-background shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 flex items-center gap-2 px-4 border-b shrink-0">
          <span className="font-medium text-sm">{t('chat.newMessage', 'Tin nhắn mới')}</span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('chat.searchPeople', 'Tìm người…')} className="h-9 pl-8 text-sm" autoFocus />
          </div>
          {selected.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {results.filter((u) => selected.has(u.id)).map((u) => (
                <button key={u.id} onClick={() => toggle(u.id)} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                  {displayUsername(u)} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>
        <ScrollArea className="flex-1 min-h-50">
          <div className="p-1">
            {loading && <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t('chat.loading', 'Đang tải…')}</div>}
            {!loading && query && results.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">{t('chat.noUsers', 'Không tìm thấy')}</div>}
            {!loading && results.map((u) => (
              <button key={u.id} onClick={() => toggle(u.id)} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-left transition-colors ${selected.has(u.id) ? 'bg-muted' : 'hover:bg-muted/60'}`}>
                <Avatar name={displayUsername(u)} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{displayUsername(u)}</div>
                  <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                </div>
                {selected.has(u.id) && <Check className="h-4 w-4 text-sky-500" />}
              </button>
            ))}
          </div>
        </ScrollArea>
        <div className="p-3 border-t">
          <Button onClick={start} disabled={selected.size === 0 || openDm.isPending || createGroup.isPending} className="w-full">
            {(openDm.isPending || createGroup.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {t('chat.sendMessage', 'Nhắn tin')}
          </Button>
        </div>
      </div>
    </div>
  )
}
