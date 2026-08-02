/**
 * Full emoji system — ports the vendored webapp's emoji infrastructure
 * (utils/emoji.ts, utils/emoji_map.ts, utils/emoji_utils.tsx) so :shortcode:
 * resolution, the emoji picker categories, and image URLs behave identically
 * to the old chat app.
 *
 * The 1.6MB emoji.json (3301 system emojis) is bundled once; the alias/unicode
 * index maps are built from it at module load (same as the vendored emoji.ts,
 * just generated here instead of pre-built). Custom emojis merge in at runtime.
 */

import rawData from './emoji.json'
import { client4 } from '../client'

export interface SystemEmoji {
  name: string
  unified: string
  short_name: string
  short_names: string[]
  category: string
  skin_variations?: Record<string, { unified: string }>
  text?: string | null
  texts?: string[] | null
}

export interface CustomEmoji {
  id: string
  name: string
  category: 'custom'
  create_at: number
  update_at: number
  delete_at: number
  creator_id: string
}

export type Emoji = SystemEmoji | CustomEmoji

export function isSystemEmoji(emoji: Emoji): emoji is SystemEmoji {
  if ('category' in emoji) return emoji.category !== 'custom'
  return !('id' in emoji)
}

/** The full system emoji array (auto-generated data, do not edit). */
export const Emojis = rawData as SystemEmoji[]

// ─── Index maps (built from Emojis, mirroring utils/emoji.ts) ───────

/** short_name (lowercased) → index into Emojis. Every alias is mapped. */
export const EmojiIndicesByAlias = new Map<string, number>()
for (let i = 0; i < Emojis.length; i++) {
  const e = Emojis[i]
  for (const alias of e.short_names ?? [e.short_name]) {
    EmojiIndicesByAlias.set(alias, i)
  }
}

/** lowercased unified codepoint string → index. */
export const EmojiIndicesByUnicode = new Map<string, number>()
for (let i = 0; i < Emojis.length; i++) {
  const unified = Emojis[i].unified?.toLowerCase()
  if (unified) EmojiIndicesByUnicode.set(unified, i)
}

/** The standard category order used by the picker. */
export const CategoryNames = [
  'recent', 'smileys-emotion', 'people-body', 'animals-nature',
  'food-drink', 'travel-places', 'activities', 'objects', 'symbols', 'flags', 'custom',
]

/** category → indices (display order; only non-skinned base emojis). */
const EmojiIndicesByCategory = new Map<string, number[]>()
for (let i = 0; i < Emojis.length; i++) {
  const cat = Emojis[i].category
  if (!cat) continue
  if (!EmojiIndicesByCategory.has(cat)) EmojiIndicesByCategory.set(cat, [])
  EmojiIndicesByCategory.get(cat)!.push(i)
}

/** Get the indices for a category (empty if unknown). */
export function getEmojiIndicesByCategory(category: string): number[] {
  return EmojiIndicesByCategory.get(category) ?? []
}

// ─── Codepoint helpers (from utils/emoji_utils.tsx) ─────────────────

/** Convert a unified codepoint string ("1F600" or "1F44B-1F3FB") to the unicode char. */
export function unifiedToUnicode(unified: string): string {
  return unified.split('-').map((cp) => String.fromCodePoint(parseInt(cp, 16))).join('')
}

// ─── EmojiMap (from utils/emoji_map.ts) ─────────────────────────────

/**
 * EmojiMap wraps the static system emojis plus a runtime set of custom emojis.
 * Provides get/has over both, keyed by short_name (system) or name (custom).
 */
export class EmojiMap {
  private customEmojis: Map<string, CustomEmoji> = new Map()

  constructor(customEmojis: Map<string, CustomEmoji> = new Map()) {
    this.customEmojis = customEmojis
  }

  setCustomEmojis(custom: Map<string, CustomEmoji>): void {
    this.customEmojis = custom
  }

  has(name: string): boolean {
    return EmojiIndicesByAlias.has(name) || this.customEmojis.has(name)
  }

  hasSystemEmoji(name: string): boolean {
    return EmojiIndicesByAlias.has(name)
  }

  get(name: string): Emoji | undefined {
    const idx = EmojiIndicesByAlias.get(name)
    if (idx !== undefined) return Emojis[idx]
    return this.customEmojis.get(name)
  }

  hasUnicode(codepoint: string): boolean {
    return EmojiIndicesByUnicode.has(codepoint.toLowerCase())
  }

  /** Iterate all emojis: system (keyed by short_names[0]) then custom (by name). */
  *[Symbol.iterator](): Iterator<[string, Emoji]> {
    const seen = new Set<string>()
    for (let i = 0; i < Emojis.length; i++) {
      const e = Emojis[i]
      const name = (e.short_names ?? [e.short_name])[0]
      if (!seen.has(name)) {
        seen.add(name)
        yield [name, e]
      }
    }
    for (const [name, emoji] of this.customEmojis) {
      yield [name, emoji]
    }
  }
}

// Singleton emoji map; custom emojis can be merged in via setCustomEmojis.
export const emojiMap = new EmojiMap()

// ─── Image URL resolution (from mattermost-redux/utils/emoji_utils.ts) ──

/** Build the URL for an emoji image (system → static png, custom → /emoji/{id}/image). */
export function getEmojiImageUrl(emoji: Emoji): string {
  if (isSystemEmoji(emoji)) {
    const emojiUnified = emoji.unified?.toLowerCase() ?? ''
    const filename = emojiUnified || emoji.short_names[0]
    return client4.getSystemEmojiImageUrl(filename)
  }
  return client4.getCustomEmojiImageUrl(emoji.id)
}

/** The canonical name for an emoji (short_name for system, name for custom). */
export function getEmojiName(emoji: Emoji): string {
  return isSystemEmoji(emoji) ? emoji.short_name : emoji.name
}

/** Parse :shortcode: sequences out of a text block. */
export function parseEmojiNamesFromText(text: string): string[] {
  if (!text.includes(':')) return []
  const pattern = /:([A-Za-z0-9_-]+):/gi
  const found = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match[1]) found.add(match[1])
  }
  return Array.from(found)
}

/**
 * Replace :shortcode: tokens in a string with their unicode character (system
 * emojis only; custom emojis are left as-is since they render as images).
 * Used by the message preprocessor for inline emoji in message text.
 */
export function emojifyText(text: string): string {
  if (!text.includes(':')) return text
  return text.replace(/:([A-Za-z0-9_+-]+):/g, (full, name: string) => {
    const emoji = emojiMap.get(name)
    if (emoji && isSystemEmoji(emoji)) return unifiedToUnicode(emoji.unified)
    return full
  })
}

/**
 * Resolve a shortcode to its unicode character (system emoji) for quick use in
 * reactions display / status, or null if unknown / custom.
 */
export function shortcodeToUnicode(name: string): string | null {
  const emoji = emojiMap.get(name)
  if (emoji && isSystemEmoji(emoji)) return unifiedToUnicode(emoji.unified)
  return null
}

// ─── Inline :shortcode: autocomplete (ports EmoticonProvider + compareEmojis) ──

const MIN_EMOJI_AUTOCOMPLETE_LEN = 2
const EMOJI_CATEGORY_SUGGESTION_BLOCKLIST = new Set(['skintone'])

export interface EmojiMatch {
  name: string
  emoji: Emoji
}

/**
 * Find emojis whose short_name/name contains `partial` (substring match, the
 * same behavior as the vendored EmoticonProvider.findAndSuggestEmojis), sorted
 * prefix-matches-first then alphabetically. Caps at `limit` results. Excludes
 * the skintone category, matching the vendored blocklist.
 */
export function findEmojisByPrefix(partial: string, limit = 50): EmojiMatch[] {
  if (partial.length < MIN_EMOJI_AUTOCOMPLETE_LEN) return []
  const q = partial.toLowerCase()
  const matched: EmojiMatch[] = []
  for (const [name, emoji] of emojiMap) {
    if (EMOJI_CATEGORY_SUGGESTION_BLOCKLIST.has(
      isSystemEmoji(emoji) ? emoji.category : 'custom',
    )) continue
    if (isSystemEmoji(emoji)) {
      // A system emoji may match via any of its short_names.
      const alias = emoji.short_names.find((a) => a.toLowerCase().includes(q))
      if (alias) {
        // System emojis take precedence over a custom emoji of the same name.
        if (emojiMap.hasSystemEmoji(name)) matched.push({ name: alias, emoji })
      }
    } else if (name.toLowerCase().includes(q) && !emojiMap.hasSystemEmoji(name)) {
      matched.push({ name, emoji })
    }
  }
  // Sort: prefix-matches first, then alphabetical (ports compareEmojis default rule).
  matched.sort((a, b) => {
    const aName = getEmojiName(a.emoji)
    const bName = getEmojiName(b.emoji)
    const aPrefix = aName.toLowerCase().startsWith(q)
    const bPrefix = bName.toLowerCase().startsWith(q)
    if (aPrefix !== bPrefix) return aPrefix ? -1 : 1
    // Custom emojis sink to the bottom within an equal prefix group.
    if (!isSystemEmoji(a.emoji) && isSystemEmoji(b.emoji)) return 1
    if (isSystemEmoji(a.emoji) && !isSystemEmoji(b.emoji)) return -1
    return aName.localeCompare(bName)
  })
  return matched.slice(0, limit)
}
