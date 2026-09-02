/**
 * Tests for chat user normalization and display-name resolution.
 *
 * The Mattermost server serializes model.User with lowercase-concatenated
 * JSON keys (firstname, lastname, notifyprops, lastactivityat, …) while the
 * chat UI reads the @mattermost/types UserProfile snake_case shape
 * (first_name, last_name, notify_props, …). Without normalization, every
 * nickname-less user rendered as "undefined undefined".
 */
import { describe, it, expect } from 'vitest'
import { normalizeChatUser } from './user-normalize'
import { displayUsername } from './utils'
import { userDisplayName } from './types'
import { useChatStore } from './store'
import { resolveAuthorName } from './notifications'
import type { ChatPost } from './types'

/** A raw user payload exactly as the server emits it (probed from /users/ids). */
const RAW_USER = {
  id: 'user1111111111111111111111111',
  createat: 1788351109507,
  updateat: 1788351109507,
  deleteat: 0,
  username: 'nguyenan',
  authservice: '',
  email: 'nguyenan@sitename.me',
  emailverified: true,
  nickname: '',
  firstname: 'An',
  lastname: 'Nguyen',
  position: '',
  roles: 'system_user lms_student',
  notifyprops: { channel: 'true', desktop: 'mention', first_name: 'false', mention_keys: '' },
  lastpasswordupdate: 1788351109507,
  locale: 'en',
  timezone: { automaticTimezone: '', manualTimezone: '', useAutomaticTimezone: 'true' },
  lastactivityat: 1788351200000,
  isbot: false,
  phone: '0354575050',
} as unknown as Record<string, unknown>

describe('normalizeChatUser', () => {
  it('maps lowercase-concatenated keys to the UserProfile snake_case shape', () => {
    const u = normalizeChatUser(RAW_USER) as unknown as Record<string, unknown>
    expect(u.first_name).toBe('An')
    expect(u.last_name).toBe('Nguyen')
    expect(u.notify_props).toEqual(RAW_USER.notifyprops)
    expect(u.create_at).toBe(RAW_USER.createat)
    expect(u.last_activity_at).toBe(RAW_USER.lastactivityat)
    expect(u.is_bot).toBe(false)
    // Untouched keys pass through.
    expect(u.username).toBe('nguyenan')
    expect(u.nickname).toBe('')
    expect(u.email).toBe('nguyenan@sitename.me')
  })

  it('leaves already-snake_case payloads intact (no double mapping)', () => {
    const u = normalizeChatUser({ id: 'x', first_name: 'John', last_name: 'Doe', username: 'jd' }) as unknown as Record<string, unknown>
    expect(u.first_name).toBe('John')
    expect(u.last_name).toBe('Doe')
    expect(u.firstname).toBeUndefined()
  })

  it('passes through non-objects', () => {
    expect(normalizeChatUser(null)).toBeNull()
    expect(normalizeChatUser(undefined)).toBeUndefined()
  })
})

describe('display name resolution (undefined-users fix)', () => {
  it('resolves server-shape users without nicknames', () => {
    expect(displayUsername(RAW_USER as never)).toBe('An Nguyen')
    expect(userDisplayName(RAW_USER as never)).toBe('An Nguyen')
  })

  it('resolves normalized users', () => {
    const normalized = normalizeChatUser(RAW_USER)
    expect(displayUsername(normalized)).toBe('An Nguyen')
    expect(userDisplayName(normalized)).toBe('An Nguyen')
  })

  it('falls back to username when no name fields exist', () => {
    expect(displayUsername({ username: 'jd' } as never)).toBe('jd')
    expect(displayUsername(undefined)).toBe('Không xác định')
  })

  it('store.upsertUsers normalizes at the boundary', () => {
    const before = useChatStore.getState().users
    useChatStore.getState().upsertUsers([RAW_USER as never])
    const stored = useChatStore.getState().users[RAW_USER.id as string] as unknown as Record<string, unknown>
    expect(stored?.first_name).toBe('An')
    expect(stored?.last_name).toBe('Nguyen')
    expect(stored?.notify_props).toEqual(RAW_USER.notifyprops)
    // Restore.
    useChatStore.setState({ users: before })
  })

  it('resolveAuthorName uses the display name from the store', () => {
    const post = { user_id: RAW_USER.id as string } as unknown as ChatPost
    const users = { [RAW_USER.id as string]: normalizeChatUser(RAW_USER) }
    expect(resolveAuthorName(post, users)).toBe('An Nguyen')
    // And with a raw server-shape user too.
    expect(resolveAuthorName(post, { [RAW_USER.id as string]: RAW_USER as never })).toBe('An Nguyen')
  })
})
