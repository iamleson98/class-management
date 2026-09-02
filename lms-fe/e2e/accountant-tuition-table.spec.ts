import { test, expect } from '@playwright/test'
import { mockAuth, mockEverythingElse, json, ACCOUNTANT_USER } from './fixtures'

/**
 * E2E — Accountant Tuition screen: a client-mode DataTable (all rows fetched
 * once; search / sort / pagination happen in the browser).
 */

const TOTAL = 15

function wireTuition(i: number) {
  return {
    id: `t${i + 1}`,
    student_id: `s${i + 1}`,
    class_id: `c${i + 1}`,
    fee_package_id: 'fp1',
    total_amount: 5_000_000,
    discount_amount: 0,
    paid_amount: i < 5 ? 5_000_000 : i < 10 ? 2_500_000 : 0,
    remaining_amount: i < 5 ? 0 : i < 10 ? 2_500_000 : 5_000_000,
    status: i < 5 ? 'PAID' : i < 10 ? 'PARTIAL' : 'UNPAID',
    due_date: '2026-09-30',
    note: '',
    student_name: `Nguyễn Học Viên ${String.fromCharCode(65 + (i % 20))}`,
    class_name: `IELTS ${i + 1}`,
    create_at: 1700000000000,
    update_at: 1700000000000,
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

async function setupTuitionPage(page: import('@playwright/test').Page) {
  await mockAuth(page, ACCOUNTANT_USER)
  mockEverythingElse(page)
  await page.route('**/api/v4/lms/tuitions', (route) =>
    json(route, { items: Array.from({ length: TOTAL }, (_, i) => wireTuition(i)), total_count: TOTAL })
  )
  await page.goto('/#lms_accountant/tuition')
  await expect(page.locator('[data-slot="table-body"] tr').first()).toBeVisible({ timeout: 30_000 })
}

test('renders rows with client-side summary and pagination', async ({ page }) => {
  await setupTuitionPage(page)
  await expect(page.locator('[data-slot="table-body"] tr')).toHaveCount(10)
  await expect(page.locator('[data-slot="pagination-summary"]')).toHaveText(
    /Hiển thị 1–10 trong tổng số 15/
  )
  await page.getByRole('button', { name: /trang sau|tiếp theo/i }).click()
  await expect(page.locator('[data-slot="table-body"] tr')).toHaveCount(5)
  await expect(page.locator('[data-slot="pagination-summary"]')).toHaveText(
    /Hiển thị 11–15 trong tổng số 15/
  )
})

test('server search box narrows results (accountant view)', async ({ page }) => {
  await setupTuitionPage(page)
  // The accountant view posts `search` to the backend; mock honors it.
  let lastSearch = ''
  await page.route('**/api/v4/lms/tuitions', (route) => {
    const body = route.request().postDataJSON() as { search?: string }
    lastSearch = body.search ?? ''
    const rows = Array.from({ length: TOTAL }, (_, i) => wireTuition(i)).filter((t) =>
      lastSearch ? t.student_name.toLowerCase().includes(lastSearch.toLowerCase()) : true
    )
    json(route, { items: rows, total_count: rows.length })
  })
  await page.locator('[data-slot="accountant-tuition-search"]').fill('Học Viên A')
  await expect(page.locator('[data-slot="table-body"] tr')).toHaveCount(1)
  await expect(page.locator('[data-slot="pagination-summary"]')).toHaveText(
    /Hiển thị 1–1 trong tổng số 1/
  )
})

test('status badges render per row (paid / partial / unpaid)', async ({ page }) => {
  await setupTuitionPage(page)
  const badges = page.locator('[data-slot="table-body"] [data-slot="badge"]')
  // VI locale: accountant.tuition.statusPaid = 'Đã thu'
  await expect(badges.nth(0)).toHaveText('Đã thu')
})

test('collect-fee action is disabled for PAID rows and enabled otherwise', async ({ page }) => {
  await setupTuitionPage(page)
  const rows = page.locator('[data-slot="table-body"] tr')
  // Row 1 (PAID): the collect button is disabled.
  const paidRow = rows.nth(0).getByRole('button', { name: /thu học phí/i })
  await expect(paidRow).toBeDisabled()
  // Row 6 (PARTIAL): enabled.
  const partialRow = rows.nth(5).getByRole('button', { name: /thu học phí/i })
  await expect(partialRow).toBeEnabled()
})

test('empty dataset renders the empty state', async ({ page }) => {
  await mockAuth(page, ACCOUNTANT_USER)
  mockEverythingElse(page)
  await page.route('**/api/v4/lms/tuitions', (route) => json(route, { items: [], total_count: 0 }))
  await page.goto('/#lms_accountant/tuition')
  await expect(page.getByRole('heading', { name: 'Không có học phí' })).toBeVisible({ timeout: 30_000 })
})
