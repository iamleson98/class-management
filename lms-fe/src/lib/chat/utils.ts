/**
 * Chat domain utilities — ported (near-verbatim) from the vendored Mattermost
 * webapp's framework-agnostic logic so the new lms-fe chat behaves the same as
 * the old chat. Source files (all under src/chat/channels/src/):
 *   - packages/mattermost-redux/src/utils/post_utils.ts    (post predicates)
 *   - packages/mattermost-redux/src/utils/channel_utils.ts (unread math, sorting)
 *   - packages/mattermost-redux/src/constants/posts.ts     (Post constants)
 *   - utils/post_utils.ts                                  (mention resolution, collapse)
 *
 * These are pure functions with no Redux/React dependency.
 */

import type { ChatChannel, ChatChannelMember, ChatPost, ChatUser } from './types'

// ─── Post constants (from packages/mattermost-redux/src/constants/posts.ts) ──

export const SYSTEM_MESSAGE_PREFIX = 'system_'
export const POST_DELETED = 'DELETED'
export const POST_COLLAPSE_TIMEOUT = 1000 * 60 * 5 // 5 minutes

export const POST_TYPES = {
  EPHEMERAL: 'system_ephemeral',
  EPHEMERAL_ADD_TO_CHANNEL: 'system_ephemeral_add_to_channel',
  ADD_TO_CHANNEL: 'system_add_to_channel',
  JOIN_LEAVE: 'system_join_leave',
  JOIN_CHANNEL: 'system_join_channel',
  LEAVE_CHANNEL: 'system_leave_channel',
  ADD_REMOVE: 'system_add_remove',
  REMOVE_FROM_CHANNEL: 'system_remove_from_channel',
  JOIN_TEAM: 'system_join_team',
  LEAVE_TEAM: 'system_leave_team',
  ADD_TO_TEAM: 'system_add_to_team',
  REMOVE_FROM_TEAM: 'system_remove_from_team',
  COMBINED_USER_ACTIVITY: 'system_combined_user_activity',
  ME: 'me',
  BURN_ON_READ: 'burn_on_read',
} as const

const IGNORE_POST_TYPES: string[] = [
  POST_TYPES.ADD_REMOVE,
  POST_TYPES.ADD_TO_CHANNEL,
  POST_TYPES.JOIN_LEAVE,
  POST_TYPES.JOIN_CHANNEL,
  POST_TYPES.LEAVE_CHANNEL,
  POST_TYPES.REMOVE_FROM_CHANNEL,
  POST_TYPES.JOIN_TEAM,
  POST_TYPES.LEAVE_TEAM,
  POST_TYPES.ADD_TO_TEAM,
  POST_TYPES.REMOVE_FROM_TEAM,
]

// ─── Post predicates (from packages/mattermost-redux/src/utils/post_utils.ts) ──

export function isSystemMessage(post: ChatPost): boolean {
  return Boolean(post.type && post.type.startsWith(SYSTEM_MESSAGE_PREFIX))
}

export function isMeMessage(post: ChatPost): boolean {
  return Boolean(post.type && (post.type as string) === POST_TYPES.ME)
}

export function isFromWebhook(post: ChatPost): boolean {
  return post.props?.from_webhook === 'true'
}

export function isPostEphemeral(post: ChatPost): boolean {
  const type = post.type as string
  return (
    type === POST_TYPES.EPHEMERAL ||
    type === POST_TYPES.EPHEMERAL_ADD_TO_CHANNEL ||
    post.state === POST_DELETED
  )
}

export function isUserAddedInChannel(post: ChatPost, userId?: string): boolean {
  const type = post.type as string
  const postTypeCheck = Boolean(post.type && type === POST_TYPES.ADD_TO_CHANNEL)
  const userIdCheck = Boolean(post.props && (post.props as Record<string, unknown>).addedUserId === userId)
  return postTypeCheck && userIdCheck
}

export function shouldIgnorePost(post: ChatPost, userId?: string): boolean {
  if (isUserAddedInChannel(post, userId)) return false
  return IGNORE_POST_TYPES.includes((post.type ?? '') as string)
}

export function isPostOwner(userId: string, post: ChatPost): boolean {
  return userId === post.user_id
}

export function isEdited(post: ChatPost): boolean {
  return post.edit_at > 0
}

/** Newest-first comparator (pending/failed first, then create_at DESC). */
export function comparePosts(a: ChatPost, b: ChatPost): number {
  const aFailed = a.failed || a.id === a.pending_post_id
  const bFailed = b.failed || b.id === b.pending_post_id
  if (aFailed && !bFailed) return -1
  if (!aFailed && bFailed) return 1
  return (b.create_at ?? 0) - (a.create_at ?? 0)
}

// ─── Consecutive-post collapse (from utils/post_utils.ts: areConsecutivePostsBySameUser) ──

/**
 * Whether two consecutive posts should be visually collapsed (same author,
 * close in time, not webhook/system/burn-on-read). Drives the "stacked"
 * message look.
 */
export function areConsecutivePostsBySameUser(post: ChatPost, previousPost?: ChatPost): boolean {
  if (!(post && previousPost)) return false
  return (
    post.user_id === previousPost.user_id &&
    post.create_at - previousPost.create_at <= POST_COLLAPSE_TIMEOUT &&
    !isFromWebhook(post) &&
    !isFromWebhook(previousPost) &&
    !isSystemMessage(post) &&
    !isSystemMessage(previousPost) &&
    (post.type as string) !== POST_TYPES.BURN_ON_READ &&
    (previousPost.type as string) !== POST_TYPES.BURN_ON_READ
  )
}

// ─── Mention resolution (from utils/post_utils.ts) ──────────────────

/**
 * Resolve a raw @mention token to candidate usernames, tolerating trailing
 * punctuation (. _ -). e.g. "john." → ['john.', 'john'].
 */
export function getPotentialMentionsForName(mentionName: string): string[] {
  let s = mentionName.toLowerCase()
  const out = [s]
  while (s.length > 0 && /[._-]$/.test(s)) {
    s = s.substring(0, s.length - 1)
    out.push(s)
  }
  return out
}

// ─── Unread math (from packages/mattermost-redux/src/utils/channel_utils.ts: calculateUnreadCount) ──

export interface UnreadCount {
  showUnread: boolean
  mentions: number
  messages: number
}

/** Whether a channel member has muted the channel (notify_props.mark_unread). */
export function isChannelMuted(member?: ChatChannelMember): boolean {
  return member?.notify_props?.mark_unread === 'mention'
}

/**
 * Compute the unread state for a channel from the message counts vs my
 * membership counters. Ported verbatim from the webapp's calculateUnreadCount.
 * `crtEnabled` selects root-count math for Collapsed Reply Threads.
 */
export function calculateUnreadCount(
  messageCount: { total: number; root: number } | undefined,
  member: ChatChannelMember | undefined,
  crtEnabled = false,
): UnreadCount {
  if (!member || !messageCount) return { showUnread: false, mentions: 0, messages: 0 }
  let messages: number
  let mentions: number
  if (crtEnabled) {
    messages = messageCount.root - member.msg_count_root
    mentions = member.mention_count_root
  } else {
    mentions = member.mention_count
    messages = messageCount.total - member.msg_count
  }
  return {
    showUnread: mentions > 0 || (!isChannelMuted(member) && messages > 0),
    mentions,
    messages,
  }
}

// ─── Channel sorting (from packages/mattermost-redux/src/utils/channel_utils.ts) ──

const CHANNEL_TYPE_ORDER: Record<string, number> = { O: 0, P: 1, D: 2, G: 3 }

function filterName(name: string): string {
  return name.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '').replace(/\s{2,}/g, ' ')
}

/** Sort channels by type (O/P first), then display name (numeric-aware). */
export function sortChannelsByTypeAndDisplayName(
  locale: string,
  a: ChatChannel,
  b: ChatChannel,
): number {
  const aOrder = CHANNEL_TYPE_ORDER[a.type] ?? 99
  const bOrder = CHANNEL_TYPE_ORDER[b.type] ?? 99
  if (aOrder !== bOrder) return aOrder - bOrder
  const aName = filterName(a.display_name).toLowerCase()
  const bName = filterName(b.display_name).toLowerCase()
  if (a.display_name !== b.display_name) {
    return a.display_name.localeCompare(b.display_name, locale, { numeric: true })
  }
  return aName.localeCompare(bName, locale, { numeric: true })
}

/**
 * Sort unread channels for the sidebar: muted sink to bottom, then channels
 * with mentions first, then by recency (last post time). Ported from
 * redux/selectors/entities/channels.ts:sortUnreadChannels.
 */
export function sortUnreadChannels(
  channels: ChatChannel[],
  isMuted: (channelId: string) => boolean,
  hasMentions: (channelId: string) => boolean,
  crtEnabled = false,
): ChatChannel[] {
  return [...channels].sort((a, b) => {
    const aMuted = isMuted(a.id)
    const bMuted = isMuted(b.id)
    if (aMuted && !bMuted) return 1
    if (!aMuted && bMuted) return -1
    const aMentions = hasMentions(a.id)
    const bMentions = hasMentions(b.id)
    if (aMentions && !bMentions) return -1
    if (!aMentions && bMentions) return 1
    const aAt = Math.max(crtEnabled ? a.last_root_post_at : a.last_post_at, a.create_at) || 0
    const bAt = Math.max(crtEnabled ? b.last_root_post_at : b.last_post_at, b.create_at) || 0
    return bAt - aAt
  })
}

// ─── Display name helpers ───────────────────────────────────────────

/** Resolve a username to a display name from the loaded profiles. */
export function displayUsername(user: ChatUser | undefined, fallback = 'Không xác định'): string {
  if (!user) return fallback
  return user.nickname || `${user.first_name} ${user.last_name}`.trim() || user.username
}

// ─── @mention autocomplete helpers (ported from mattermost-redux/utils/user_utils.ts
//      and at_mention_provider.ts) ───────────────────────────────────

const AUTOCOMPLETE_SPLIT_CHARACTERS = ['.', '-', '_']

/** Unicode-normalize a string, stripping combining marks (accent-insensitive match). */
export function normalizeString(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Split a term into progressively-shorter suggestion prefixes. */
export function getSuggestionsSplitBy(term: string, splitStr: string): string[] {
  const splitTerm = term.split(splitStr)
  const initialSuggestions = splitTerm.map((_st, i) => splitTerm.slice(i).join(splitStr))
  if (splitStr === ' ') return initialSuggestions
  return initialSuggestions.reduce((acc, val) => {
    if (acc.length === 0) acc.push(val)
    else acc.push(splitStr + val, val)
    return acc
  }, [] as string[])
}

/** Split by multiple separators, de-duplicated. */
export function getSuggestionsSplitByMultiple(term: string, splitStrs: string[]): string[] {
  const suggestions = splitStrs.reduce((acc, val) => {
    getSuggestionsSplitBy(term, val).forEach((s) => acc.add(s))
    return acc
  }, new Set<string>())
  return [...suggestions]
}

/**
 * Build the list of strings a profile should match against for @mention
 * filtering (username split on .-_, first/last/nickname, "first last").
 * Ported from at_mention_provider.getProfileSuggestions.
 */
export function getProfileSuggestions(profile: ChatUser): string[] {
  const out: string[] = []
  if (profile.username) {
    out.push(...getSuggestionsSplitByMultiple(profile.username.toLowerCase(), AUTOCOMPLETE_SPLIT_CHARACTERS))
  }
  for (const property of [profile.first_name, profile.last_name, profile.nickname]) {
    out.push(...getSuggestionsSplitBy((property ?? '').toLowerCase(), ' '))
  }
  out.push(`${profile.first_name} ${profile.last_name}`.toLowerCase())
  return out
}

/** Whether a profile matches a mention prefix (accent-insensitive). */
export function profileMatchesPrefix(profile: ChatUser, prefix: string): boolean {
  const prefixLower = normalizeString(prefix.toLowerCase())
  return getProfileSuggestions(profile).some((s) => normalizeString(s).startsWith(prefixLower))
}

// ─── Enter-to-send (ported from utils/post_utils.ts: isWithinCodeBlock) ──

const REGEX_CODE_BLOCK = /```/g

/** Whether the caret currently sits inside an unclosed ``` code block. */
export function isWithinCodeBlock(message: string, caretPosition: number): boolean {
  const matches = message.substring(0, caretPosition).match(REGEX_CODE_BLOCK)
  return Boolean(matches && matches.length % 2 !== 0)
}

/**
 * Decide whether pressing Enter should send the message. Mirrors the webapp's
 * behavior: Shift/Alt+Enter → newline; Enter inside a code block → newline
 * (unless Ctrl/Cmd+Enter + sendCodeBlockOnCtrlEnter); the channel-switch
 * 500ms guard avoids accidental sends right after switching channels.
 */
export function enterShouldSend(args: {
  event: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }
  message: string
  caretPosition: number
  lastChannelSwitchAt: number
  sendMessageOnCtrlEnter?: boolean
}): boolean {
  const { event, message, caretPosition, lastChannelSwitchAt } = args
  const now = Date.now()
  // Don't send right after switching channels (webapp: 500ms guard).
  if (lastChannelSwitchAt > 0 && now - lastChannelSwitchAt <= 500) return false
  // Shift/Alt always → newline.
  if (event.shiftKey || event.altKey) return false
  const inCodeBlock = isWithinCodeBlock(message, caretPosition)
  if (inCodeBlock) {
    // Inside a code block, only Ctrl/Cmd+Enter sends (when configured).
    return Boolean(args.sendMessageOnCtrlEnter && (event.ctrlKey || event.metaKey))
  }
  return true
}

