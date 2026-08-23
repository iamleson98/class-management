'use client'

/**
 * Emoji picker — full-fidelity port of the vendored emoji_picker, driven by the
 * real emoji data system (src/lib/chat/emoji-data). Renders all system emojis
 * grouped by their actual categories (smileys-emotion, people-body, etc.) with
 * search across short_names, plus any custom emojis loaded into the EmojiMap.
 *
 * Parity features ported from the vendored picker:
 *   - skin-tone selector (preference "emoji/emoji_skintone"), applied to emojis
 *     that have skin_variations (emoji_picker_skin.tsx)
 *   - recent-emoji section, persisted to preference "emoji/recent_emojis"
 *     (emoji_picker.tsx RECENT handling)
 *   - preview footer showing the hovered/keyboard-selected emoji
 *     (emoji_picker_preview.tsx)
 *   - keyboard grid navigation: arrows move the cursor, Enter selects, the
 *     active emoji scrolls into view (handleKeyboardEmojiNavigation)
 *
 * The selected emoji is returned by short_name (for reactions) or :shortcode:.
 */

import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  Emojis, getEmojiIndicesByCategory, unifiedToUnicode, emojiMap,
  getEmojiImageUrl, isSystemEmoji, type SystemEmoji,
} from '@/lib/chat/emoji-data'
import { useCustomEmojis, useSkinTone, useRecentEmojis, useCurrentUserId } from '@/lib/chat/hooks'
import { useTranslation } from '@/lib/i18n'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

// Standard category order (mirrors the picker's EMOJI_CATEGORIES, minus recent/searchResults/custom
// which are handled specially). Labels are localized.
const CATEGORIES: { key: string; labelKey: string; label: string }[] = [
  { key: 'smileys-emotion', labelKey: 'chat.emoji.smileys', label: 'Cảm xúc' },
  { key: 'people-body', labelKey: 'chat.emoji.people', label: 'Con người' },
  { key: 'animals-nature', labelKey: 'chat.emoji.animals', label: 'Động vật' },
  { key: 'food-drink', labelKey: 'chat.emoji.food', label: 'Đồ ăn' },
  { key: 'travel-places', labelKey: 'chat.emoji.travel', label: 'Du lịch' },
  { key: 'activities', labelKey: 'chat.emoji.activities', label: 'Hoạt động' },
  { key: 'objects', labelKey: 'chat.emoji.objects', label: 'Đồ vật' },
  { key: 'symbols', labelKey: 'chat.emoji.symbols', label: 'Ký hiệu' },
  { key: 'flags', labelKey: 'chat.emoji.flags', label: 'Cờ' },
]

// Skin-tone options (Fitzpatrick scale). 'default' = no skin tone modifier.
const SKIN_TONES: { key: string; label: string; glyph: string }[] = [
  { key: 'default', label: 'Mặc định', glyph: '🖐' },
  { key: '1F3FB', label: 'Sáng', glyph: '🏻' },
  { key: '1F3FC', label: 'Sáng vừa', glyph: '🏼' },
  { key: '1F3FD', label: 'Trung bình', glyph: '🏽' },
  { key: '1F3FE', label: 'Nâu', glyph: '🏾' },
  { key: '1F3FF', label: 'Tối', glyph: '🏿' },
]

const EMOJI_PER_ROW = 8 // grid-cols-8

/** Resolve the unified codepoint to render for an emoji given the skin tone. */
function unifiedForTone(emoji: SystemEmoji, skinTone: string): string {
  if (skinTone === 'default' || !emoji.skin_variations) return emoji.unified
  const variation = emoji.skin_variations[skinTone]
  return variation?.unified ?? emoji.unified
}

interface EmojiCell {
  name: string
  unified: string
  isSystem: boolean
  /** For custom emojis: the emoji object so we can resolve its image URL. */
  customName?: string
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const { t } = useTranslation()
  const userId = useCurrentUserId()
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState<string>('smileys-emotion')
  const { skinTone, setSkinTone } = useSkinTone(userId)
  const { recent, addRecent } = useRecentEmojis(userId)
  useCustomEmojis()

  // Keyboard cursor (a stable key like `${name}`) for grid navigation.
  const [cursor, setCursor] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus the search input on mount (ports the picker's requestAnimationFrame focus).
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Build the flat, ordered list of emoji cells actually shown in the grid.
  // Sections are: [recent?, custom?, category1, category2, ...] — each prefixed
  // with a header so we can compute row/column for keyboard navigation.
  const { cells, sections } = useMemo(() => {
    const cells: EmojiCell[] = []
    const sections: { title: string; startIndex: number }[] = []

    const pushSection = (title: string, items: EmojiCell[]) => {
      if (items.length === 0) return
      sections.push({ title, startIndex: cells.length })
      cells.push(...items)
    }

    // Search mode: flatten matches into one section.
    if (query.trim()) {
      const q = query.toLowerCase()
      const out: EmojiCell[] = []
      for (const e of Emojis) {
        const names = e.short_names ?? [e.short_name]
        if (names.some((n) => n.toLowerCase().includes(q))) {
          out.push({ name: names[0], unified: unifiedForTone(e, skinTone), isSystem: true })
          if (out.length >= 200) break
        }
      }
      // Matching custom emojis (search by name substring).
      for (const [name, emoji] of emojiMap) {
        if (!isSystemEmoji(emoji) && name.toLowerCase().includes(q)) {
          out.push({ name, unified: '', isSystem: false, customName: name })
          if (out.length >= 240) break
        }
      }
      pushSection(t('chat.emoji.searchResults', 'Kết quả'), out)
      return { cells, sections }
    }

    // Recent emojis (if any) at the top.
    if (recent.length > 0) {
      const recents: EmojiCell[] = []
      for (const name of recent) {
        const e = emojiMap.get(name)
        if (!e) continue
        if (isSystemEmoji(e)) recents.push({ name, unified: unifiedForTone(e, skinTone), isSystem: true })
        else recents.push({ name, unified: '', isSystem: false, customName: name })
      }
      pushSection(t('chat.emoji.recent', 'Dùng gần đây'), recents)
    }

    // Custom emojis (if any) next.
    const customCells: EmojiCell[] = []
    for (const [name, emoji] of emojiMap) {
      if (!isSystemEmoji(emoji)) customCells.push({ name, unified: '', isSystem: false, customName: name })
    }
    pushSection(t('chat.emoji.custom', 'Tùy chỉnh'), customCells.slice(0, 40))

    // Standard categories.
    for (const cat of CATEGORIES) {
      const indices = getEmojiIndicesByCategory(cat.key)
      if (indices.length === 0) continue
      const items: EmojiCell[] = indices.map((idx) => {
        const e = Emojis[idx]
        const name = (e.short_names ?? [e.short_name])[0]
        return { name, unified: unifiedForTone(e, skinTone), isSystem: true }
      })
      pushSection(t(cat.labelKey, cat.label), items)
    }

    return { cells, sections }
  }, [query, skinTone, recent, t])

  // The cursor is the user's intended selection; the displayed (active) cell is
  // derived: if the stored cursor is no longer present (e.g. after a search or
  // skin-tone change), fall back to the first cell. This avoids a setState-in-
  // effect while keeping the cursor valid across cell-list changes.
  const cursorValid = cursor !== null && cells.some((c) => c.name === cursor)
  const effectiveCursor = cursorValid ? cursor : (cells[0]?.name ?? null)

  // Scroll the active (cursor) emoji into view in the grid.
  useEffect(() => {
    if (!effectiveCursor) return
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-emoji-name="${CSS.escape(effectiveCursor)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [effectiveCursor])

  const choose = useCallback((cell: EmojiCell) => {
    onSelect(cell.name)
    addRecent(cell.name)
    onClose()
  }, [onSelect, addRecent, onClose])

  // ── Keyboard grid navigation (ports handleKeyboardEmojiNavigation) ──
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (cells.length === 0) return
    const idx = effectiveCursor ? cells.findIndex((c) => c.name === effectiveCursor) : -1

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setCursor(cells[Math.min(idx + 1, cells.length - 1)].name)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (idx <= 0) { searchRef.current?.focus(); return }
      setCursor(cells[idx - 1].name)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      // Skip over any section header rows between this row and the one EMOJI_PER_ROW down.
      setCursor(cells[Math.min(idx + EMOJI_PER_ROW, cells.length - 1)].name)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx - EMOJI_PER_ROW < 0) { searchRef.current?.focus(); return }
      setCursor(cells[idx - EMOJI_PER_ROW].name)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cell = idx >= 0 ? cells[idx] : cells[0]
      if (cell) choose(cell)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [cells, effectiveCursor, choose, onClose])

  // The emoji currently under the cursor (for the preview footer).
  const previewEmoji = effectiveCursor ? cells.find((c) => c.name === effectiveCursor) : null
  const previewGlyph = previewEmoji
    ? previewEmoji.isSystem ? unifiedToUnicode(previewEmoji.unified) : null
    : null

  // Render the grid, inserting a section header before each section's start index.
  const sectionStarts = new Set(sections.map((s) => s.startIndex))
  const sectionTitleByStart = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of sections) m.set(s.startIndex, s.title)
    return m
  }, [sections])

  return (
    <div className="w-72 rounded-lg border bg-popover shadow-lg" onKeyDown={onKeyDown}>
      <div className="flex items-center gap-2 p-2 border-b">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('chat.searchEmoji', 'Tìm emoji…')}
          className="h-7 text-xs border-0 focus-visible:ring-0"
        />
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!query.trim() && (
        <div className="flex gap-0.5 px-1.5 py-1 border-b overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCat(cat.key)
                // Jump the cursor to the first emoji of this category.
                const sec = sections.find((s) => s.title === t(cat.labelKey, cat.label))
                if (sec) setCursor(cells[sec.startIndex]?.name ?? null)
              }}
              className={`shrink-0 px-2 py-1 rounded text-[10px] font-medium transition-colors ${activeCat === cat.key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
            >
              {t(cat.labelKey, cat.label)}
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="h-64">
        <div ref={gridRef} className="p-2">
          {cells.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">{t('chat.noEmoji', 'Không tìm thấy emoji')}</div>
          ) : (
            <div className="grid grid-cols-8 gap-0.5">
              {cells.map((cell, i) => (
                <div key={cell.name + i} className="contents">
                  {sectionStarts.has(i) && (
                    <div className="col-span-8 px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                      {sectionTitleByStart.get(i)}
                    </div>
                  )}
                  <EmojiCellButton
                    cell={cell}
                    active={effectiveCursor === cell.name}
                    onSelect={choose}
                    onHover={setCursor}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Skin-tone selector + preview footer (ports emoji_picker_footer). */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-t">
        {/* Preview */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {previewEmoji ? (
            previewGlyph ? (
              <span className="text-xl leading-none">{previewGlyph}</span>
            ) : previewEmoji.customName ? (
              <EmojiImg name={previewEmoji.customName} className="h-5 w-5" />
            ) : null
          ) : (
            <span className="text-xl leading-none opacity-30">🙂</span>
          )}
          <span className="text-xs text-muted-foreground truncate">
            {previewEmoji ? `:${previewEmoji.name}:` : ''}
          </span>
        </div>
        {/* Skin tones */}
        {!query.trim() && (
          <div className="flex items-center gap-0.5">
            {SKIN_TONES.map((tone) => (
              <button
                key={tone.key}
                onClick={() => setSkinTone(tone.key)}
                title={tone.label}
                className={`h-5 w-5 rounded-full flex items-center justify-center text-xs transition-transform ${skinTone === tone.key ? 'bg-muted ring-1 ring-ring scale-110' : 'hover:bg-muted/60'}`}
              >
                {tone.key === 'default' ? <span className="text-[10px]">🚫</span> : <span>{tone.glyph}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** A single emoji cell button — renders the unicode glyph (system) or image (custom). */
function EmojiCellButton({ cell, active, onSelect, onHover }: {
  cell: EmojiCell
  active: boolean
  onSelect: (cell: EmojiCell) => void
  onHover: (name: string) => void
}) {
  return (
    <button
      data-emoji-name={cell.name}
      onClick={() => onSelect(cell)}
      onMouseEnter={() => onHover(cell.name)}
      className={`h-8 w-8 rounded flex items-center justify-center text-lg leading-none ${active ? 'bg-muted ring-1 ring-ring' : 'hover:bg-muted'}`}
      title={`:${cell.name}:`}
    >
      {cell.isSystem ? (
        unifiedToUnicode(cell.unified)
      ) : cell.customName ? (
        <EmojiImg name={cell.customName} className="h-6 w-6" />
      ) : null}
    </button>
  )
}

/** Render a custom-emoji image from the server. */
function EmojiImg({ name, className }: { name: string; className?: string }) {
  const emoji = emojiMap.get(name)
  if (!emoji || isSystemEmoji(emoji)) return null
  return <img src={getEmojiImageUrl(emoji)} alt={name} className={`object-contain ${className ?? ''}`} />
}
