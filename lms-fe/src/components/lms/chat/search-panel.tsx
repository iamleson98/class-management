'use client'

/**
 * Search panel — ports the vendored webapp's search flow:
 *   - calls Client4.searchPosts(teamId, terms, isOrSearch) on the team
 *   - renders hits with sender + channel + snippet, oldest-first for reading
 *   - clicking a hit calls onJump(post) so the parent can open its channel
 */

import { useState, useMemo } from 'react'
import { Search, X, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar } from '@/components/lms/shared/avatar'
import { useSearchPosts, useUsers } from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { userDisplayName, type ChatPost } from '@/lib/chat/types'
import { format } from 'date-fns'
import { useTranslation } from '@/lib/i18n'

interface SearchPanelProps {
  teamId: string | undefined
  onJump: (post: ChatPost) => void
  onClose: () => void
}

export function SearchPanel({ teamId, onJump, onClose }: SearchPanelProps) {
  const { t } = useTranslation()
  const [terms, setTerms] = useState('')
  const search = useSearchPosts(teamId)
  const users = useChatStore((s) => s.users)
  const channels = useChatStore((s) => s.channels)

  const authorIds = useMemo(() => Array.from(new Set((search.data ?? []).map((p) => p.user_id))), [search.data])
  useUsers(authorIds)

  const results = useMemo(() => (search.data ?? []).slice().sort((a, b) => a.create_at - b.create_at), [search.data])

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="h-12 flex items-center gap-2 px-3 border-b shrink-0">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{t('chat.searchTitle', 'Tìm kiếm tin nhắn')}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-3 border-b">
        <form
          onSubmit={(e) => { e.preventDefault(); if (terms.trim()) search.mutate(terms) }}
          className="flex gap-2"
        >
          <Input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={t('chat.searchPlaceholder', 'Nhập từ khóa…')} className="h-8 text-sm" autoFocus />
          <Button type="submit" size="sm" disabled={search.isPending || !terms.trim()}>
            {search.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-1">
          {search.isPending && results.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">{t('chat.searching', 'Đang tìm…')}</div>
          ) : search.data && results.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">{t('chat.noResults', 'Không tìm thấy kết quả')}</div>
          ) : !search.data ? (
            <div className="text-center py-8 text-sm text-muted-foreground flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              {t('chat.searchHint', 'Tìm trong tất cả tin nhắn của bạn')}
            </div>
          ) : (
            results.map((post) => {
              const author = users[post.user_id]
              const channel = channels[post.channel_id]
              return (
                <button
                  key={post.id}
                  onClick={() => onJump(post)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-muted/60 transition-colors border border-transparent hover:border-border"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar name={userDisplayName(author)} size="xs" />
                    <span className="text-xs font-semibold truncate">{userDisplayName(author)}</span>
                    <span className="text-[10px] text-muted-foreground/70">{format(new Date(post.create_at), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                  <p className="text-sm line-clamp-2 whitespace-pre-wrap break-words">{post.message}</p>
                  {channel && (
                    <div className="mt-1 text-[10px] text-muted-foreground/70 truncate">#{channel.display_name}</div>
                  )}
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
