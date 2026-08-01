/**
 * User preferences hooks — wraps Client4.savePreferences / getMyPreferences /
 * deletePreferences plus patchMe (for notify_props). Mirrors the vendored
 * redux preference actions. Preferences are the storage for display, sidebar,
 * advanced, theme, and flagged/saved settings; notifications live on the user's
 * notify_props field (saved via patchMe).
 */

'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { client4 } from './client'
import { useChatStore } from './store'
import { useCurrentUserId } from './hooks'

export interface Preference {
  user_id: string
  category: string
  name: string
  value: string
}

/** Save a batch of preferences for the current user. */
export function useSavePreferences() {
  const userId = useCurrentUserId()
  return useMutation({
    mutationFn: async (preferences: Preference[]) => {
      if (!userId) throw new Error('not authenticated')
      const withUser = preferences.map((p) => ({ ...p, user_id: p.user_id || userId }))
      await client4.savePreferences(userId, withUser as never)
      return withUser
    },
  })
}

/** Delete a batch of preferences for the current user. */
export function useDeletePreferences() {
  const userId = useCurrentUserId()
  return useMutation({
    mutationFn: async (preferences: Preference[]) => {
      if (!userId) throw new Error('not authenticated')
      const withUser = preferences.map((p) => ({ ...p, user_id: p.user_id || userId }))
      await client4.deletePreferences(userId, withUser as never)
      return withUser
    },
  })
}

/** Load all my preferences into a flat map keyed by `${category}:${name}`. */
export function useMyPreferences() {
  return useQuery({
    queryKey: ['chat', 'my-preferences-full'],
    queryFn: async () => {
      const prefs = (await client4.getMyPreferences()) as unknown as Preference[]
      const map: Record<string, string> = {}
      for (const p of prefs) map[`${p.category}:${p.name}`] = p.value
      return map
    },
    staleTime: Infinity,
  })
}

/** Patch the current user's profile (used for notify_props). */
export function usePatchMe() {
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const user = await client4.patchMe(patch as never)
      return user
    },
  })
}

// ─── Preference key constants (from mattermost-redux/constants/preferences) ──

export const PREF = {
  CATEGORY_DISPLAY_SETTINGS: 'display_settings',
  CATEGORY_SIDEBAR_SETTINGS: 'sidebar_settings',
  CATEGORY_ADVANCED_SETTINGS: 'advanced_settings',
  CATEGORY_THEME: 'theme',
  CATEGORY_NOTIFICATIONS: 'notifications',

  USE_MILITARY_TIME: 'use_military_time',
  NAME_NAME_FORMAT: 'name_format',
  CHANNEL_DISPLAY_MODE: 'channel_display_mode',
  MESSAGE_DISPLAY: 'message_display',
  COLORIZE_USERNAMES: 'colorize_usernames',
  COLLAPSE_DISPLAY: 'collapse_previews',
  COLLAPSED_REPLY_THREADS: 'collapsed_reply_threads',
  CLICK_TO_REPLY: 'click_to_reply',
  LINK_PREVIEW_DISPLAY: 'link_previews',
  ONE_CLICK_REACTIONS_ENABLED: 'one_click_reactions_enabled',
  AVAILABILITY_STATUS_ON_POSTS: 'availability_status_on_posts',
  RENDER_EMOTICONS_AS_EMOJI: 'render_emoticons_as_emoji',

  SHOW_UNREAD_SECTION: 'show_unread_section',
  LIMIT_VISIBLE_DMS_GMS: 'limit_visible_dms_gms',
  UNREAD_SCROLL_POSITION: 'unread_scroll_position',

  ADVANCED_SEND_ON_CTRL_ENTER: 'send_on_ctrl_enter',
  ADVANCED_CODE_BLOCK_ON_CTRL_ENTER: 'code_block_ctrl_enter',
  ADVANCED_FILTER_JOIN_LEAVE: 'join_leave',
  ADVANCED_SYNC_DRAFTS: 'sync_drafts',

  // name_format accepted values
  DISPLAY_PREFER_USERNAME: 'username',
  DISPLAY_PREFER_NICKNAME_FULLNAME: 'nickname_full_name',
  DISPLAY_PREFER_FULL_NAME: 'full_name',
} as const
