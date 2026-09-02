'use client'

/**
 * Emoji picker — Mattermost-style redesign, driven by the real emoji data
 * system (src/lib/chat/emoji-data).
 *
 * Layout borrows from Mattermost's emoji_picker component:
 *   - header: search input + skin-tone selector (popover) on the right
 *   - body: scrollable grid with sticky category headers (9 per row)
 *   - footer: preview bar — large glyph + :shortcode:
 *   - bottom bar: category shortcut tabs (icon buttons, MM's exact set:
 *     recent / smileys / people / animals / food / activities / travel /
 *     objects / symbols / flags) with scroll-spy highlight and smooth
 *     scroll-to-category on click
 *
 * Behavior parity with the previous port:
 *   - skin-tone preference "emoji/emoji_skintone" applied to emojis with
 *     skin_variations
 *   - recent-emoji section persisted to "emoji/recent_emojis"
 *   - keyboard grid navigation: arrows move the cursor, Enter selects, the
 *     active emoji scrolls into view; Escape closes
 *
 * The selected emoji is returned by short_name (for reactions) or :shortcode:.
 */

import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Emojis, getEmojiIndicesByCategory, unifiedToUnicode, emojiMap,
  getEmojiImageUrl, isSystemEmoji, isServerCustomEmoji, type SystemEmoji,
} from '@/lib/chat/emoji-data'
import { useCustomEmojis, useSkinTone, useRecentEmojis, useCurrentUserId } from '@/lib/chat/hooks'
import { useTranslation } from '@/lib/i18n'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

// Standard category order (mirrors the picker's EMOJI_CATEGORIES, minus
// recent/searchResults/custom which are handled specially). Each category has
// the Mattermost shortcut icon shown in the bottom tab bar.
const CATEGORIES: { key: string; labelKey: string; label: string; icon: string }[] = [
  { key: 'smileys-emotion', labelKey: 'chat.emoji.smileys', label: 'Cảm xúc', icon: '😀' },
  { key: 'people-body', labelKey: 'chat.emoji.people', label: 'Con người', icon: '👋' },
  { key: 'animals-nature', labelKey: 'chat.emoji.animals', label: 'Động vật', icon: '🐻' },
  { key: 'food-drink', labelKey: 'chat.emoji.food', label: 'Đồ ăn', icon: '🍔' },
  { key: 'travel-places', labelKey: 'chat.emoji.travel', label: 'Du lịch', icon: '🚌' },
  { key: 'activities', labelKey: 'chat.emoji.activities', label: 'Hoạt động', icon: '⚽' },
  { key: 'objects', labelKey: 'chat.emoji.objects', label: 'Đồ vật', icon: '💡' },
  { key: 'symbols', labelKey: 'chat.emoji.symbols', label: 'Ký hiệu', icon: '❤️' },
  { key: 'flags', labelKey: 'chat.emoji.flags', label: 'Cờ', icon: '🏁' },
]

// Skin-tone options (Fitzpatrick scale). 'default' = no skin tone modifier.
const SKIN_TONES: { key: string; label: string; glyph: string }[] = [
  { key: 'default', label: 'Mặc định', glyph: '✋' },
  { key: '1F3FB', label: 'Sáng', glyph: '🏻' },
  { key: '1F3FC', label: 'Sáng vừa', glyph: '🏼' },
  { key: '1F3FD', label: 'Trung bình', glyph: '🏽' },
  { key: '1F3FE', label: 'Sâu', glyph: '🏾' },
  { key: '1F3FF', label: 'Tối', glyph: '🏿' },
]

const EMOJI_PER_ROW = 9 // grid-cols-9 (Mattermost density)

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
  const [toneOpen, setToneOpen] = useState(false)
  const { skinTone, setSkinTone } = useSkinTone(userId)
  const { recent, addRecent } = useRecentEmojis(userId)
  useCustomEmojis()

  // Keyboard cursor (a stable key like `${name}`) for grid navigation.
  const [cursor, setCursor] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())
  const spyGuard = useRef(0)

  // Focus the search input on mount (ports the picker's requestAnimationFrame focus).
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Build the flat, ordered list of emoji cells actually shown in the grid.
  // Sections are: [recent?, custom?, category1, category2, ...] — each rendered
  // with a header (and data-section anchor for scroll-to-category + scroll-spy).
  const { cells, sections } = useMemo(() => {
    const cells: EmojiCell[] = []
    const sections: { key: string; title: string; startIndex: number }[] = []

    const pushSection = (key: string, title: string, items: EmojiCell[]) => {
      if (items.length === 0) return
      sections.push({ key, title, startIndex: cells.length })
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
      // Matching custom emojis (search by name substring) — only ones that
      // actually exist on the server (skips the static "mattermost" placeholder,
      // which would 404 as a reaction).
      for (const [name, emoji] of emojiMap) {
        if (!isServerCustomEmoji(emoji)) continue
        if (name.toLowerCase().includes(q)) {
          out.push({ name, unified: '', isSystem: false, customName: name })
          if (out.length >= 240) break
        }
      }
      pushSection('search', t('chat.emoji.searchResults', 'Kết quả'), out)
      return { cells, sections }
    }

    // Recent emojis (if any) at the top.
    if (recent.length > 0) {
      const recents: EmojiCell[] = []
      for (const name of recent) {
        const e = emojiMap.get(name)
        if (!e) continue
        if (isSystemEmoji(e)) recents.push({ name, unified: unifiedForTone(e, skinTone), isSystem: true })
        else if (isServerCustomEmoji(e)) recents.push({ name, unified: '', isSystem: false, customName: name })
      }
      pushSection('recent', t('chat.emoji.recent', 'Dùng gần đây'), recents)
    }

    // Custom emojis (if any) next — only server-defined ones (the static
    // "mattermost" placeholder is not reactable and renders a broken image).
    const customCells: EmojiCell[] = []
    for (const [name, emoji] of emojiMap) {
      if (isServerCustomEmoji(emoji)) customCells.push({ name, unified: '', isSystem: false, customName: name })
    }
    pushSection('custom', t('chat.emoji.custom', 'Tùy chỉnh'), customCells.slice(0, 40))

    // Standard categories.
    for (const cat of CATEGORIES) {
      const indices = getEmojiIndicesByCategory(cat.key)
      if (indices.length === 0) continue
      const items: EmojiCell[] = indices.map((idx) => {
        const e = Emojis[idx]
        const name = (e.short_names ?? [e.short_name])[0]
        return { name, unified: unifiedForTone(e, skinTone), isSystem: true }
      })
      pushSection(cat.key, t(cat.labelKey, cat.label), items)
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
    if (e.key === 'Escape') {
      e.preventDefault()
      if (toneOpen) { setToneOpen(false); return }
      onClose()
      return
    }
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
      setCursor(cells[Math.min(idx + EMOJI_PER_ROW, cells.length - 1)].name)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx - EMOJI_PER_ROW < 0) { searchRef.current?.focus(); return }
      setCursor(cells[idx - EMOJI_PER_ROW].name)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cell = idx >= 0 ? cells[idx] : cells[0]
      if (cell) choose(cell)
    }
  }, [cells, effectiveCursor, choose, onClose, toneOpen])

  // The emoji currently under the cursor (for the preview footer).
  const previewEmoji = effectiveCursor ? cells.find((c) => c.name === effectiveCursor) : null
  const previewGlyph = previewEmoji
    ? previewEmoji.isSystem ? unifiedToUnicode(previewEmoji.unified) : null
    : null

  // Scroll-spy: while scrolling the grid, highlight the tab of the section
  // closest to the top of the viewport. (Reading spyGuard inside the handler
  // — not during render — suppresses spy right after a programmatic jump.)
  const onGridScroll = useCallback(() => {
    if (query.trim() || Date.now() <= spyGuard.current) return
    const container = scrollRef.current
    if (!container) return
    const top = container.scrollTop
    let current = sections[0]?.key ?? activeCat
    for (const s of sections) {
      const el = sectionRefs.current.get(s.key)
      if (el && el.offsetTop - 44 <= top) current = s.key
    }
    if (current !== activeCat) setActiveCat(current)
  }, [query, sections, activeCat])

  // Click a category tab → smooth-scroll to that section (suppress spy briefly).
  const goToCategory = useCallback((key: string) => {
    const el = sectionRefs.current.get(key)
    if (!el) return
    spyGuard.current = Date.now() + 600
    setActiveCat(key)
    // Scroll so the section header sits just below the header bar.
    scrollRef.current?.scrollTo({ top: Math.max(0, el.offsetTop - 4), behavior: 'smooth' })
    // Move the cursor to the first emoji of this category.
    const sec = sections.find((s) => s.key === key)
    if (sec) setCursor(cells[sec.startIndex]?.name ?? null)
  }, [sections, cells])

  // Render the grid, inserting a section header before each section's start index.
  const sectionStarts = useMemo(() => new Set(sections.map((s) => s.startIndex)), [sections])
  const sectionByKey = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of sections) m.set(s.startIndex, s.key)
    return m
  }, [sections])

  const activeTone = SKIN_TONES.find((tone) => tone.key === skinTone) ?? SKIN_TONES[0]

  return (
    <div
      className="w-[26rem] max-w-[calc(100vw-2rem)] rounded-xl border bg-popover shadow-2xl overflow-hidden select-none"
      onKeyDown={onKeyDown}
    >
      {/* ── Header: search + skin tone ── */}
      <div className="relative flex items-center gap-1.5 p-2 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chat.searchEmoji', 'Tìm emoji…')}
            className="h-8 pl-8 text-xs rounded-lg"
          />
        </div>
        <button
          type="button"
          onClick={() => setToneOpen(!toneOpen)}
          title={t('chat.emoji.skinTone', 'Tông màu da')}
          className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-base transition-colors ${toneOpen ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted'}`}
        >
          <span className="leading-none">{activeTone.glyph}</span>
        </button>
        {toneOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setToneOpen(false)} />
            <div className="absolute right-2 top-full mt-1 z-50 flex items-center gap-1 rounded-lg border bg-popover shadow-lg p-1.5">
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone.key}
                  type="button"
                  onClick={() => { setSkinTone(tone.key); setToneOpen(false) }}
                  title={tone.label}
                  className={`h-7 w-7 rounded-md flex items-center justify-center text-sm transition-all ${skinTone === tone.key ? 'bg-primary/15 ring-1 ring-primary/50 scale-110' : 'hover:bg-muted'}`}
                >
                  {tone.key === 'default' ? '✋' : tone.glyph}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Body: emoji grid with sticky section headers ── */}
      <div ref={scrollRef} onScroll={onGridScroll} className="h-64 overflow-y-auto overscroll-contain custom-scrollbar">
        <div ref={gridRef} className="pb-1">
          {cells.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">{t('chat.noEmoji', 'Không tìm thấy emoji')}</div>
          ) : (
            <div className="grid grid-cols-9 gap-0.5 px-1.5 pt-1.5">
              {cells.map((cell, i) => (
                <div key={cell.name + i} className="contents">
                  {sectionStarts.has(i) && (
                    <div
                      ref={(el) => { if (el) sectionRefs.current.set(sectionByKey.get(i) ?? '', el) }}
                      className="col-span-9 sticky top-0 z-10 -mx-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80 bg-popover/95 backdrop-blur-sm border-b border-border/40"
                    >
                      {sections.find((s) => s.startIndex === i)?.title}
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
      </div>

      {/* ── Footer: preview ── */}
      <div className="flex items-center gap-2.5 px-3 py-2 border-t bg-muted/30">
        <div className="h-8 w-8 rounded-lg bg-background border flex items-center justify-center shrink-0">
          {previewEmoji ? (
            previewGlyph ? (
              <span className="text-xl leading-none">{previewGlyph}</span>
            ) : previewEmoji.customName ? (
              <EmojiImg name={previewEmoji.customName} className="h-5 w-5" />
            ) : null
          ) : (
            <span className="text-xl leading-none opacity-30">🙂</span>
          )}
        </div>
        <span className="text-xs font-medium text-muted-foreground truncate">
          {previewEmoji ? `:${previewEmoji.name}:` : ''}
        </span>
      </div>

      {/* ── Bottom bar: category shortcut tabs (Mattermost style) ── */}
      {!query.trim() && (
        <div className="flex items-center justify-around px-1.5 py-1 border-t">
          {recent.length > 0 && (
            <CategoryTab
              icon="🕘"
              label={t('chat.emoji.recent', 'Dùng gần đây')}
              active={activeCat === 'recent'}
              onClick={() => goToCategory('recent')}
            />
          )}
          {CATEGORIES.map((cat) => (
            <CategoryTab
              key={cat.key}
              icon={cat.icon}
              label={t(cat.labelKey, cat.label)}
              active={activeCat === cat.key}
              onClick={() => goToCategory(cat.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** A bottom-bar category shortcut tab. */
function CategoryTab({ icon, label, active, onClick }: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative h-8 w-8 rounded-lg flex items-center justify-center text-lg leading-none transition-all press-effect ${active
        ? 'bg-primary/12 text-foreground'
        : 'hover:bg-muted text-muted-foreground'
        }`}
    >
      <span className="leading-none">{icon}</span>
      {active && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary" />}
    </button>
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
      type="button"
      data-emoji-name={cell.name}
      onClick={() => onSelect(cell)}
      onMouseEnter={() => onHover(cell.name)}
      className={`h-8 w-8 rounded-md flex items-center justify-center text-lg leading-none transition-colors ${active ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-primary/10'}`}
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
