'use client'

import { FileText, FileSpreadsheet, Presentation, Image, File, FileCode, Archive } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileTypeIconProps {
  fileType?: string | null
  className?: string
}

const FILE_TYPE_MAP: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
  PDF: { icon: FileText, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
  DOCX: { icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
  DOC: { icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
  PPTX: { icon: Presentation, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  PPT: { icon: Presentation, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  XLSX: { icon: FileSpreadsheet, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30' },
  XLS: { icon: FileSpreadsheet, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30' },
  CSV: { icon: FileSpreadsheet, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30' },
  PNG: { icon: Image, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  JPG: { icon: Image, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  JPEG: { icon: Image, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  SVG: { icon: Image, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  Image: { icon: Image, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  ZIP: { icon: Archive, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  RAR: { icon: Archive, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  JS: { icon: FileCode, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
  TS: { icon: FileCode, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
  PY: { icon: FileCode, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/30' },
}

const DEFAULT = { icon: File, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-900/30' }

export function FileTypeIcon({ fileType, className }: FileTypeIconProps) {
  const type = (fileType || '').toUpperCase()
  const config = FILE_TYPE_MAP[type] || DEFAULT
  const Icon = config.icon

  return (
    <div className={cn('inline-flex items-center justify-center rounded-lg p-2', config.bg, className)}>
      <Icon className={cn('h-4 w-4', config.color)} />
    </div>
  )
}