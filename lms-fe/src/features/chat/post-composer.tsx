'use client'

/**
 * Message composer — ports the vendored webapp's composer logic into shadcn/ui:
 *   - Enter-to-send (with code-block detection + channel-switch guard), Shift/Alt+Enter → newline,
 *     and a Ctrl+Enter code-block mode that auto-closes ``` and sends
 *     (from utils/post_utils.ts: postMessageOnKeyPress / isWithinCodeBlock)
 *   - @mention autocomplete: local-first (channel members in store) then remote
 *     (Client4.autocompleteUsers), accent-insensitive matching (at_mention_provider.ts)
 *   - inline :shortcode: emoji autocomplete (EmoticonProvider) + an emoji picker button
 *     (use_editor_emoji_picker.tsx) that inserts unicode / :name: at the caret
 *   - cross-browser auto-resize (use-autosize-textarea.ts; field-sizing-content is Chrome-only)
 *   - paste-to-upload for images/files + plain-text paste (Textbox onPaste)
 *   - character limit with a counter near the limit (characterLimit)
 *   - throttled outbound typing ping (global_actions.tsx: emitLocalUserTypingEvent)
 *   - file upload (Client4.uploadFile → file_ids on the post)
 *
 * Send is optimistic via useSendPost (the post is upserted into the store on success).
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Send, Paperclip, X, Loader2, AtSign, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar } from '@/components/shared/avatar'
import { useToast } from '@/hooks/use-toast'
import { useSendPost, useUploadFile, useTypingSender, useCurrentUserId, MAX_POST_CHARS } from '@/lib/chat/hooks'
import { useChatStore } from '@/lib/chat/store'
import { callsClient } from '@/features/calls/calls-client'
import { useCallsStore } from '@/features/calls/calls-store'
import { client4 } from '@/lib/chat/client'
import { enterShouldSend, profileMatchesPrefix, displayUsername } from '@/lib/chat/utils'
import { useAutosizeTextarea } from '@/lib/chat/use-autosize-textarea'
import { useDraft } from '@/lib/chat/drafts'
import {
  findEmojisByPrefix, isSystemEmoji, unifiedToUnicode, getEmojiImageUrl, emojiMap,
} from '@/lib/chat/emoji-data'
import type { ChatUser } from '@/lib/chat/types'
import { EmojiPicker } from './emoji-picker'
import { useTranslation } from '@/lib/i18n'

interface PostComposerProps {
  channelId: string
  /** Thread root id — set when composing a reply in the thread pane. */
  rootId?: string | null
  teamId?: string
  onSent?: () => void
  placeholder?: string
  /** Called when the user presses Up-arrow with an empty composer (edit last post). */
  onEditLatest?: () => void
}

export function PostComposer({ channelId, rootId, teamId, onSent, placeholder, onEditLatest }: PostComposerProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const userId = useCurrentUserId()
  // Persist the draft per channel/thread so unsent text survives navigation
  // and reloads (ports the webapp's local draft storage).
  const draft = useDraft(channelId, rootId)
  const message = draft.message
  const setMessage = draft.setMessage
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
  // Inline :shortcode: emoji autocomplete (ports EmoticonProvider).
  const [emojiQuery, setEmojiQuery] = useState<{ partial: string; start: number } | null>(null)
  const [emojiIndex, setEmojiIndex] = useState(0)
  // Emoji picker popover.
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastChannelSwitchAt = useRef(0)
  const lastTypingSent = useRef(0)
  const fileInputRefCb = useRef<HTMLInputElement>(null)
  const remotePrefixStale = useRef('')

  // Cross-browser auto-resize (field-sizing-content is Chrome-only).
  useAutosizeTextarea(textareaRef, message, { minHeight: 36, maxHeight: 128 })

  const sendPost = useSendPost()
  const uploadFile = useUploadFile()
  const sendTyping = useTypingSender()
  const channelMembers = useChatStore((s) => s.memberships[channelId])
  const users = useChatStore((s) => s.users)

  // Restore attachment chips from a persisted draft on mount / channel switch.
  useEffect(() => {
    if (draft.fileIds.length > 0) {
      // We don't have the filenames for stored ids; show a generic chip. The
      // server still accepts the file ids when sending.
      setAttachments((prev) => {
        const known = new Set(prev.map((a) => a.id))
        return [...prev, ...draft.fileIds.filter((id) => !known.has(id)).map((id) => ({ id, name: t('chat.attachment', 'Tệp đính kèm') }))]
      })
    }
    // Only on channel/thread change, not every render.
  }, [channelId, rootId])

  // Keep the draft's fileIds in sync with the live attachment list.
  useEffect(() => {
    draft.setFileIds(attachments.map((a) => a.id))
  }, [attachments])

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
  // Special broadcast mentions (@channel/@all/@here) — hardcoded, filtered by
  // the typed prefix (ports at_mention_provider specialMentions).
  const SPECIAL_MENTIONS = ['channel', 'all', 'here'] as const
  const specialMentions = useMemo(() => {
    if (!mentionQuery) return [] as string[]
    const prefix = mentionQuery.prefix.toLowerCase()
    return SPECIAL_MENTIONS.filter((name) => name.startsWith(prefix))
  }, [mentionQuery])
  const userList = localMembers.length > 0 ? localMembers : mentionResults
  // Build the combined list: special mentions first, then users.
  const mentionList = useMemo(() => {
    const items: Array<{ type: 'special'; name: string } | { type: 'user'; user: ChatUser }> = [
      ...specialMentions.map((name) => ({ type: 'special' as const, name })),
      ...userList.map((user) => ({ type: 'user' as const, user })),
    ]
    return items
  }, [specialMentions, userList])

  const insertMention = (user: ChatUser) => insertMentionToken(user.username)
  /** Insert a special broadcast mention (@channel/@all/@here). */
  const insertSpecialMention = (name: string) => insertMentionToken(name)
  /** Shared insert: replace the in-progress @token with @username/special + space. */
  const insertMentionToken = (token: string) => {
    if (!mentionQuery || !textareaRef.current) return
    const before = message.slice(0, mentionQuery.start)
    const after = message.slice(textareaRef.current.selectionStart)
    const newMessage = `${before}@${token} ${after}`
    setMessage(newMessage)
    setMentionQuery(null)
    setMentionResults([])
    // Focus back and place caret after the mention.
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      const pos = before.length + token.length + 2
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  // ── Detect @mention at caret on each keystroke ──
  const AT_MENTION_REGEX = /(?:^|\W)([@＠]([\p{L}\d\-_. ]*))$/iu
  // ── Detect :shortcode emoji at caret (ports EmoticonProvider pretext regex) ──
  // Matches a `:partial` at the caret that isn't preceded by another non-space char,
  // so closed :emoji: tokens and URLs don't trigger it.
  const EMOJI_SHORTCODE_REGEX = /(^|\s)(:([a-z0-9_+-]+))$/i

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
    const mentionMatch = textUpToCaret.match(AT_MENTION_REGEX)
    if (mentionMatch) {
      const start = textUpToCaret.length - mentionMatch[0].length + (mentionMatch[0].startsWith('@') || mentionMatch[0].startsWith('＠') ? 0 : 1)
      setMentionQuery({ prefix: mentionMatch[2], start })
    } else {
      setMentionQuery(null)
      setMentionResults([])
    }
    // Detect an in-progress :shortcode emoji at the caret.
    const emojiMatch = textUpToCaret.match(EMOJI_SHORTCODE_REGEX)
    if (emojiMatch) {
      const start = textUpToCaret.length - emojiMatch[0].length + (emojiMatch[0].startsWith(':') ? 0 : 1)
      setEmojiQuery({ partial: emojiMatch[3], start })
      setEmojiIndex(0)
    } else {
      setEmojiQuery(null)
    }
    // Detect a slash command at the start of the message (only when `/` is the
    // first character and there's no space yet → still typing the command name).
    const commandMatch = value.match(/^\/([a-z0-9_]*)$/i)
    setCommandQuery(commandMatch ? value : null)
  }

  // Emoji autocomplete results for the current :partial (ports findAndSuggestEmojis).
  const emojiMatches = useMemo(
    () => (emojiQuery ? findEmojisByPrefix(emojiQuery.partial, 50) : []),
    [emojiQuery],
  )

  /** Insert an emoji from the inline autocomplete, replacing the `:partial` token. */
  const insertEmojiAutocomplete = (name: string) => {
    if (!emojiQuery || !textareaRef.current) return
    const before = message.slice(0, emojiQuery.start)
    const after = message.slice(textareaRef.current.selectionStart)
    const emoji = emojiMap.get(name)
    // System emoji → insert the unicode char; custom → insert :name:.
    const insert = emoji && isSystemEmoji(emoji) ? unifiedToUnicode(emoji.unified) : `:${name}:`
    const newMessage = `${before}${insert} ${after}`
    setMessage(newMessage)
    setEmojiQuery(null)
    setEmojiIndex(0)
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      const pos = before.length + insert.length + 1
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  /** Insert an emoji from the picker popover at the caret (ports focusAndInsertText). */
  const insertEmojiFromPicker = (name: string) => {
    const ta = textareaRef.current
    const emoji = emojiMap.get(name)
    if (!emoji) return
    const insert = isSystemEmoji(emoji) ? unifiedToUnicode(emoji.unified) : `:${name}:`
    if (!ta) {
      setMessage((m) => `${m}${insert} `)
      return
    }
    const caret = ta.selectionStart ?? message.length
    const caretEnd = ta.selectionEnd ?? message.length
    // Add a leading space if not at the start and the preceding char isn't whitespace.
    const needsSpaceBefore = caret !== 0 && !/\s/.test(message[caret - 1] ?? '')
    const before = message.slice(0, caret)
    const after = message.slice(caretEnd)
    const text = needsSpaceBefore ? ` ${insert} ` : `${insert} `
    const newMessage = `${before}${text}${after}`
    setMessage(newMessage)
    requestAnimationFrame(() => {
      const pos = caret + text.length
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
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
    // Autocomplete keyboard nav. Priority: slash-command > emoji > mention.
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

    // Inline :shortcode: emoji nav (ports EmoticonProvider keyboard handling).
    if (emojiQuery && emojiMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setEmojiIndex((i) => (i + 1) % emojiMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setEmojiIndex((i) => (i - 1 + emojiMatches.length) % emojiMatches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertEmojiAutocomplete(emojiMatches[emojiIndex].name)
        return
      }
      if (e.key === 'Escape') {
        setEmojiQuery(null)
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
        const item = mentionList[mentionIndex]
        if (item.type === 'special') insertSpecialMention(item.name)
        else insertMention(item.user)
        return
      }
      if (e.key === 'Escape') {
        setMentionQuery(null)
        setMentionResults([])
        return
      }
    }

    // Enter-to-send (webapp postMessageOnKeyPress logic), ported to enterShouldSend.
    // The Ctrl+Enter code-block mode auto-closes ``` and returns the new message.
    if (e.key === 'Enter') {
      const caret = e.currentTarget.selectionStart
      const result = enterShouldSend({
        event: { shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey },
        message,
        caretPosition: caret,
        lastChannelSwitchAt: lastChannelSwitchAt.current,
      })
      if (result.send) {
        e.preventDefault()
        if (result.nextMessage) setMessage(result.nextMessage)
        void send(result.nextMessage ?? message)
      }
    }

    // Up-arrow with an empty composer edits the current user's last message
    // (ports use_key_handler editLatestPost). Only when no autocomplete is open.
    if (e.key === 'ArrowUp' && !message.trim() && !commandQuery && !showMentions && !emojiQuery && onEditLatest) {
      e.preventDefault()
      onEditLatest()
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

  // ── Paste handler: upload pasted images/files; let plain text through as-is
  //    (ports the vendored Textbox onPaste — image paste → attachment). ──
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          void handleUpload(file)
        }
      }
    }
  }

  /** /call command handling (plugin parity: slash_commands). */
  const handleCallCommand = (sub: string, channelId: string): string => {
    const s = useCallsStore.getState()
    const inThisCall = s.channelId === channelId && s.status !== 'disconnected' && s.status !== 'error'
    switch (sub) {
      case '':
      case 'join':
      case 'start': {
        if (inThisCall) return t('chat.callCmd.already', 'Bạn đã ở trong cuộc gọi.')
        window.dispatchEvent(new CustomEvent('calls:join-channel', { detail: { channelId } }))
        return t('chat.callCmd.joining', 'Đang tham gia cuộc gọi…')
      }
      case 'leave': {
        if (!inThisCall) return t('chat.callCmd.notInCall', 'Bạn không đang ở trong cuộc gọi.')
        callsClient.leave()
        return t('chat.callCmd.left', 'Đã rời cuộc gọi.')
      }
      case 'end': {
        const callId = s.activeCalls[channelId]?.callId ?? s.callId ?? ''
        if (!callId) return t('chat.callCmd.noCall', 'Không có cuộc gọi đang diễn ra.')
        void fetch(`/api/v4/calls/${encodeURIComponent(callId)}/host/end`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        })
        return t('chat.callCmd.ending', 'Đang kết thúc cuộc gọi cho tất cả…')
      }
      case 'link': {
        const url = `${window.location.origin}/?join_call=true&channel=${channelId}`
        void navigator.clipboard?.writeText(url)
        return t('chat.callCmd.linkCopied', 'Đã sao chép liên kết tham gia cuộc gọi.')
      }
      case 'stats': {
        const stats = callsClient.readStatsSnapshot?.()
        return stats ?? t('chat.callCmd.noStats', 'Chưa có thống kê cuộc gọi.')
      }
      default:
        return t('chat.callCmd.usage', 'Cách dùng: /call [join|leave|end|link|stats]')
    }
  }

  const send = async (overrideMessage?: string) => {
    const trimmed = (overrideMessage ?? message).trim()
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
          onCallCommand: handleCallCommand,
        })
        if (result.error) toast({ title: result.error, variant: 'destructive' })
        else if (result.message) toast({ title: result.message })
        draft.clear()
        setAttachments([])
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
      draft.clear()
      setAttachments([])
      setMentionQuery(null)
      setMentionResults([])
      setCommandQuery(null)
      setCommandResults([])
      setEmojiQuery(null)
      onSent?.()
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || t('chat.sendFailed', 'Gửi tin nhắn thất bại'), variant: 'destructive' })
    }
  }

  const sending = sendPost.isPending
  const charCount = message.length
  const overLimit = charCount > MAX_POST_CHARS
  const nearLimit = charCount > MAX_POST_CHARS * 0.9
  const canSend = !sending && !uploading && !overLimit && (!!message.trim() || attachments.length > 0)

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
      {/* @mention suggestions popover (special mentions + users). */}
      {showMentions && (mentionList.length > 0 || mentionLoading) && (
        <div className="border-b bg-popover shadow-sm max-h-60 overflow-auto">
          {mentionLoading && mentionList.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> {t('chat.loading', 'Đang tải…')}
            </div>
          )}
          {mentionList.map((item, i) =>
            item.type === 'special' ? (
              <button
                key={`special-${item.name}`}
                onMouseDown={(e) => { e.preventDefault(); insertSpecialMention(item.name) }}
                onMouseEnter={() => setMentionIndex(i)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${i === mentionIndex ? 'bg-muted' : 'hover:bg-muted/60'}`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                  <AtSign className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">@{item.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.name === 'all' || item.name === 'channel' ? t('chat.mentionAllDesc', 'Thông báo mọi người trong kênh') : t('chat.mentionHereDesc', 'Thông báo những người đang online')}
                  </div>
                </div>
              </button>
            ) : (
              <button
                key={item.user.id}
                onMouseDown={(e) => { e.preventDefault(); insertMention(item.user) }}
                onMouseEnter={() => setMentionIndex(i)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${i === mentionIndex ? 'bg-muted' : 'hover:bg-muted/60'}`}
              >
                <Avatar name={displayUsername(item.user)} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{displayUsername(item.user)}</div>
                  <div className="text-xs text-muted-foreground truncate">@{item.user.username}</div>
                </div>
                {i === mentionIndex && <AtSign className="h-3 w-3 text-muted-foreground" />}
              </button>
            ),
          )}
        </div>
      )}
      {/* :shortcode: emoji suggestions popover (ports EmoticonProvider) */}
      {emojiQuery && emojiMatches.length > 0 && (
        <div className="border-b bg-popover shadow-sm max-h-60 overflow-auto">
          {emojiMatches.map((m, i) => {
            const e = m.emoji
            const isSys = isSystemEmoji(e)
            return (
              <button
                key={m.name + i}
                onMouseDown={(ev) => { ev.preventDefault(); insertEmojiAutocomplete(m.name) }}
                onMouseEnter={() => setEmojiIndex(i)}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors ${i === emojiIndex ? 'bg-muted' : 'hover:bg-muted/60'}`}
              >
                {isSys ? (
                  <span className="text-base leading-none w-5 text-center">{unifiedToUnicode(e.unified)}</span>
                ) : (
                  <img src={getEmojiImageUrl(e)} alt={m.name} className="h-4 w-4 object-contain" />
                )}
                <span className="text-muted-foreground">:{m.name}:</span>
              </button>
            )
          })}
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
        {/* Emoji picker button (ports use_editor_emoji_picker toggle). */}
        <div className="relative shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowEmojiPicker((v) => !v)} title={t('chat.emoji.button', 'Chọn emoji')}>
            <Smile className="h-4 w-4" />
          </Button>
          {showEmojiPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
              <div className="absolute bottom-full left-0 z-50 mb-2">
                <EmojiPicker
                  onSelect={(name) => { insertEmojiFromPicker(name); setShowEmojiPicker(false) }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            </>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder ?? t('chat.placeholder', 'Nhập tin nhắn… (Enter để gửi, Shift+Enter xuống dòng)')}
            rows={1}
            data-composer=""
            className="min-h-9 max-h-32 resize-none"
          />
          {/* Character counter — visible near the limit (ports characterLimit). */}
          {nearLimit && (
            <div className={`text-right text-[10px] mt-0.5 ${overLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              {charCount}/{MAX_POST_CHARS}
            </div>
          )}
        </div>
        <Button onClick={() => send()} disabled={!canSend} className="h-9 w-9 shrink-0" size="icon">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
