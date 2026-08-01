/**
 * Message formatting helpers — ports the vendored webapp's text_formatting.tsx
 * transformations (mention/channel-link/emoji autolinking) into pure functions
 * we feed to react-markdown. Kept framework-agnostic.
 *
 * The webapp runs a token-based HTML pipeline (marked + html-to-react). We keep
 * the same *behavior* but render via react-markdown with custom components:
 *   - @user  → highlighted mention chip (current user highlighted differently)
 *   - ~name → link to the channel (resolved against the channel map)
 *   - :shortcode: → unicode emoji
 */

import { emojifyText } from './emoji-data'
import type { ChatUser } from './types'

/** Matches a leading @mention token: @username (latin/digit/._-). */
const MENTION_REGEX = /(^|[^\w@])@([a-zA-Z0-9._-]+)/g
/** Matches a ~channel-mention token: ~channel-name. */
const CHANNEL_MENTION_REGEX = /(^|[^\w~])~([a-z0-9._\-]+)/gi
/** Matches :shortcode: emoji sequences. */
const EMOJI_SHORTCODE_REGEX = /:([a-z0-9_+-]+):/gi

export interface MentionInfo {
  /** The set of mention keys (lowercased usernames) that should highlight. */
  mentionKeys: string[]
  /** Whether the current user is mentioned (drives the highlight + badge). */
  mentionsCurrentUser: boolean
}

/**
 * Pre-process a raw message for display:
 *  - convert :shortcode: → unicode emoji
 *  - normalize @mentions / ~channel-mentions (the markdown renderer wraps them)
 * Returns the processed string. Mention highlighting happens in the React
 * renderer (mentionUsers + currentUser below) so it can render chips.
 */
export function preprocessMessage(message: string): string {
  if (!message) return ''
  // :shortcode: → unicode emoji (emoji-toolkit skips unknown shortcodes).
  let out = emojifyText(message)
  return out
}

/** Usernames (lowercased) known to be in the current channel/scope. */
export function buildMentionKeys(users: ChatUser[]): Set<string> {
  const set = new Set<string>()
  for (const u of users) {
    if (u.username) set.add(u.username.toLowerCase())
  }
  return set
}

/** Whether the message mentions the given user id, using its raw text + mentions set. */
export function isMentioned(message: string, mentionUsernames: string[]): boolean {
  if (!message) return false
  const lower = message.toLowerCase()
  return mentionUsernames.some((name) => name && lower.includes(`@${name.toLowerCase()}`))
}

/**
 * Split a message into segments, classifying mention/channel tokens so the
 * renderer can emit chips/links instead of raw text. Returns an array of
 * { text } or { mention, username } or { channel, name } parts.
 */
export type MessageSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; username: string }
  | { type: 'channel'; name: string }

export function segmentMessage(message: string): MessageSegment[] {
  if (!message) return []
  const segments: MessageSegment[] = []
  // Combined regex capturing @mention and ~channel tokens with their leading boundary.
  const combined = /(^|[^\w@~])(?:@([a-zA-Z0-9._-]+)|~([a-z0-9._\-]+))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = combined.exec(message)) !== null) {
    const [full, boundary, mention, channel] = match
    const matchStart = match.index
    const boundaryLen = boundary.length
    // Emit any text before the boundary.
    if (matchStart + boundaryLen > lastIndex) {
      segments.push({ type: 'text', text: message.slice(lastIndex, matchStart + (boundaryLen && boundary !== '' ? 0 : 0) + (boundaryLen ? 0 : 0)) })
    }
    // Re-emit the boundary as text so spaces/punctuation are preserved.
    if (boundary) segments.push({ type: 'text', text: boundary })
    lastIndex = matchStart + full.length
    if (mention) segments.push({ type: 'mention', username: mention })
    else if (channel) segments.push({ type: 'channel', name: channel })
  }
  if (lastIndex < message.length) {
    segments.push({ type: 'text', text: message.slice(lastIndex) })
  }
  return segments
}

/** Get a friendly display name for a mention username from the loaded users. */
export function resolveMention(username: string, users: Record<string, ChatUser>): ChatUser | undefined {
  const lower = username.toLowerCase()
  return Object.values(users).find((u) => u.username?.toLowerCase() === lower)
}

export { MENTION_REGEX, CHANNEL_MENTION_REGEX, EMOJI_SHORTCODE_REGEX }
