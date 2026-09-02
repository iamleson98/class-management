/**
 * Chat user normalization.
 *
 * The Mattermost server serializes `model.User` with **lowercase-concatenated
 * JSON keys** — `firstname`, `lastname`, `notifyprops`, `lastactivityat`,
 * `createat`, … (see public/model/user.go json tags). The TS types in
 * `@mattermost/types/users` (which the chat UI is written against) instead
 * expect snake_case — `first_name`, `last_name`, `notify_props`, ….
 *
 * Nothing in between translates, so `user.first_name` reads `undefined` and
 * every nickname-less user renders as "undefined undefined".
 *
 * `normalizeChatUser` rewrites the concatenated keys to their snake_case
 * equivalents once, at the store boundary (upsertUsers), so every consumer
 * (post authors, member lists, profile popovers, mention search, …) sees the
 * documented shape. Keys that already match are passed through untouched,
 * and objects are copied shallowly so callers' references aren't mutated.
 */

import type { ChatUser } from './types'

/** server json tag (lowercase) → TS UserProfile field (snake_case) */
const KEY_ALIASES: Record<string, string> = {
  createat: 'create_at',
  updateat: 'update_at',
  deleteat: 'delete_at',
  authservice: 'auth_service',
  authdata: 'auth_data',
  emailverified: 'email_verified',
  firstname: 'first_name',
  lastname: 'last_name',
  notifyprops: 'notify_props',
  lastpasswordupdate: 'last_password_update',
  lastpictureupdate: 'last_picture_update',
  failedattempts: 'failed_attempts',
  mfaactive: 'mfa_active',
  mfasecret: 'mfa_secret',
  remoteid: 'remote_id',
  lastactivityat: 'last_activity_at',
  lastlogin: 'last_login',
  allowmarketing: 'allow_marketing',
  isbot: 'is_bot',
  botdescription: 'bot_description',
  botlasticonupdate: 'bot_last_icon_update',
  termsofserviceid: 'terms_of_service_id',
  termsofservicecreateat: 'terms_of_service_create_at',
  disablewelcomeemail: 'disable_welcome_email',
  mfausetimestamps: 'mfa_used_timestamps',
}

/** Rewrite a raw server user payload into the ChatUser (UserProfile) shape. */
export function normalizeChatUser(raw: unknown): ChatUser {
  if (!raw || typeof raw !== 'object') return raw as ChatUser
  const src = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(src)) {
    const mapped = KEY_ALIASES[key]
    if (mapped) {
      // Only alias when the snake_case field isn't already present (defensive
      // against payloads that already carry the canonical shape).
      if (src[mapped] === undefined) out[mapped] = value
    } else {
      out[key] = value
    }
  }
  return out as ChatUser
}
