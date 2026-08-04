'use client'

import { useCallback, useRef, useState } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  placeholder?: string
  className?: string
  onImageUpload?: (file: File) => Promise<string>
}

const TOOLBAR_BUTTONS = [
  { label: 'B', title: 'Đậm (Ctrl+B)', action: 'bold', icon: '**' },
  { label: 'I', title: 'Nghiên (Ctrl+I)', action: 'italic', icon: '_' },
  { label: 'H1', title: 'Tiêu đề 1', action: 'h1', icon: '# ' },
  { label: 'H2', title: 'Tiêu đề 2', action: 'h2', icon: '## ' },
  { label: '\u2022', title: 'Danh sách', action: 'list', icon: '- ' },
  { label: '1.', title: 'Số thứ tự', action: 'olist', icon: '1. ' },
  { label: '\u{1F517}', title: 'Liên kết', action: 'link', icon: '[text](url)' },
  { label: '\u{1F5BC}', title: 'Hình ảnh', action: 'image', icon: '![alt](url)' },
  { label: '</>', title: 'Code', action: 'code', icon: '`code`' },
  { label: '\u275D', title: 'Trích dẫn', action: 'quote', icon: '> ' },
  { label: '\u2014', title: 'Ngang', action: 'hr', icon: '\n---\n' },
]

export default function RichTextEditor({
  value,
  onChange,
  readOnly = false,
  placeholder,
  className,
  onImageUpload,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const insertMarkdown = useCallback(
    (before: string, after: string = '') => {
      const textarea = textareaRef.current
      if (!textarea || readOnly) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = value.substring(start, end)
      const newText =
        value.substring(0, start) +
        before +
        (selectedText || 'text') +
        after +
        value.substring(end)
      onChange(newText)
      // Restore cursor position after React re-render
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(
          start + before.length,
          start + before.length + (selectedText || 'text').length
        )
      }, 0)
    },
    [value, onChange, readOnly]
  )

  const handleImageUpload = useCallback(() => {
    if (!onImageUpload || readOnly) return
    fileInputRef.current?.click()
  }, [onImageUpload, readOnly])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !onImageUpload) return
      try {
        const url = await onImageUpload(file)
        insertMarkdown(`![${file.name}](${url})`)
      } catch (err) {
        console.error('Image upload failed:', err)
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [onImageUpload, insertMarkdown]
  )

  if (readOnly) {
    return (
      <div className={`prose prose-sm dark:prose-invert max-w-none ${className || ''}`}>
        <div className="whitespace-pre-wrap">{value}</div>
      </div>
    )
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${className || ''}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30">
        {TOOLBAR_BUTTONS.map((btn) => (
          <button
            key={btn.action}
            type="button"
            title={btn.title}
            onClick={() => {
              if (btn.action === 'image') {
                handleImageUpload()
              } else if (btn.action === 'link') {
                const url = prompt('Nhập URL liên kết:')
                if (url) insertMarkdown('[', `](${url})`)
              } else {
                insertMarkdown(btn.icon)
              }
            }}
            className="px-2 py-1.5 rounded text-sm font-medium hover:bg-sky-100 dark:hover:bg-sky-900/30 hover:text-sky-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            disabled={readOnly}
          >
            {btn.label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              preview
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Content */}
      {preview ? (
        <div className="prose prose-sm dark:prose-invert max-w-none min-h-75 p-4">
          <div className="whitespace-pre-wrap">{value}</div>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-75 p-4 bg-background text-sm font-mono resize-y focus:outline-none"
          placeholder={placeholder || 'Nhập nội dung bài viết... Sử dụng thanh công cụ để định dạng.'}
        />
      )}

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
