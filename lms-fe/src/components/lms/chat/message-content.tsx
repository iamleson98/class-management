'use client'

/**
 * MessageContent — rich rendering of a chat post's message text, porting the
 * vendored webapp's formatting behavior:
 *   - GitHub-flavored markdown (via react-markdown + rehype-raw)
 *   - @mention highlight chips (current user highlighted differently), clickable
 *   - ~channel links (resolved against the channel map)
 *   - :shortcode: → unicode emoji (preprocessed in message-format)
 *   - fenced code blocks with a language label + copy button (highlight.js lazy)
 *   - inline link previews / OpenGraph cards from post.metadata.embeds
 *
 * Mentions + channel links are applied as a post-render pass over the text
 * nodes (segmentMessage), since react-markdown treats plain text as a single
 * string. Markdown structure (code, bold, lists) still applies because the
 * segment pass runs only inside the `text` renderer.
 */

import { useMemo, useState, useEffect, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import { Copy, Check } from 'lucide-react'
import { useChatStore } from '@/lib/chat/store'
import { useCurrentUserId } from '@/lib/chat/hooks'
import { preprocessMessage, segmentMessage, resolveMention } from '@/lib/chat/message-format'
import { renderSystemMessage, isSystemMessageType } from '@/lib/chat/system-messages'
import { renderLineNumbers, getLanguageName } from '@/lib/chat/syntax-highlighting'
import { displayUsername, parsePermalink } from '@/lib/chat/utils'
import type { ChatPost } from '@/lib/chat/types'

/** Safe wrapper so SSR/build don't choke on the (client-only) lookup. */
function getLanguageNameSafe(lang: string): string {
  try {
    return getLanguageName(lang)
  } catch {
    return lang
  }
}

interface MessageContentProps {
  post: ChatPost
  isOwn: boolean
  onMentionClick?: (userId: string) => void
  onChannelClick?: (channelName: string) => void
  /** Jump to a permalinks post in-app (instead of opening a new tab). */
  onJumpToPost?: (postId: string) => void
  compact?: boolean
}

/** Render a raw text run, splitting out @mention chips and ~channel links. */
function RichText({ text, onMentionClick, onChannelClick }: { text: string; onMentionClick?: (id: string) => void; onChannelClick?: (name: string) => void }) {
  const users = useChatStore((s) => s.users)
  const channels = useChatStore((s) => s.channels)
  const currentUserId = useCurrentUserId()
  const segments = useMemo(() => segmentMessage(text), [text])

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'mention') {
          const user = resolveMention(seg.username, users)
          const isMe = user?.id && user.id === currentUserId
          const name = user ? displayUsername(user) : `@${seg.username}`
          return (
            <span
              key={i}
              onClick={user ? () => onMentionClick?.(user.id) : undefined}
              className={
                user
                  ? `mention-link cursor-pointer rounded px-0.5 font-medium ${
                      isMe ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300' : 'text-sky-600 dark:text-sky-400 hover:underline'
                    }`
                  : 'font-medium'
              }
            >
              @{seg.username}
              {user && <span className="sr-only"> ({name})</span>}
            </span>
          )
        }
        if (seg.type === 'special') {
          // Broadcast mentions (@channel/@all/@here) render as a distinct chip
          // so they're visually prominent (ports SPECIAL_MENTIONS styling).
          return (
            <span key={i} className="mention-link rounded px-0.5 font-medium bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
              @{seg.name}
            </span>
          )
        }
        if (seg.type === 'channel') {
          const ch = Object.values(channels).find((c) => c.name.toLowerCase() === seg.name.toLowerCase())
          return (
            <span
              key={i}
              onClick={ch ? () => onChannelClick?.(seg.name) : undefined}
              className={ch ? 'cursor-pointer rounded px-0.5 font-medium text-sky-600 dark:text-sky-400 hover:underline' : 'font-medium'}
              title={ch?.display_name}
            >
              ~{seg.name}
            </span>
          )
        }
        return <span key={i}>{seg.text}</span>
      })}
    </>
  )
}

/** A fenced code block with language label + copy button + syntax highlighting (ports code_block.tsx). */
function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const language = /language-(\w+)/.exec(className || '')?.[1] ?? ''
  const code = String(children ?? '').replace(/\n$/, '')

  // Lazy-highlight on mount/language change (ports the async highlight() call).
  useEffect(() => {
    let cancelled = false
    if (language) {
      import('@/lib/chat/syntax-highlighting').then(({ highlight, getLanguageName }) =>
        highlight(language, code).then((html) => {
          if (!cancelled) setHighlighted(html)
        }),
      ).catch(() => {})
    } else {
      setHighlighted(null)
    }
    return () => { cancelled = true }
  }, [language, code])

  const lineNumbers = useMemo(() => renderLineNumbers(code), [code])
  const langName = language ? getLanguageNameSafe(language) : ''

  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="relative group my-2 rounded-lg border bg-muted/40 overflow-hidden">
      {langName && (
        <div className="flex items-center justify-between border-b px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>{langName}</span>
          <button onClick={copy} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      {!langName && (
        <button onClick={copy} className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] hover:bg-background">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
      <div className="flex overflow-x-auto">
        <pre aria-hidden className="select-none py-3 pl-3 pr-2 text-xs leading-relaxed text-muted-foreground/50 text-right">
          {lineNumbers}
        </pre>
        <pre className="flex-1 py-3 pr-3 text-xs leading-relaxed hljs">
          {highlighted !== null ? (
            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          ) : (
            <code className={className}>{code}</code>
          )}
        </pre>
      </div>
    </div>
  )
}

/** Link preview card for OpenGraph/image embeds from post.metadata.embeds. */
function EmbedPreviews({ post }: { post: ChatPost }) {
  const embeds = post.metadata?.embeds ?? []
  if (embeds.length === 0) return null
  return (
    <div className="mt-1.5 space-y-1.5">
      {embeds.map((embed, i) => {
        const e = embed as Record<string, unknown>
        const type = e.type as string
        const data = (e.data ?? {}) as Record<string, unknown>
        if (type === 'image' || (e.url && type === 'opengraph' && data.image_url)) {
          const url = (e.url as string) || ''
          const img = (data.image_url as string) || url
          return (
            <a key={i} href={url} target="_blank" rel="noreferrer" className="block max-w-sm">
              <img src={img} alt="" className="max-h-60 rounded-lg border object-cover" />
            </a>
          )
        }
        if (type === 'opengraph' && (data.title || data.description)) {
          return (
            <a key={i} href={e.url as string} target="_blank" rel="noreferrer" className="block max-w-sm rounded-lg border p-2.5 hover:bg-muted/50 transition-colors">
              {data.image_url ? <img src={data.image_url as string} alt="" className="mb-1.5 h-24 w-full rounded object-cover" /> : null}
              {data.title ? <div className="text-xs font-semibold truncate">{data.title as string}</div> : null}
              {data.description ? <div className="text-[11px] text-muted-foreground line-clamp-2">{data.description as string}</div> : null}
              <div className="mt-1 text-[10px] text-muted-foreground/70 truncate">{(e.url as string || '').replace(/^https?:\/\//, '')}</div>
            </a>
          )
        }
        return null
      })}
    </div>
  )
}

function MessageContentImpl({ post, isOwn, onMentionClick, onChannelClick, onJumpToPost, compact }: MessageContentProps) {
  const processed = useMemo(() => preprocessMessage(post.message), [post.message])

  // System messages (join/leave/header-change/etc.) render as a localized
  // plain string in the muted system style, not as markdown.
  const systemText = useMemo(() => (isSystemMessageType(post) ? renderSystemMessage(post) : null), [post])

  if (systemText !== null) {
    return <p className="text-xs text-muted-foreground italic whitespace-pre-wrap">{systemText || post.message}</p>
  }

  return (
    <div className={compact ? '' : ''}>
      {processed && (
        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0">
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            components={{
              // Code: inline vs fenced.
              code(props) {
                const { className, children } = props as { className?: string; children?: React.ReactNode }
                // react-markdown v10: fenced blocks are delivered as <code class="language-x"> with a newline.
                const isBlock = className?.includes('language-') || String(children ?? '').includes('\n')
                if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>
                return <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{children}</code>
              },
              // Plain text runs → apply mention/channel/emoji highlighting.
              text(props) {
                const value = String(props.children ?? '')
                return <RichText text={value} onMentionClick={onMentionClick} onChannelClick={onChannelClick} />
              },
              // Inline markdown images `![](url)` — render as a clickable image.
              img(props) {
                const src = String(props.src ?? '')
                const alt = String(props.alt ?? '')
                if (!src) return null
                return (
                  <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    className="max-h-72 max-w-full rounded-lg border border-black/10 dark:border-white/10 my-1"
                  />
                )
              },
              a(props) {
                const href = String(props.href ?? '')
                // Intercept in-app permalinks (/team/pl/{postId}) so they jump
                // to the post instead of opening a new tab (ports handleFormattedTextClick).
                const permalink = parsePermalink(href)
                if (permalink?.postId && onJumpToPost) {
                  return (
                    <a
                      href={href}
                      onClick={(e) => { e.preventDefault(); onJumpToPost(permalink.postId!) }}
                      className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      {props.children}
                    </a>
                  )
                }
                return (
                  <a href={href} target="_blank" rel="noreferrer" className="text-sky-600 dark:text-sky-400 hover:underline">
                    {props.children}
                  </a>
                )
              },
            }}
          >
            {processed}
          </ReactMarkdown>
        </div>
      )}
      <EmbedPreviews post={post} />
      {!isOwn && null}
    </div>
  )
}

export const MessageContent = memo(MessageContentImpl)
