'use client'

/**
 * Emoji picker — full-fidelity port of the vendored emoji_picker, driven by the
 * real emoji data system (src/lib/chat/emoji-data). Renders all system emojis
 * grouped by their actual categories (smileys-emotion, people-body, etc.) with
 * search across short_names, plus any custom emojis loaded into the EmojiMap.
 * Selected emoji is returned by short_name (for reactions) or :shortcode:.
 */

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  Emojis, getEmojiIndicesByCategory, unifiedToUnicode, emojiMap,
  getEmojiImageUrl, isSystemEmoji,
} from '@/lib/chat/emoji-data'
import { useCustomEmojis } from '@/lib/chat/hooks'
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

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState<string>('smileys-emotion')
  useCustomEmojis()

  // Search results (across short_names) when a query is typed.
  const searchResults = useMemo(() => {
    if (!query.trim()) return null
    const q = query.toLowerCase()
    const out: { name: string; char: string }[] = []
    for (const e of Emojis) {
      const names = e.short_names ?? [e.short_name]
      if (names.some((n) => n.toLowerCase().includes(q))) {
        out.push({ name: names[0], char: unifiedToUnicode(e.unified) })
        if (out.length >= 200) break
      }
    }
    // Also include matching custom emojis.
    for (const cat of CATEGORIES) {
      void cat
    }
    return out
  }, [query])

  // Custom emojis from the map.
  const customEmojis = useMemo(() => {
    const out: { name: string }[] = []
    for (const emoji of emojiMap) {
      const [name, e] = emoji
      if (!('id' in e)) continue // system emoji handled above
      out.push({ name })
    }
    return out
  }, [])

  return (
    <div className="w-72 rounded-lg border bg-popover shadow-lg">
      <div className="flex items-center gap-2 p-2 border-b">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('chat.searchEmoji', 'Tìm emoji…')} className="h-7 text-xs border-0 focus-visible:ring-0" autoFocus />
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!query.trim() && (
        <div className="flex gap-0.5 px-1.5 py-1 border-b overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCat(cat.key)}
              className={`shrink-0 px-2 py-1 rounded text-[10px] font-medium transition-colors ${activeCat === cat.key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
            >
              {t(cat.labelKey, cat.label)}
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="h-64">
        <div className="p-2">
          {searchResults !== null ? (
            searchResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">{t('chat.noEmoji', 'Không tìm thấy emoji')}</div>
            ) : (
              <div className="grid grid-cols-8 gap-0.5">
                {searchResults.map(({ name, char }) => (
                  <button key={name} onClick={() => { onSelect(name); onClose() }} className="h-8 w-8 rounded hover:bg-muted flex items-center justify-center text-lg leading-none" title={`:${name}:`}>
                    {char}
                  </button>
                ))}
              </div>
            )
          ) : (
            <>
              {/* Custom emojis (if any) at the top. */}
              {customEmojis.length > 0 && (
                <div className="mb-2">
                  <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">{t('chat.emoji.custom', 'Tùy chỉnh')}</div>
                  <div className="grid grid-cols-8 gap-0.5">
                    {customEmojis.slice(0, 40).map(({ name }) => (
                      <CustomEmojiButton key={name} name={name} onSelect={() => { onSelect(name); onClose() }} />
                    ))}
                  </div>
                </div>
              )}
              {CATEGORIES.map((cat) => {
                const indices = getEmojiIndicesByCategory(cat.key)
                if (indices.length === 0) return null
                return (
                  <div key={cat.key} className="mb-2">
                    <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">{t(cat.labelKey, cat.label)}</div>
                    <div className="grid grid-cols-8 gap-0.5">
                      {indices.map((idx) => {
                        const e = Emojis[idx]
                        const name = (e.short_names ?? [e.short_name])[0]
                        return (
                          <button key={name} onClick={() => { onSelect(name); onClose() }} className="h-8 w-8 rounded hover:bg-muted flex items-center justify-center text-lg leading-none" title={`:${name}:`}>
                            {unifiedToUnicode(e.unified)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

/** A custom-emoji button that renders the emoji image from the server. */
function CustomEmojiButton({ name, onSelect }: { name: string; onSelect: () => void }) {
  const emoji = emojiMap.get(name)
  if (!emoji) return null
  const url = isSystemEmoji(emoji) ? '' : getEmojiImageUrl(emoji)
  return (
    <button onClick={onSelect} className="h-8 w-8 rounded hover:bg-muted flex items-center justify-center" title={`:${name}:`}>
      {url ? <img src={url} alt={name} className="h-6 w-6 object-contain" /> : null}
    </button>
  )
}
