/**
 * Tests for the shared chat reaction components:
 *  - QuickReactionBar: the hover bar with popular reaction icons that hugs the
 *    message bubble. Pins the quick set, toggle wiring, and the extended emoji
 *    popover (open → select → close).
 *  - ReactionPills: grouped reaction chips under the message — counts, and the
 *    click-to-toggle behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { QuickReactionBar, ReactionPills, QUICK_EMOJIS } from '@/features/chat/reactions'
import { useChatStore } from '@/lib/chat/store'

function emojiButtons() {
  return screen.getAllByRole('button').filter((b) => (b.getAttribute('title') ?? '').startsWith(':'))
}

describe('QuickReactionBar', () => {
  afterEach(cleanup)

  it('renders three inline quick emojis plus the picker trigger', () => {
    render(<QuickReactionBar onToggle={vi.fn()} align="start" emojiOpen={false} onEmojiOpenChange={vi.fn()} />)
    // 3 inline quick buttons (shortcode titles) + the picker trigger button.
    expect(emojiButtons().length).toBe(3)
    expect(screen.getByTitle('Thêm cảm xúc')).toBeTruthy()
  })

  it('toggles a quick reaction with the Mattermost shortcode name', () => {
    const onToggle = vi.fn()
    render(<QuickReactionBar onToggle={onToggle} align="end" emojiOpen={false} onEmojiOpenChange={vi.fn()} />)
    fireEvent.click(emojiButtons()[0])
    expect(onToggle).toHaveBeenCalledWith(QUICK_EMOJIS[0])
  })

  it('picker opens via the controlled prop, offers the full set, and closes after selecting', () => {
    const onToggle = vi.fn()
    const onEmojiOpenChange = vi.fn()
    // Open the picker through the trigger (controlled open state flows up).
    const { rerender } = render(
      <QuickReactionBar onToggle={onToggle} align="start" emojiOpen={false} onEmojiOpenChange={onEmojiOpenChange} />,
    )
    fireEvent.click(screen.getByTitle('Thêm cảm xúc'))
    expect(onEmojiOpenChange).toHaveBeenCalledWith(true)

    rerender(
      <QuickReactionBar onToggle={onToggle} align="start" emojiOpen onEmojiOpenChange={onEmojiOpenChange} />,
    )
    // 3 inline quicks + QUICK_EMOJIS.length popover entries all carry titles.
    expect(emojiButtons().length).toBe(3 + QUICK_EMOJIS.length)

    // Selecting from the popover toggles the reaction AND reports close.
    fireEvent.click(screen.getByTitle(`:${QUICK_EMOJIS[QUICK_EMOJIS.length - 1]}:`))
    expect(onToggle).toHaveBeenCalledWith(QUICK_EMOJIS[QUICK_EMOJIS.length - 1])
    expect(onEmojiOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('ReactionPills', () => {
  beforeEach(() => {
    useChatStore.setState({ reactionsByPost: {} })
  })
  afterEach(cleanup)

  it('groups reactions by emoji and shows the count; clicking toggles', () => {
    useChatStore.setState({
      reactionsByPost: {
        p1: [
          { user_id: 'u1', post_id: 'p1', emoji_name: '+1' } as any,
          { user_id: 'u2', post_id: 'p1', emoji_name: '+1' } as any,
          { user_id: 'u1', post_id: 'p1', emoji_name: 'tada' } as any,
        ],
      },
    })
    const onToggle = vi.fn()
    render(<ReactionPills postId="p1" onToggle={onToggle} />)

    const plus = screen.getByTitle(':+1:')
    expect(plus.textContent).toContain('2')
    const tada = screen.getByTitle(':tada:')
    expect(tada.textContent).toContain('1')

    fireEvent.click(plus)
    expect(onToggle).toHaveBeenCalledWith('+1')
  })

  it('renders nothing for a post without reactions', () => {
    const { container } = render(<ReactionPills postId="missing" onToggle={vi.fn()} />)
    expect(container.textContent).toBe('')
  })
})
