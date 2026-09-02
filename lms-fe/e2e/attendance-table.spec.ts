import { test, expect } from '@playwright/test'
import { mockAuth, mockEverythingElse, paginated, wireStudent, wireClass, json, ADMIN_USER } from './fixtures'

/**
 * E2E — Admin Attendance screen: interactive marking table (client-mode
 * DataTable) — mark buttons, status badges, search filter.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

async function setupAttendancePage(page: import('@playwright/test').Page) {
  await mockAuth(page, ADMIN_USER)
  mockEverythingElse(page)
  await page.route('**/api/v4/lms/classes', (route) =>
    json(route, paginated([wireClass({ id: 'c1', status: 'ACTIVE', name: 'IELTS 6.5 Morning' })]))
  )
  await page.route('**/api/v4/lms/sessions', (route) =>
    json(route, paginated([{ id: 'sess1', class_id: 'c1', date: '2026-09-01', title: 'Session 1' }]))
  )
  // Roster: POST /lms/students with class_id
  await page.route('**/api/v4/lms/students', (route) =>
    json(
      route,
      paginated([
        wireStudent({ id: 's1', user_id: 's1', firstname: 'Nguyễn', lastname: 'An' }),
        wireStudent({ id: 's2', user_id: 's2', firstname: 'Trần', lastname: 'Bình' }),
        wireStudent({ id: 's3', user_id: 's3', firstname: 'Lê', lastname: 'Cường' }),
      ])
    )
  )
  // No saved attendance yet (bare array response).
  await page.route('**/api/v4/lms/sessions/sess1/attendance**', (route) => json(route, []))

  await page.goto('/#lms_admin/attendance')
  // Pick the class in the selector (classes query is mocked with one class).
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: /ielts 6\.5 morning/i }).click()
  await expect(page.locator('[data-slot="table-body"] tr').first()).toBeVisible({ timeout: 30_000 })
}

test('renders the roster defaulted to PRESENT with marking buttons', async ({ page }) => {
  await setupAttendancePage(page)
  await expect(page.locator('[data-slot="table-body"] tr')).toHaveCount(3)
  // Default status is "Có mặt" (PRESENT) for everyone
  await expect(page.getByText('Có mặt').first()).toBeVisible()
  // Each row has 6 marking option buttons
  const firstRow = page.locator('[data-slot="table-body"] tr').first()
  await expect(firstRow.getByRole('button')).toHaveCount(6)
})

test('marking a student updates the status badge immediately', async ({ page }) => {
  await setupAttendancePage(page)
  const firstRow = page.locator('[data-slot="table-body"] tr').first()
  // Mark the first student "Vắng không phép"
  await firstRow.getByRole('button', { name: 'Vắng không phép' }).click()
  await expect(firstRow.locator('[data-slot="badge"]')).toHaveText('Vắng không phép')
  // Other rows are unaffected
  const secondRow = page.locator('[data-slot="table-body"] tr').nth(1)
  await expect(secondRow.locator('[data-slot="badge"]')).toHaveText('Có mặt')
})

test('mark-all buttons flip the whole roster', async ({ page }) => {
  await setupAttendancePage(page)
  // Mark-all button (VI locale: "Vắng mặt") — distinct from per-row options.
  await page.getByRole('button', { name: 'Vắng mặt' }).click()
  const badges = page.locator('[data-slot="table-body"] [data-slot="badge"]')
  await expect(badges).toHaveCount(3)
  for (let i = 0; i < 3; i++) {
    await expect(badges.nth(i)).toHaveText('Vắng không phép')
  }
})

test('toolbar search filters the roster client-side', async ({ page }) => {
  await setupAttendancePage(page)
  const search = page.locator('[data-slot="table-search"] input')
  await search.fill('Bình')
  await expect(page.locator('[data-slot="table-body"] tr')).toHaveCount(1)
  await expect(page.locator('[data-slot="table-body"] tr').first()).toContainText('Bình')
})
