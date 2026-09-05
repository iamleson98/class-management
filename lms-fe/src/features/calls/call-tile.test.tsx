/**
 * call-tile — unit tests for the visual/interaction contract of the restyled
 * participant tile: speaking ring, pin toggle, presenting badge, mute/hand
 * indicators and the self-view label.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CallTile } from './call-tile'
import type { CallSession } from './calls-store'

function session(overrides: Partial<CallSession> = {}): CallSession {
	return {
		sessionId: 'sess1',
		userId: 'user1',
		unmuted: true,
		raisedHand: 0,
		video: false,
		voice: false,
		screenOn: false,
		isHost: false,
		...overrides,
	}
}

describe('CallTile', () => {
	it('renders the display name and the self label for the local participant', () => {
		render(
			<CallTile session={session()} displayName="Minh Sơn" isSelf mirror={false} />,
		)
		expect(screen.getByText(/Minh Sơn/)).toBeInTheDocument()
		expect(screen.getByText(/Bạn/)).toBeInTheDocument()
	})

	it('marks speaking tiles (data-speaking) for the active-speaker ring', () => {
		const { container } = render(
			<CallTile session={session({ voice: true })} displayName="A" isSelf={false} mirror={false} />,
		)
		expect(container.querySelector('[data-speaking]')).not.toBeNull()
	})

	it('marks presenting tiles (data-presenting) for the filmstrip badge', () => {
		const { container } = render(
			<CallTile session={session()} displayName="A" isSelf={false} mirror={false} presenting />,
		)
		expect(container.querySelector('[data-presenting]')).not.toBeNull()
	})

	it('shows the pin button only when pinning is available and reports toggles', () => {
		const onTogglePin = vi.fn()
		const { rerender } = render(
			<CallTile session={session()} displayName="A" isSelf={false} mirror={false} onTogglePin={onTogglePin} />,
		)
		const pin = screen.getByRole('button', { name: 'Ghim' })
		fireEvent.click(pin)
		expect(onTogglePin).toHaveBeenCalledWith('sess1')

		rerender(
			<CallTile session={session()} displayName="A" isSelf={false} mirror={false} pinned onTogglePin={onTogglePin} />,
		)
		expect(screen.getByRole('button', { name: 'Bỏ ghim' })).toBeInTheDocument()
	})

	it('hides the pin affordance entirely when no handler is passed', () => {
		render(<CallTile session={session()} displayName="A" isSelf={false} mirror={false} />)
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('surfaces mute and raised-hand indicators', () => {
		render(
			<CallTile
				session={session({ unmuted: false, raisedHand: 1234, isHost: true })}
				displayName="A"
				isSelf={false}
				mirror={false}
			/>,
		)
		expect(screen.getByLabelText('Đã tắt tiếng')).toBeInTheDocument()
		expect(screen.getByLabelText('Giơ tay')).toBeInTheDocument()
		expect(screen.getByLabelText('chủ trì')).toBeInTheDocument()
	})
})
