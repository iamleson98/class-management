/**
 * View router tests — every (role, view) the nav config exposes must render
 * (never fall through to NotFound), keeping nav and router in sync.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { renderView } from './view-router'
import { NAV_MAP } from './nav-config'

// Dynamic imports render <LoadingView/> until chunks resolve; a missing
// mapping renders the NotFound heading instead. Assert on the DOM text.
const text = (ui: React.ReactElement) => {
        const { container } = render(ui)
        return container.textContent ?? ''
}

describe('renderView', () => {
        for (const [role, items] of Object.entries(NAV_MAP)) {
                it(`renders every ${role} nav view without falling to NotFound`, () => {
                        for (const item of items) {
                                const rendered = text(renderView(role, item.id as string))
                                expect(rendered).not.toContain('Trang không tồn tại')
                        }
                })
        }

        it('renders NotFound for an unknown view', () => {
                expect(text(renderView('lms_admin', 'nope'))).toContain('Trang không tồn tại')
        })

        it('renders NotFound for an unknown role', () => {
                expect(text(renderView('stranger', 'dashboard'))).toContain('Trang không tồn tại')
        })
})
