'use client'

/**
 * File attachments — ports the vendored webapp's file rendering into shadcn/ui:
 *   - images render inline as thumbnails (single → full-width; multiple → grid)
 *     and open a lightbox on click (file_attachment_list, single_image_view,
 *     FilePreviewModal)
 *   - non-image files render as cards with icon + name + size + download link
 *     (file_attachment / FileThumbnail)
 *
 * File metadata comes from `post.metadata.files` (the server populates it on
 * posts fetched via getPostsUnread/getPostsBefore). When metadata is absent we
 * fall back to the bare `file_ids`, deriving image-vs-file by extension.
 */

import { useState, useCallback, memo } from 'react'
import { Download, File as FileIcon, FileImage, FileText, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { client4 } from '@/lib/chat/client'
import type { ChatFileInfo, ChatPost } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface FileAttachmentsProps {
  post: ChatPost
  isOwn: boolean
}

const IMAGE_MIME_PREFIX = 'image/'
const IMG_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'])

function isImageFile(file: ChatFileInfo): boolean {
  return (
    file.mime_type?.startsWith(IMAGE_MIME_PREFIX) ||
    IMG_EXTS.has(file.extension?.toLowerCase()) ||
    // has_preview_image is set for any file the server generated a preview for
    // (which for non-images is an icon, so only treat as image if also image-ish).
    (file.has_preview_image && (file.width > 0 || file.height > 0))
  )
}

/** Human-readable file size (ports fileSizeToString). */
function formatSize(bytes: number): string {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

/** A type→icon map for non-image file cards. */
function fileIcon(ext: string) {
  const e = (ext ?? '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(e)) return <FileImage className="h-4 w-4" />
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'].includes(e)) return <FileText className="h-4 w-4" />
  return <FileIcon className="h-4 w-4" />
}

/** Resolve the FileInfos for a post: prefer metadata.files, else synthesize from file_ids. */
function resolveFiles(post: ChatPost, fallbackName: string): ChatFileInfo[] {
  const meta = (post.metadata ?? {}) as { files?: ChatFileInfo[] }
  if (meta.files && meta.files.length > 0) return meta.files
  const ids = post.file_ids ?? []
  return ids.map((id) => ({
    id,
    name: fallbackName,
    extension: '',
    size: 0,
    mime_type: '',
    width: 0,
    height: 0,
    has_preview_image: false,
  } as unknown as ChatFileInfo))
}

export const FileAttachments = memo(function FileAttachments({ post, isOwn }: FileAttachmentsProps) {
  const { t } = useTranslation()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const files = resolveFiles(post, t('chat.attachment', 'Tệp đính kèm'))
  // Sort: images first (ports sortFileInfos).
  const images = files.filter(isImageFile)
  const others = files.filter((f) => !images.includes(f))

  const openLightbox = useCallback((idx: number) => setLightboxIndex(idx), [])
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  const nextImage = useCallback(() => setLightboxIndex((i) => (i === null ? null : (i + 1) % images.length)), [images.length])
  const prevImage = useCallback(() => setLightboxIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length)), [images.length])

  if (files.length === 0) return null

  return (
    <>
      <div className="flex flex-col gap-1.5 pt-1">
        {images.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 ${images.length === 1 ? '' : ''}`}>
            {images.map((file, i) => (
              <button
                key={file.id}
                onClick={() => openLightbox(i)}
                className="block overflow-hidden rounded-lg border border-black/10 dark:border-white/10 hover:opacity-90 transition-opacity"
                title={file.name}
              >
                <img
                  src={client4.getFileUrl(file.id, Date.now())}
                  alt={file.name}
                  loading="lazy"
                  className={images.length === 1 ? 'max-h-72 max-w-full object-cover rounded-lg' : 'h-28 w-28 object-cover'}
                />
              </button>
            ))}
          </div>
        )}
        {others.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {others.map((file) => (
              <a
                key={file.id}
                href={`${client4.getFileUrl(file.id, Date.now())}?download=1`}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  isOwn ? 'bg-sky-700/40 hover:bg-sky-700/60 border-sky-500/30' : 'bg-background hover:bg-muted/60 border-border'
                }`}
              >
                <span className="text-muted-foreground">{fileIcon(file.extension)}</span>
                <span className="min-w-0">
                  <span className="block truncate max-w-40 font-medium">{file.name}</span>
                  {file.size > 0 && <span className="block text-[10px] text-muted-foreground">{formatSize(file.size)}</span>}
                </span>
                <Download className="h-3 w-3 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox (ports FilePreviewModal). */}
      {lightboxIndex !== null && images.length > 0 && (
        <Dialog open onOpenChange={(o) => { if (!o) closeLightbox() }}>
          <DialogContent className="max-w-4xl border-0 bg-black/90 p-0 overflow-hidden [&>button]:hidden">
            <DialogTitle className="sr-only">{images[lightboxIndex].name}</DialogTitle>
            <div className="relative flex items-center justify-center h-[80vh]">
              <img
                src={client4.getFileUrl(images[lightboxIndex].id, Date.now())}
                alt={images[lightboxIndex].name}
                className="max-h-full max-w-full object-contain"
              />
              {/* Close */}
              <Button
                variant="ghost" size="icon"
                className="absolute top-2 right-2 h-8 w-8 text-white hover:bg-white/10"
                onClick={closeLightbox}
              >
                <X className="h-5 w-5" />
              </Button>
              {/* Prev / next (only when multiple). */}
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost" size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 text-white hover:bg-white/10"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 text-white hover:bg-white/10"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                    {lightboxIndex + 1} / {images.length}
                  </div>
                </>
              )}
              {/* Download */}
              <a
                href={`${client4.getFileUrl(images[lightboxIndex].id, Date.now())}?download=1`}
                target="_blank" rel="noreferrer"
                className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white hover:bg-white/20"
              >
                <Download className="h-3.5 w-3.5" /> {t('common.download', 'Tải xuống')}
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
})
