'use client'

/**
 * Channel bookmarks bar — ports the vendored channel_bookmarks component.
 * Renders below the channel header; shows link/file bookmarks sorted by
 * sort_order, with create (link or file), edit, and delete via a per-bookmark
 * dot menu. Mutations carry the Connection-Id header (the current WS connection
 * id from the store).
 */

import { useState } from 'react'
import { Bookmark, Plus, X, Link2, ExternalLink, MoreVertical, Pencil, Paperclip, File as FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  useChannelBookmarks, useCreateBookmark, useDeleteBookmark, useUpdateBookmark, useUploadFile, useConnectionId,
} from '@/lib/chat/hooks'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'
import type { ChatBookmark } from '@/lib/chat/store'

interface ChannelBookmarksProps {
  channelId: string
}

export function ChannelBookmarks({ channelId }: ChannelBookmarksProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const bookmarksQuery = useChannelBookmarks(channelId)
  const createBookmark = useCreateBookmark()
  const deleteBookmark = useDeleteBookmark()
  const updateBookmark = useUpdateBookmark()
  const uploadFile = useUploadFile()
  const connectionId = useConnectionId()
  const [adding, setAdding] = useState(false)
  const [editTarget, setEditTarget] = useState<ChatBookmark | null>(null)
  // Create form state.
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [emoji, setEmoji] = useState('')
  const [type, setType] = useState<'link' | 'file'>('link')
  const [uploading, setUploading] = useState(false)
  const [fileInfo, setFileInfo] = useState<{ id: string; name: string } | null>(null)

  const bookmarks = bookmarksQuery.data ?? []

  const resetForm = () => { setName(''); setUrl(''); setEmoji(''); setType('link'); setFileInfo(null) }

  const add = async () => {
    if (!connectionId) return
    if (type === 'link' && (!name.trim() || !url.trim())) return
    if (type === 'file' && !fileInfo) return
    try {
      if (type === 'link') {
        await createBookmark.mutateAsync({
          channelId,
          bookmark: { type: 'link', display_name: name.trim(), link_url: url.trim(), emoji: emoji || undefined } as never,
          connectionId,
        })
      } else if (fileInfo) {
        await createBookmark.mutateAsync({
          channelId,
          bookmark: { type: 'file', display_name: name.trim() || fileInfo.name, file_id: fileInfo.id, emoji: emoji || undefined } as never,
          connectionId,
        })
      }
      resetForm()
      setAdding(false)
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.bookmarkAddFailed', 'Không thể thêm liên kết'), variant: 'destructive' })
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const infos = await uploadFile.mutateAsync({ channelId, file })
      if (infos[0]) setFileInfo({ id: infos[0].id, name: infos[0].name })
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.uploadFailed', 'Tải file thất bại'), variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  if (bookmarks.length === 0 && !adding) return null

  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 border-b bg-muted/20 overflow-x-auto">
      <Bookmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {bookmarks.map((bm) => (
        <BookmarkChip
          key={bm.id}
          bookmark={bm}
          onEdit={() => setEditTarget(bm)}
          onDelete={() => connectionId && deleteBookmark.mutate({ channelId, bookmarkId: bm.id, connectionId })}
        />
      ))}
      <Popover open={adding} onOpenChange={(o) => { setAdding(o); if (!o) resetForm() }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0">
            <Plus className="h-3.5 w-3.5 mr-1" /> {t('chat.addBookmark', 'Thêm')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <BookmarkForm
            type={type} setType={setType} name={name} setName={setName} url={url} setUrl={setUrl}
            emoji={emoji} setEmoji={setEmoji} fileInfo={fileInfo} uploading={uploading}
            onUpload={handleUpload} onSubmit={add} onCancel={() => { setAdding(false); resetForm() }}
            submitLabel={t('common.save', 'Lưu')}
          />
        </PopoverContent>
      </Popover>

      {/* Edit popover */}
      <Popover open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <PopoverContent align="start" className="w-72 p-3">
          {editTarget && (
            <BookmarkForm
              type={editTarget.type === 'file' ? 'file' : 'link'}
              setType={() => {}}
              name={editTarget.display_name}
              setName={(v) => setEditTarget({ ...editTarget, display_name: v })}
              url={editTarget.link_url ?? ''}
              setUrl={(v) => setEditTarget({ ...editTarget, link_url: v })}
              emoji={editTarget.emoji ?? ''}
              setEmoji={(v) => setEditTarget({ ...editTarget, emoji: v })}
              fileInfo={editTarget.file_id ? { id: editTarget.file_id, name: editTarget.display_name } : null}
              uploading={false}
              onUpload={() => {}}
              readOnlyType
              onSubmit={async () => {
                if (!connectionId) return
                try {
                  await updateBookmark.mutateAsync({
                    channelId, bookmarkId: editTarget.id,
                    patch: {
                      display_name: editTarget.display_name,
                      link_url: editTarget.link_url,
                      emoji: editTarget.emoji,
                    } as never,
                    connectionId,
                  })
                  setEditTarget(null)
                } catch (err: unknown) {
                  toast({ title: (err as Error)?.message || t('chat.bookmarkEditFailed', 'Sửa thất bại'), variant: 'destructive' })
                }
              }}
              onCancel={() => setEditTarget(null)}
              submitLabel={t('common.save', 'Lưu')}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** A single bookmark chip with link/file rendering + a dot menu (edit/delete). */
function BookmarkChip({ bookmark: bm, onEdit, onDelete }: { bookmark: ChatBookmark; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="group relative flex items-center gap-1.5 rounded-md bg-background border px-2 py-1 text-xs shrink-0">
      {bm.link_url ? (
        <a href={bm.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary">
          {bm.emoji ? <span>{bm.emoji}</span> : <Link2 className="h-3 w-3 text-muted-foreground" />}
          <span className="max-w-32 truncate">{bm.display_name}</span>
          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/60" />
        </a>
      ) : bm.file_id ? (
        <a href={`/api/v4/files/${bm.file_id}?download=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary">
          {bm.emoji ? <span>{bm.emoji}</span> : <FileIcon className="h-3 w-3 text-muted-foreground" />}
          <span className="max-w-32 truncate">{bm.display_name}</span>
        </a>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <span>{bm.emoji}</span>
          <span className="max-w-32 truncate">{bm.display_name}</span>
        </span>
      )}
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" aria-label={t('chat.bookmarkOptions', 'Tùy chọn')}>
            <MoreVertical className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-40 p-1">
          <button onClick={() => { onEdit(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm hover:bg-muted text-left">
            <Pencil className="h-3.5 w-3.5" /> {t('common.edit', 'Sửa')}
          </button>
          <button onClick={() => { onDelete(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm hover:bg-destructive/10 text-destructive text-left">
            <X className="h-3.5 w-3.5" /> {t('common.delete', 'Xóa')}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** Shared form for create + edit. */
function BookmarkForm(props: {
  type: 'link' | 'file'
  setType: (t: 'link' | 'file') => void
  name: string
  setName: (v: string) => void
  url: string
  setUrl: (v: string) => void
  emoji: string
  setEmoji: (v: string) => void
  fileInfo: { id: string; name: string } | null
  uploading: boolean
  onUpload: (f: File) => void
  readOnlyType?: boolean
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
}) {
  const { t } = useTranslation()
  const { type, setType, name, setName, url, setUrl, emoji, setEmoji, fileInfo, uploading, onUpload, readOnlyType, onSubmit, onCancel, submitLabel } = props
  return (
    <div className="space-y-2.5">
      {!readOnlyType && (
        <div className="flex gap-1">
          <button type="button" onClick={() => setType('link')} className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${type === 'link' ? 'bg-muted' : 'hover:bg-muted/60'}`}>
            <Link2 className="inline h-3 w-3 mr-1" />{t('chat.bookmarkLink', 'Liên kết')}
          </button>
          <button type="button" onClick={() => setType('file')} className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${type === 'file' ? 'bg-muted' : 'hover:bg-muted/60'}`}>
            <Paperclip className="inline h-3 w-3 mr-1" />{t('chat.bookmarkFile', 'Tệp')}
          </button>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">{t('chat.bookmarkName', 'Tên')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
      </div>
      {type === 'link' && (
        <div className="space-y-1">
          <Label className="text-xs">URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className="h-8 text-sm" />
        </div>
      )}
      {type === 'file' && (
        <div className="space-y-1">
          <Label className="text-xs">{t('chat.bookmarkFile', 'Tệp')}</Label>
          {fileInfo ? (
            <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
              <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate flex-1">{fileInfo.name}</span>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 rounded-md border border-dashed px-2 py-3 text-xs text-muted-foreground cursor-pointer hover:bg-muted/40">
              <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} disabled={uploading} />
              <Paperclip className="h-3.5 w-3.5" />
              {uploading ? t('chat.uploading', 'Đang tải…') : t('chat.chooseFile', 'Chọn tệp')}
            </label>
          )}
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">{t('chat.bookmarkEmoji', 'Biểu tượng (tùy chọn)')}</Label>
        <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="📌" className="h-8 text-sm" maxLength={64} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel}>{t('common.cancel', 'Hủy')}</Button>
        <Button size="sm" onClick={onSubmit} disabled={type === 'link' ? !name.trim() : !fileInfo}>{submitLabel}</Button>
      </div>
    </div>
  )
}
