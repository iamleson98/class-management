/**
 * Chat domain types — re-exports of the vendored Mattermost types so the rest
 * of lms-fe imports from one place. These are the authoritative shapes the
 * server sends; fields are snake_case (Mattermost convention) and are NOT
 * camelCased here, so the chat UI reads them as-is.
 */

export type ChatTeam = import('@mattermost/types/teams').Team
export type ChatChannel = import('@mattermost/types/channels').Channel
export type ChatChannelMember = import('@mattermost/types/channels').ChannelMembership
export type ChatPost = import('@mattermost/types/posts').Post
export type ChatPostList = import('@mattermost/types/posts').PostList
export type ChatReaction = import('@mattermost/types/reactions').Reaction
export type ChatUser = import('@mattermost/types/users').UserProfile
export type ChatUserStatus = import('@mattermost/types/users').UserStatus
export type ChatFileInfo = import('@mattermost/types/files').FileInfo
export type ChatPostSearchResults = import('@mattermost/types/posts').PostSearchResults

export const ChannelTypeOpen = 'O' as const
export const ChannelTypePrivate = 'P' as const
export const ChannelTypeDirect = 'D' as const
export const ChannelTypeGroup = 'G' as const

export const STATUS_ONLINE = 'online' as const
export const STATUS_AWAY = 'away' as const
export const STATUS_OFFLINE = 'offline' as const
export const STATUS_DND = 'dnd' as const
export type PresenceStatus = typeof STATUS_ONLINE | typeof STATUS_AWAY | typeof STATUS_OFFLINE | typeof STATUS_DND

/** A user id → display-name resolver helper used across the UI. */
export function userDisplayName(u?: ChatUser | null): string {
  if (!u) return 'Không xác định'
  // Tolerate both JSON key conventions (server sends `firstname`/`lastname`).
  const raw = u as unknown as Record<string, unknown>
  const first = (raw.first_name ?? raw.firstname ?? '') as string
  const last = (raw.last_name ?? raw.lastname ?? '') as string
  return (u.nickname || `${first} ${last}`.trim() || u.username).trim()
}
