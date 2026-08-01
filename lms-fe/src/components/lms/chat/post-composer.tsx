'use client'

/**
 * Message composer — ports the vendored webapp's composer logic into shadcn/ui:
 *   - Enter-to-send (with code-block detection + channel-switch guard), Shift/Alt+Enter → newline
 *     (from utils/post_utils.ts: postMessageOnKeyPress / isWithinCodeBlock)
 *   - @mention autocomplete: local-first (channel members in store) then remote
 *     (Client4.autocompleteUsers), accent-insensitive matching (at_mention_provider.ts)
 *   - throttled outbound typing ping (global_actions.tsx: emitLocalUserTypingEvent)
 *   - file upload (Client4.uploadFile → file_ids on the post)
 *
 * Send is optimistic via useSendPost (the post is upserted into the store on success).
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Send, Paperclip, X, Loader2, AtSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar } from '@/components/lms/shared/avatar'
import { useToast } from '@/hooks/use-toast'
import { useSendPost, useUploadFile, useTypingSender, useCurrentUserId } from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { client4 } from '@/lib/chat/client'
import { enterShouldSend, profileMatchesPrefix, displayUsername } from '@/lib/chat/utils'
import type { ChatUser } from '@/lib/chat/types'
import { useTranslation } from '@/lib/i18n'

interface PostComposerProps {
  channelId: string
  /** Thread root id — set when composing a reply in the thread pane. */
  rootId?: string | null
  teamId?: string
  onSent?: () => void
  placeholder?: string
}

export function PostComposer({ channelId, rootId, teamId, onSent, placeholder }: PostComposerProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const userId = useCurrentUserId()
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<{ id: string; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<{ prefix: string; start: number } | null>(null)
  const [mentionResults, setMentionResults] = useState<ChatUser[]>([])
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionLoading, setMentionLoading] = useState(false)
  // Slash-command autocomplete.
  const [commandQuery, setCommandQuery] = useState<string | null>(null)
  const [commandResults, setCommandResults] = useState<{ Suggestion: string; Hint: string; Description: string }[]>([])
  const [commandIndex, setCommandIndex] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastChannelSwitchAt = useRef(0)
  const lastTypingSent = useRef(0)
  const fileInputRefCb = useRef<HTMLInputElement>(null)
  const remotePrefixStale = useRef('')

  const sendPost = useSendPost()
  const uploadFile = useUploadFile()
  const sendTyping = useTypingSender()
  const channelMembers = useChatStore((s) => s.memberships[channelId])
  const users = useChatStore((s) => s.users)

  // Mark channel-switch time so the 500ms Enter-guard (webapp behavior) works.
  useEffect(() => {
    lastChannelSwitchAt.current = Date.now()
  }, [channelId])

  // ── @mention autocomplete: local-first (channel members in store), then remote ──
  // Ported from at_mention_provider: localMembers() filters loaded profiles,
  // remoteMembers() calls autocompleteUsers once the user keeps typing.
  const localMembers = useMemo(() => {
    if (!mentionQuery) return []
    // The store doesn't keep channel→userIds; use all loaded users as the
    // local pool, filtered by the prefix. Good enough for the common case
    // where channel members have been loaded via the members RHS / posts.
    const pool = Object.values(users)
    return pool.filter((u) => profileMatchesPrefix(u, mentionQuery.prefix)).slice(0, 25)
  }, [mentionQuery, users])

  // Fetch remote autocomplete when local results are thin.
  useEffect(() => {
    if (!mentionQuery || !teamId) return
    const prefix = mentionQuery.prefix
    if (prefix.length < 1) return
    // Skip if a prior broader/same prefix returned nothing.
    if (remotePrefixStale.current && prefix.startsWith(remotePrefixStale.current)) return
    let cancelled = false
    setMentionLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await client4.autocompleteUsers(prefix, teamId, channelId, { limit: 25 })
        if (cancelled) return
        const remote = [...(res.users ?? []), ...(res.out_of_channel ?? [])] as ChatUser[]
        if (remote.length === 0) remotePrefixStale.current = prefix
        else remotePrefixStale.current = ''
        setMentionResults(remote.filter((u) => profileMatchesPrefix(u, prefix)))
        setMentionIndex(0)
      } catch {
        if (!cancelled) setMentionResults([])
      } finally {
        if (!cancelled) setMentionLoading(false)
      }
    }, 200) // Constants.SEARCH_TIMEOUT_MILLISECONDS debounce
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [mentionQuery, teamId, channelId])

  const showMentions = !!mentionQuery
  const mentionList = localMembers.length > 0 ? localMembers : mentionResults

  const insertMention = (user: ChatUser) => {
    if (!mentionQuery || !textareaRef.current) return
    const before = message.slice(0, mentionQuery.start)
    const after = message.slice(textareaRef.current.selectionStart)
    const newMessage = `${before}@${user.username} ${after}`
    setMessage(newMessage)
    setMentionQuery(null)
    setMentionResults([])
    // Focus back and place caret after the mention.
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      const pos = before.length + user.username.length + 2
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  // ── Detect @mention at caret on each keystroke ──
  const AT_MENTION_REGEX = /(?:^|\W)([@＠]([\p{L}\d\-_. ]*))$/iu

  const handleMessageChange = (value: string) => {
    setMessage(value)
    // Throttle outbound typing ping (webapp: TimeBetweenUserTypingUpdatesMilliseconds ~ 3s).
    const now = Date.now()
    if (now - lastTypingSent.current >= 3000) {
      lastTypingSent.current = now
      sendTyping(channelId, rootId ?? '')
    }
    // Detect an in-progress @mention at the caret.
    const ta = textareaRef.current
    const caret = ta?.selectionStart ?? value.length
    const textUpToCaret = value.slice(0, caret)
    const match = textUpToCaret.match(AT_MENTION_REGEX)
    if (match) {
      const start = textUpToCaret.length - match[0].length + (match[0].startsWith('@') || match[0].startsWith('＠') ? 0 : 1)
      setMentionQuery({ prefix: match[2], start })
    } else {
      setMentionQuery(null)
      setMentionResults([])
    }
    // Detect a slash command at the start of the message (only when `/` is the
    // first character and there's no space yet → still typing the command name).
    const commandMatch = value.match(/^\/([a-z0-9_]*)$/i)
    setCommandQuery(commandMatch ? value : null)
  }

  // Fetch slash-command suggestions when the user is typing a `/command`.
  useEffect(() => {
    if (!commandQuery || !teamId) {
      setCommandResults([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const { getCommandSuggestions } = await import('@/lib/chat/commands')
        const suggestions = await getCommandSuggestions(commandQuery, teamId, { team_id: teamId, channel_id: channelId, root_id: rootId ?? '' })
        if (!cancelled) {
          setCommandResults(suggestions.map((s) => ({ Suggestion: s.Suggestion, Hint: s.Hint, Description: s.Description })))
          setCommandIndex(0)
        }
      } catch {
        if (!cancelled) setCommandResults([])
      }
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [commandQuery, teamId, channelId, rootId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention list keyboard nav (up/down/enter/esc).
    // Slash-command list keyboard nav (takes priority over mentions).
    if (commandQuery && commandResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCommandIndex((i) => (i + 1) % commandResults.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCommandIndex((i) => (i - 1 + commandResults.length) % commandResults.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        setMessage(commandResults[commandIndex].Suggestion + ' ')
        setCommandQuery(null)
        setCommandResults([])
        return
      }
      if (e.key === 'Escape') {
        setCommandQuery(null)
        setCommandResults([])
        return
      }
    }

    if (showMentions && mentionList.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => (i + 1) % mentionList.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => (i - 1 + mentionList.length) % mentionList.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(mentionList[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        setMentionQuery(null)
        setMentionResults([])
        return
      }
    }

    // Enter-to-send (webapp postMessageOnKeyPress logic), ported to enterShouldSend.
    if (e.key === 'Enter') {
      const caret = e.currentTarget.selectionStart
      const shouldSend = enterShouldSend({
        event: { shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey },
        message,
        caretPosition: caret,
        lastChannelSwitchAt: lastChannelSwitchAt.current,
      })
      if (shouldSend) {
        e.preventDefault()
        void send()
      }
    }
  }

  // ── File upload ──
  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const infos = await uploadFile.mutateAsync({ channelId, file })
      setAttachments((prev) => [...prev, ...infos.map((f) => ({ id: f.id, name: f.name }))])
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.uploadFailed', 'Tải file thất bại'), variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const send = async () => {
    const trimmed = message.trim()
    if (!trimmed && attachments.length === 0) return
    // Slash commands are routed through executeCommand instead of createPost.
    if (trimmed.startsWith('/') && teamId) {
      try {
        const { executeCommand } = await import('@/lib/chat/commands')
        const result = await executeCommand(trimmed, { team_id: teamId, channel_id: channelId, root_id: rootId ?? '' }, {
          onSearch: () => {/* parent opens search */},
          onOpenSettings: () => {/* parent opens settings */},
          onOpenShortcuts: () => {/* parent opens shortcuts */},
          onLeaveChannel: () => {/* parent leaves channel */},
        })
        if (result.error) toast({ title: result.error, variant: 'destructive' })
        else if (result.message) toast({ title: result.message })
        setMessage('')
        setCommandQuery(null)
        setCommandResults([])
        onSent?.()
      } catch (err: unknown) {
        toast({ title: (err as Error)?.message || t('chat.sendFailed', 'Gửi tin nhắn thất bại'), variant: 'destructive' })
      }
      return
    }
    try {
      await sendPost.mutateAsync({
        channelId,
        message: trimmed,
        rootId: rootId ?? undefined,
        fileIds: attachments.map((a) => a.id),
      })
      setMessage('')
      setAttachments([])
      setMentionQuery(null)
      setMentionResults([])
      setCommandQuery(null)
      setCommandResults([])
      onSent?.()
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.sendFailed', 'Gửi tin nhắn thất bại'), variant: 'destructive' })
    }
  }

  const sending = sendPost.isPending

  return (
    <div className="border-t bg-card">
      {/* Slash-command suggestions */}
      {commandQuery && commandResults.length > 0 && (
        <div className="border-b bg-popover shadow-sm max-h-60 overflow-auto">
          {commandResults.map((cmd, i) => (
            <button
              key={cmd.Suggestion + i}
              onMouseDown={(e) => { e.preventDefault(); setMessage(cmd.Suggestion + ' '); setCommandQuery(null); setCommandResults([]); textareaRef.current?.focus() }}
              onMouseEnter={() => setCommandIndex(i)}
              className={`w-full flex flex-col gap-0.5 px-3 py-1.5 text-left transition-colors ${i === commandIndex ? 'bg-muted' : 'hover:bg-muted/60'}`}
            >
              <div className="text-sm font-medium">{cmd.Suggestion}<span className="text-muted-foreground font-normal"> {cmd.Hint}</span></div>
              {cmd.Description && <div className="text-xs text-muted-foreground truncate">{cmd.Description}</div>}
            </button>
          ))}
        </div>
      )}
      {/* @mention suggestions popover */}
      {showMentions && (mentionList.length > 0 || mentionLoading) && (
        <div className="border-b bg-popover shadow-sm max-h-60 overflow-auto">
          {mentionLoading && mentionList.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> {t('chat.loading', 'Đang tải…')}
            </div>
          )}
          {mentionList.map((user, i) => (
            <button
              key={user.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(user) }}
              onMouseEnter={() => setMentionIndex(i)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                i === mentionIndex ? 'bg-muted' : 'hover:bg-muted/60'
              }`}
            >
              <Avatar name={displayUsername(user)} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{displayUsername(user)}</div>
                <div className="text-xs text-muted-foreground truncate">@{user.username}</div>
              </div>
              {i === mentionIndex && <AtSign className="h-3 w-3 text-muted-foreground" />}
            </button>
          ))}
        </div>
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2">
          {attachments.map((file) => (
            <div key={file.id} className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
              <Paperclip className="h-3 w-3 text-muted-foreground" />
              <span className="max-w-32 truncate">{file.name}</span>
              <button onClick={() => setAttachments((p) => p.filter((a) => a.id !== file.id))} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        <input ref={fileInputRefCb} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} disabled={uploading} />
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileInputRefCb.current?.click()} disabled={uploading} title={t('chat.attach', 'Đính kèm file')}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => handleMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('chat.placeholder', 'Nhập tin nhắn… (Enter để gửi, Shift+Enter xuống dòng)')}
          rows={1}
          data-composer=""
          className="min-h-9 max-h-32 resize-none"
        />
        <Button onClick={send} disabled={sending || uploading || (!message.trim() && attachments.length === 0)} className="h-9 w-9 shrink-0" size="icon">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
