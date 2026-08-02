'use client'

/**
 * Cross-browser auto-resize for the composer textarea.
 *
 * The shadcn `<Textarea>` relies on the CSS `field-sizing-content` property to
 * grow with its content — but that is currently Chrome 123+ only (no Firefox,
 * no Safari). This hook ports the vendored webapp's `AutosizeTextarea` behavior:
 * on every value change it collapses the textarea to `auto`, measures the
 * `scrollHeight`, and sets an explicit pixel height clamped to `maxHeight`.
 *
 * On browsers that support `field-sizing-content` the explicit height set here
 * is harmless (the CSS still governs; the JS value just matches it), so it's a
 * safe progressive-enhancement fallback.
 */

import { useEffect, type RefObject } from 'react'

interface Options {
  /** Minimum height in px (matches the composer's `min-h-9` = 36px). */
  minHeight?: number
  /** Maximum height in px (matches the composer's `max-h-32` = 128px). */
  maxHeight?: number
}

/**
 * Resize the passed textarea to fit its content whenever `value` changes.
 * Pass the textarea ref and the controlled value.
 */
export function useAutosizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  { minHeight = 36, maxHeight = 128 }: Options = {},
): void {
  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    // Collapse first so scrollHeight measures the natural content height.
    ta.style.height = 'auto'
    const next = Math.min(Math.max(ta.scrollHeight, minHeight), maxHeight)
    ta.style.height = `${next}px`
    // Show a scrollbar only once the max height is exceeded.
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [ref, value, minHeight, maxHeight])
}
