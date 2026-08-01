'use client'

/**
 * Forward post modal — ports the vendored forward_post_modal. Picks a target
 * channel (and optional comment) and posts a new message containing the comment
 * + a permalink to the original post. The forwarded message carries a permalink
 * embed so the receiver sees a preview of the source.
 */

import { useState, useEffect } from 'react'
import { X, Search, Forward, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar } from '@/components/lms/shared/avatar'
import { client4 } from '@/lib/chat/client'
import { useChatStore } from '@/lib/chat/store'
import { useSendPost } from '@/lib/chat/hooks'
import { displayUsername } from '@/lib/chat/utils'
import type { ChatChannel, ChatPost, ChatUser } from '@/lib/chat/types'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'

interface ForwardModalProps {
  post: ChatPost
  teamId?: string
  onClose: () => void
}

export function ForwardModal({ post, teamId, onClose }: ForwardModalProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ChatChannel[]>([])
  const [selected, setSelected] = useState<ChatChannel | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const sendPost = useSendPost()
  const users = useChatStore((s) => s.users)

  // Search channels (local first, then remote autocomplete).
  useEffect(() => {
    const local = Object.values(useChatStore.getState().channels).filter((c) => c.delete_at === 0)
    if (!query.trim()) {
      setResults(local.sort((a, b) => (b.last_post_at || 0) - (a.last_post_at || 0)).slice(0, 15))
      return
    }
    const q = query.toLowerCase()
    const localMatches = local.filter((c) => c.display_name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)).slice(0, 15)
    setResults(localMatches)
    if (teamId && localMatches.length < 5) {
      const timer = setTimeout(async () => {
        try {
          const remote = await client4.autocompleteChannels(teamId, query.trim())
          setResults((prev) => [...prev, ...(remote as unknown as ChatChannel[])].slice(0, 15))
        } catch { /* ignore */ }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [query, teamId])

  const forward = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const permalink = `${window.location.origin}/pl/${post.id}`
      const message = comment.trim() ? `${comment.trim()}\n${permalink}` : permalink
      await sendPost.mutateAsync({ channelId: selected.id, message })
      toast({ title: t('chat.forwarded', 'Đã chuyển tiếp') })
      onClose()
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.forwardFailed', 'Chuyển tiếp thất bại'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const author = users[post.user_id] as ChatUser | undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[80vh] rounded-xl border bg-background shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 flex items-center gap-2 px-4 border-b shrink-0">
          <Forward className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{t('chat.forwardTitle', 'Chuyển tiếp tin nhắn')}</span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {/* Original message preview */}
        <div className="p-3 border-b">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <Avatar name={displayUsername(author)} size="xs" />
              <span className="text-xs font-semibold">{displayUsername(author)}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{post.message}</p>
          </div>
        </div>

        {/* Channel picker */}
        <div className="p-3 border-b">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('chat.searchChannel', 'Tìm kênh…')} className="h-9 pl-8 text-sm" />
          </div>
          {selected ? (
            <div className="flex items-center gap-2 rounded-md bg-sky-50 dark:bg-sky-950/30 px-2.5 py-1.5">
              <span className="text-sm font-medium flex-1 truncate">#{selected.display_name}</span>
              <Button variant="ghost" size="sm" className="h-6" onClick={() => setSelected(null)}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <ScrollArea className="h-40">
              <div className="space-y-0.5">
                {results.map((ch) => (
                  <button key={ch.id} onClick={() => setSelected(ch)} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-left hover:bg-muted/60">
                    {ch.type === 'P' ? '🔒' : '#'} <span className="truncate">{ch.display_name}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Optional comment */}
        <div className="p-3 border-b">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('chat.forwardComment', 'Thêm ghi chú (tùy chọn)…')} rows={2} className="text-sm" />
        </div>

        <div className="p-3">
          <Button onClick={forward} disabled={!selected || loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {t('chat.forward', 'Chuyển tiếp')}
          </Button>
        </div>
      </div>
    </div>
  )
}
