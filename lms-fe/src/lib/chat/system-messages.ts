/**
 * System message rendering — ports the vendored webapp's
 * components/post_markdown/system_message_helpers.tsx verbatim. Each system
 * post type (join_channel, leave_channel, add_to_channel, header_change, etc.)
 * maps to a localized template string filled from post.props.
 *
 * Returns a plain string (the webapp returns React nodes; we render strings in
 * the post list's muted system-message style). The template strings match the
 * vendored defaultMessage values so behavior is identical.
 */

import type { ChatPost } from './types'

/** Strip a leading @ if present, then prepend @ for display. */
function renderUsername(username: string | undefined): string {
  if (!username) return ''
  return username.startsWith('@') ? username : `@${username}`
}

/** Read a string prop safely. */
function prop(post: ChatPost, key: string): string | undefined {
  const p = post.props as Record<string, unknown> | undefined
  const v = p?.[key]
  return typeof v === 'string' ? v : undefined
}

const POST_TYPES = {
  JOIN_CHANNEL: 'system_join_channel',
  LEAVE_CHANNEL: 'system_leave_channel',
  ADD_TO_CHANNEL: 'system_add_to_channel',
  EPHEMERAL_ADD_TO_CHANNEL: 'system_ephemeral_add_to_channel',
  REMOVE_FROM_CHANNEL: 'system_remove_from_channel',
  JOIN_TEAM: 'system_join_team',
  LEAVE_TEAM: 'system_leave_team',
  ADD_TO_TEAM: 'system_add_to_team',
  REMOVE_FROM_TEAM: 'system_remove_from_team',
  HEADER_CHANGE: 'system_header_change',
  DISPLAYNAME_CHANGE: 'system_displayname_change',
  CONVERT_CHANNEL: 'system_convert_channel',
  PURPOSE_CHANGE: 'system_purpose_change',
  CHANNEL_DELETED: 'system_channel_deleted',
  CHANNEL_UNARCHIVED: 'system_channel_restored',
  ME: 'me',
  AUTO_TRANSLATION_CHANGE: 'system_autotranslation',
  SHARED_CHANNEL_STATE: 'system_shared_chan_state',
  GUEST_JOIN_CHANNEL: 'system_guest_join_channel',
  ADD_GUEST_TO_CHANNEL: 'system_add_guest_to_chan',
} as const

/**
 * Convert a system post into a display string, mirroring renderSystemMessage.
 * Returns null for non-system posts (the caller renders them as markdown).
 */
export function renderSystemMessage(post: ChatPost): string | null {
  const type = (post.type ?? '') as string
  if (!type.startsWith('system_')) {
    if (type === POST_TYPES.ME) {
      // /me: strip surrounding asterisks, render the action text in italics.
      return post.message.replace(/^\*|\*$/g, '')
    }
    return null
  }

  switch (type) {
    case POST_TYPES.JOIN_CHANNEL:
    case POST_TYPES.GUEST_JOIN_CHANNEL: {
      const u = renderUsername(prop(post, 'username'))
      return u ? `${u} đã tham gia kênh.` : ''
    }
    case POST_TYPES.LEAVE_CHANNEL: {
      const u = renderUsername(prop(post, 'username'))
      return u ? `${u} đã rời kênh.` : ''
    }
    case POST_TYPES.ADD_TO_CHANNEL:
    case POST_TYPES.EPHEMERAL_ADD_TO_CHANNEL:
    case POST_TYPES.ADD_GUEST_TO_CHANNEL: {
      const u = renderUsername(prop(post, 'username'))
      const added = renderUsername(prop(post, 'addedUsername'))
      if (!u || !added) return ''
      return `${added} được thêm vào kênh bởi ${u}.`
    }
    case POST_TYPES.REMOVE_FROM_CHANNEL: {
      const removed = renderUsername(prop(post, 'removedUsername'))
      return removed ? `${removed} đã bị xóa khỏi kênh` : ''
    }
    case POST_TYPES.JOIN_TEAM: {
      const u = renderUsername(prop(post, 'username'))
      return u ? `${u} đã tham gia nhóm.` : ''
    }
    case POST_TYPES.LEAVE_TEAM: {
      const u = renderUsername(prop(post, 'username'))
      return u ? `${u} đã rời nhóm.` : ''
    }
    case POST_TYPES.ADD_TO_TEAM: {
      const u = renderUsername(prop(post, 'username'))
      const added = renderUsername(prop(post, 'addedUsername'))
      if (!u || !added) return ''
      return `${added} được thêm vào nhóm bởi ${u}`
    }
    case POST_TYPES.REMOVE_FROM_TEAM: {
      // NOTE: vendored code reads post.props.username (not removedUsername).
      const removed = renderUsername(prop(post, 'username'))
      return removed ? `${removed} đã bị xóa khỏi nhóm.` : ''
    }
    case POST_TYPES.HEADER_CHANGE: {
      const u = renderUsername(prop(post, 'username'))
      if (!u) return ''
      const oldHeader = prop(post, 'old_header')
      const newHeader = prop(post, 'new_header')
      if (oldHeader && newHeader) return `${u} đã cập nhật tiêu đề kênh\nTừ: ${oldHeader}\nThành: ${newHeader}`
      if (newHeader) return `${u} đã cập nhật tiêu đề kênh thành: ${newHeader}`
      if (oldHeader) return `${u} đã xóa tiêu đề kênh (trước đó: ${oldHeader})`
      return ''
    }
    case POST_TYPES.DISPLAYNAME_CHANGE: {
      const u = renderUsername(prop(post, 'username'))
      const oldName = prop(post, 'old_displayname')
      const newName = prop(post, 'new_displayname')
      if (!u || !oldName || !newName) return ''
      return `${u} đã đổi tên hiển thị kênh từ: ${oldName} thành: ${newName}`
    }
    case POST_TYPES.CONVERT_CHANNEL: {
      const u = renderUsername(prop(post, 'username'))
      return u ? `${u} đã chuyển kênh từ công khai sang riêng tư` : ''
    }
    case POST_TYPES.PURPOSE_CHANGE: {
      const u = renderUsername(prop(post, 'username'))
      if (!u) return ''
      const oldPurpose = prop(post, 'old_purpose')
      const newPurpose = prop(post, 'new_purpose')
      if (oldPurpose && newPurpose) return `${u} đã cập nhật mục đích kênh từ: ${oldPurpose} thành: ${newPurpose}`
      if (newPurpose) return `${u} đã cập nhật mục đích kênh thành: ${newPurpose}`
      if (oldPurpose) return `${u} đã xóa mục đích kênh (trước đó: ${oldPurpose})`
      return ''
    }
    case POST_TYPES.CHANNEL_DELETED: {
      const u = renderUsername(prop(post, 'username'))
      return u ? `${u} đã lưu trữ kênh.` : ''
    }
    case POST_TYPES.CHANNEL_UNARCHIVED: {
      const u = renderUsername(prop(post, 'username'))
      return u ? `${u} đã khôi phục kênh.` : ''
    }
    case POST_TYPES.AUTO_TRANSLATION_CHANGE: {
      const u = renderUsername(prop(post, 'username'))
      const enabled = prop(post, 'enabled')
      if (!u) return ''
      return enabled === 'true'
        ? `${u} đã bật Tự động dịch cho kênh này. Mọi tin nhắn mới sẽ hiển thị bằng ngôn ngữ ưu tiên của bạn.`
        : `${u} đã tắt Tự động dịch cho kênh này. Mọi tin nhắn sẽ hiển thị ở ngôn ngữ gốc.`
    }
    case POST_TYPES.SHARED_CHANNEL_STATE: {
      const state = prop(post, 'shared_channel_state')
      const workspace = prop(post, 'workspace_name')
      if (state === 'shared') return workspace ? `Kênh này hiện được chia sẻ với ${workspace}.` : ''
      if (state === 'unshared') return workspace ? `Kênh này không còn được chia sẻ với ${workspace}.` : 'Kênh này không còn được chia sẻ với workspace khác.'
      return ''
    }
    default:
      // Unknown system type: fall back to the raw message if present.
      return post.message || ''
  }
}

/** Whether a post should be rendered as a system message (vs. markdown). */
export function isSystemMessageType(post: ChatPost): boolean {
  const type = (post.type ?? '') as string
  return type.startsWith('system_') || type === POST_TYPES.ME
}

export { POST_TYPES as SYSTEM_POST_TYPES }
