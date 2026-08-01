'use client'

/**
 * Channel bookmarks bar — ports the vendored channel_bookmarks component.
 * Renders below the channel header; shows link/file bookmarks sorted by
 * sort_order, with add (via popover) and delete. Mutations carry the
 * Connection-Id header (the current WS connection id from the store).
 */

import { useState } from 'react'
import { Bookmark, Plus, X, Link2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useChannelBookmarks, useCreateBookmark, useDeleteBookmark, useConnectionId } from '@/lib/chat/hooks'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'

interface ChannelBookmarksProps {
  channelId: string
}

export function ChannelBookmarks({ channelId }: ChannelBookmarksProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const bookmarksQuery = useChannelBookmarks(channelId)
  const createBookmark = useCreateBookmark()
  const deleteBookmark = useDeleteBookmark()
  const connectionId = useConnectionId()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  const bookmarks = bookmarksQuery.data ?? []

  const add = async () => {
    if (!name.trim() || !url.trim() || !connectionId) return
    try {
      await createBookmark.mutateAsync({
        channelId,
        bookmark: { type: 'link', display_name: name.trim(), link_url: url.trim() } as never,
        connectionId,
      })
      setName('')
      setUrl('')
      setAdding(false)
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.bookmarkAddFailed', 'Không thể thêm liên kết'), variant: 'destructive' })
    }
  }

  if (bookmarks.length === 0 && !adding) return null

  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 border-b bg-muted/20 overflow-x-auto">
      <Bookmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {bookmarks.map((bm) => (
        <div key={bm.id} className="group relative flex items-center gap-1.5 rounded-md bg-background border px-2 py-1 text-xs shrink-0">
          {bm.link_url ? (
            <a href={bm.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-sky-600">
              {bm.emoji ? <span>{bm.emoji}</span> : <Link2 className="h-3 w-3 text-muted-foreground" />}
              <span className="max-w-32 truncate">{bm.display_name}</span>
              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/60" />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span>{bm.emoji}</span>
              <span className="max-w-32 truncate">{bm.display_name}</span>
            </span>
          )}
          <button
            onClick={() => connectionId && deleteBookmark.mutate({ channelId, bookmarkId: bm.id, connectionId })}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <Popover open={adding} onOpenChange={setAdding}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0">
            <Plus className="h-3.5 w-3.5 mr-1" /> {t('chat.addBookmark', 'Thêm liên kết')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label className="text-xs">{t('chat.bookmarkName', 'Tên')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('chat.bookmarkUrl', 'URL')}</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className="h-8 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>{t('common.cancel', 'Hủy')}</Button>
              <Button size="sm" onClick={add} disabled={!name.trim() || !url.trim() || !connectionId}>{t('common.save', 'Lưu')}</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
