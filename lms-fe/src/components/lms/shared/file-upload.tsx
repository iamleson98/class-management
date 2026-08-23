'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileCheck, Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FileTypeIcon } from '@/components/lms/file-type-icon'

interface FileUploadProps {
  value: { fileName: string; fileType: string; fileId?: string; fileUrl?: string } | null
  onChange: (file: { fileName: string; fileType: string; fileId?: string; fileUrl?: string } | null) => void
  onUploadStart?: () => void
  onUploadEnd?: () => void
  accept?: string
  /** @deprecated Unused — uploads no longer use per-folder paths. */
  folder?: string
  className?: string
  label?: string
}

export function FileUpload({
  value,
  onChange,
  onUploadStart,
  onUploadEnd,
  accept = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.svg,.webp,.mp4,.mp3,.zip,.txt,.csv',
  folder = 'materials',
  className,
  label = 'Upload File',
}: FileUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setIsUploading(true)
    onUploadStart?.()

    try {
      const { uploadLmsFile } = await import('@/lib/file-upload')
      const result = await uploadLmsFile(file)
      onChange({
        fileName: result.fileName,
        fileType: result.fileType,
        fileId: result.fileId,
        fileUrl: result.fileUrl,
      })
    } catch (err: any) {
      setError(err.message || t('upload.failed', 'Tải lên thất bại'))
    } finally {
      setIsUploading(false)
      onUploadEnd?.()
    }
  }, [onChange, onUploadStart, onUploadEnd, t])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setError(null)
  }

  // Has a file selected/uploaded
  if (value?.fileName) {
    return (
      <div className={cn('rounded-xl border border-border bg-muted/20 p-4', className)}>
        <div className="flex items-center gap-3">
          <FileTypeIcon fileType={value.fileType} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{value.fileName}</p>
            {value.fileType && (
              <p className="text-xs text-muted-foreground">{value.fileType}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-500"
            onClick={clear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // Upload area
  return (
    <div className={cn('rounded-xl border border-dashed p-6 text-center transition-colors', className)} style={undefined}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex flex-col items-center gap-2 py-4 px-4 rounded-lg cursor-pointer transition-colors',
          isDragging && 'bg-sky-50 dark:bg-sky-950/20',
          !isDragging && 'hover:bg-muted/50'
        )}
      >
        {isUploading ? (
          <>
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">{t('upload.uploading', 'Đang tải lên...')}</p>
          </>
        ) : (
          <>
            <div className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center transition-colors',
              isDragging ? 'bg-sky-100 dark:bg-sky-900/30' : 'bg-muted'
            )}>
              {isDragging ? (
                <FileCheck className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {isDragging ? t('upload.dropHere', 'Thả file vào đây') : label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('upload.orBrowse', 'hoặc')} <span className="text-sky-600 dark:text-sky-400 font-medium">{t('upload.browse', 'chọn')}</span> {t('upload.toChoose', 'để chọn')}
              </p>
            </div>
          </>
        )}
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
        <p className="text-[11px] text-muted-foreground/60">
          {t('upload.acceptedFormats', 'PDF, DOCX, PPTX, XLSX, Hình ảnh, ZIP — tối đa 50MB')}
        </p>
      </div>
    </div>
  )
}