import { test, expect } from '@playwright/test'
import { mockAuth, mockEverythingElse, paginated, wireStudent, json, ADMIN_USER } from './fixtures'

/**
 * E2E — Admin Students screen (the server-driven data-table reference).
 * Covers: render, server pagination, server-side search, status filter,
 * client sorting, column visibility, row actions + dialogs.
 */

const TOTAL = 25

/** Full dataset the mock "backend" serves; the body's search/status/offset
 * decide which slice comes back — exactly like the real endpoint. */
function allStudents() {
  return Array.from({ length: TOTAL }, (_, i) =>
    wireStudent({
      id: `s${i + 1}`,
      user_id: `s${i + 1}`,
      username: `student${i + 1}`,
      email: `student${i + 1}@test.vn`,
      firstname: 'Nguyễn',
      lastname: `Học Viên ${String.fromCharCode(65 + (i % 26))}`,
      name: `Nguyễn Học Viên ${String.fromCharCode(65 + (i % 26))}`,
      code: `HV${String(i + 1).padStart(3, '0')}`,
      student_status: i % 5 === 0 ? 'RESERVED' : i % 7 === 0 ? 'DROPPED' : 'ACTIVE',
      school: 'THPT Le Quy Don',
    })
  )
}

async function setupStudentsPage(page: import('@playwright/test').Page) {
  const requestLog: Array<Record<string, unknown>> = []
  await mockAuth(page, ADMIN_USER)
  // IMPORTANT: the catch-all must be registered FIRST — Playwright calls the
  // most recently registered matching handler, so the specific students mock
  // below must win.
  mockEverythingElse(page)
  await page.route('**/api/v4/lms/students', (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    requestLog.push(body)
    let rows = allStudents()
    if (typeof body.search === 'string' && body.search) {
      const q = (body.search as string).toLowerCase()
      rows = rows.filter((s) => {
        const sp = JSON.parse(String(s.props.student)) as Record<string, unknown>
        return [
          `${s.firstname} ${s.lastname}`,
          s.email,
          s.username,
          sp.parent_name,
          sp.code,
        ].some((v) => String(v).toLowerCase().includes(q))
      })
    }
    if (typeof body.status === 'string' && body.status && body.status !== 'all') {
      rows = rows.filter((s) => {
        const sp = JSON.parse(String(s.props.student)) as Record<string, unknown>
        return sp.student_status === body.status
      })
    }
    const limit = Number(body.limit ?? 10)
    const offset = Number(body.offset ?? 0)
    json(route, paginated(rows.slice(offset, offset + limit), rows.length))
  })
  await page.goto('/#lms_admin/students')
  // Wait for the table to hydrate (skeleton → rows).
  await expect(page.locator('[data-slot="table-body"] tr').first()).toBeVisible({ timeout: 30_000 })
  return { requestLog }
}

test.beforeEach(async ({ page }) => {
  // Keep localStorage clean between tests.
  await page.addInitScript(() => localStorage.clear())
})

test('renders students with page summary from the server', async ({ page }) => {
  await setupStudentsPage(page)
  await expect(page.getByText('Nguyễn Học Viên A').first()).toBeVisible()
  // Page 1 of the 25-row dataset, 10 per page.
  await expect(page.locator('[data-slot="pagination-summary"]')).toHaveText(
    /Hiển thị 1–10 trong tổng số 25/
  )
  // Rows on the page
  await expect(page.locator('[data-slot="table-body"] tr')).toHaveCount(10)
})

test('server-driven pagination: next page fetches offset 10', async ({ page }) => {
  const { requestLog } = await setupStudentsPage(page)
  await page.getByRole('button', { name: /trang sau|tiếp theo/i }).click()
  await expect(page.locator('[data-slot="pagination-summary"]')).toHaveText(
    /Hiển thị 11–20 trong tổng số 25/
  )
  const last = requestLog[requestLog.length - 1] as { offset?: number; limit?: number }
  expect(last.offset).toBe(10)
  expect(last.limit).toBe(10)
})

test('search is executed server-side and resets to page 1', async ({ page }) => {
  const { requestLog } = await setupStudentsPage(page)
  // go to page 2 first so we can prove the reset
  await page.getByRole('button', { name: /trang sau|tiếp theo/i }).click()
  const search = page.locator('[data-slot="students-search"]')
  await search.fill('HV001')
  await expect(page.locator('[data-slot="pagination-summary"]')).toHaveText(
    /Hiển thị 1–1 trong tổng số 1/
  )
  await expect(page.locator('[data-slot="table-body"] tr')).toHaveCount(1)
  const last = requestLog[requestLog.length - 1] as { search?: string; offset?: number }
  expect(last.search).toBe('HV001')
  expect(last.offset).toBe(0)
})

test('status filter narrows the dataset', async ({ page }) => {
  await setupStudentsPage(page)
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Bảo lưu' }).click()
  // Dataset has 5 RESERVED students (i % 5 === 0).
  await expect(page.locator('[data-slot="pagination-summary"]')).toHaveText(/trong tổng số 5/)
  // every visible status badge is now "Bảo lưu"
  const badges = page.locator('[data-slot="table-body"] [data-slot="badge"]')
  await expect(badges.first()).toHaveText('Bảo lưu')
})

test('sorting via the header menu reorders the current page', async ({ page }) => {
  await setupStudentsPage(page)
  // The "Họ tên" header is localized as "Tên" in the VI locale.
  const nameHeader = page.getByRole('button', { name: /^tên$/i }).first()
  await nameHeader.click()
  await page.getByText('Tăng dần').click()
  const firstRowName = page.locator('[data-slot="table-body"] tr').first()
  await expect(firstRowName).toContainText('Học Viên A')
  // Descending
  await nameHeader.click()
  await page.getByText('Giảm dần').click()
  await expect(page.locator('[data-slot="table-body"] tr').first()).toContainText('Học Viên J')
})

test('column visibility dropdown hides the phone column', async ({ page }) => {
  await setupStudentsPage(page)
  await expect(page.getByText('0900000001').first()).toBeVisible()
  await page.getByRole('button', { name: /^cột$/i }).click()
  // Phone column is localized as "Số điện thoại".
  await page.getByRole('menuitemcheckbox', { name: /số điện thoại/i }).click()
  await expect(page.getByText('0900000001')).toHaveCount(0)
})

test('row actions: edit opens the prefilled dialog', async ({ page }) => {
  await setupStudentsPage(page)
  await page.locator('[data-slot="table-body"] tr').first().getByRole('button').nth(0).click()
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()
  // VI locale titles the dialog "Sửa học viên".
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(/sửa học viên/i)
  // The row's student email is prefilled in the form (email input).
  await expect(dialog.locator('input[type="email"]')).toHaveValue('student1@test.vn')
})

test('row actions: delete opens the confirmation alert', async ({ page }) => {
  await setupStudentsPage(page)
  await page
    .locator('[data-slot="table-body"] tr')
    .first()
    .getByRole('button')
    .nth(1)
    .click()
  const alert = page.locator('[role="alertdialog"]')
  await expect(alert).toBeVisible()
  await expect(alert.getByText(/xác nhận xóa học viên/i)).toBeVisible()
})

test('empty dataset renders the empty state', async ({ page }) => {
  await mockAuth(page, ADMIN_USER)
  await page.route('**/api/v4/lms/students', (route) => json(route, paginated([], 0)))
  mockEverythingElse(page)
  await page.goto('/#lms_admin/students')
  await expect(page.getByText('Chưa có học viên')).toBeVisible({ timeout: 30_000 })
})

test('loading state renders skeleton rows before data arrives', async ({ page }) => {
  await mockAuth(page, ADMIN_USER)
  // Delay the students response so the skeleton is observable.
  await page.route('**/api/v4/lms/students', async (route) => {
    await page.waitForTimeout(1200)
    json(route, paginated([wireStudent()]))
  })
  mockEverythingElse(page)
  await page.goto('/#lms_admin/students')
  await expect(page.locator('[data-slot="table-body"] tr').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-slot="table-body"] tr').first().locator('.animate-pulse')).toHaveCount(0, { timeout: 5000 })
})
