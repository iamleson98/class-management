import { test, expect, type Page } from '@playwright/test'
import { mockAuth, mockEverythingElse, paginated, json, ADMIN_USER } from './fixtures'

/**
 * E2E — Admin Schedule: the session-create dialog's repeat control
 * (weekly until the class end date), the teacher-schedule 409 conflict
 * banner, and the force-retry path.
 */

const today = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addWeeks = (n: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() + 7 * n)
  return d
}

// 7 weekly occurrences: today .. today+6w (inclusive) — matches the class end.
const CLASS_ROW = {
  id: 'cls123456789012345678',
  code: 'VMG-10A',
  name: 'IELTS 6.5 Sáng',
  course_id: 'course123456789012345',
  teacher_id: 'teacher123456789012345',
  status: 'ACTIVE',
  room: 'A101',
  start_date: iso(today),
  end_date: iso(addWeeks(6)),
  chat_channel_id: '',
  createat: 0,
  updateat: 0,
}

const TEACHER = {
  id: 'teacher123456789012345',
  username: 'lannguyen',
  email: 'lan@test.vn',
  firstname: 'Nguyễn',
  lastname: 'Lan',
  createat: 0,
  updateat: 0,
}

function wireSession(over: Record<string, unknown> = {}) {
  return {
    id: 'sess123456789012345678',
    title: null,
    class_id: CLASS_ROW.id,
    teacher_id: TEACHER.id,
    start_time: 0,
    end_time: 0,
    room: null,
    lesson_id: '',
    status: 'SCHEDULED',
    date: iso(today),
    createat: 0,
    updateat: 0,
    ...over,
  }
}

async function mockScheduleData(page: Page) {
  await page.route('**/api/v4/lms/sessions', (route) => json(route, paginated([])))
  await page.route('**/api/v4/lms/classes', (route) => json(route, paginated([CLASS_ROW])))
  await page.route('**/api/v4/users/search2', (route) => json(route, paginated([TEACHER])))
}

async function openCreateDialog(page: Page) {
  await page.goto('/#lms_admin/schedule')
  await expect(page.getByRole('button', { name: /tạo buổi học/i })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /tạo buổi học/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

/** Pick today in the (first) open date-picker popover. */
async function pickToday(page: Page) {
  await page.getByRole('button', { name: /chọn ngày/i }).first().click()
  const todayCell = page.locator('[data-today]').first()
  await expect(todayCell).toBeVisible({ timeout: 10_000 })
  await todayCell.click()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('weekly repeat until class end previews the occurrence count', async ({ page }) => {
  await mockAuth(page, ADMIN_USER)
  mockEverythingElse(page)
  await mockScheduleData(page)

  await openCreateDialog(page)
  await pickToday(page)

  // Class select (combobox inside the dialog) → picks the teacher too.
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: /IELTS 6\.5 Sáng/ }).click()

  // Repeat → weekly until the class end date.
  await page.getByRole('combobox').nth(2).click()
  await page.getByRole('option', { name: /hàng tuần đến hết thời gian lớp/i }).click()

  // today + 6 weeks inclusive = 7 occurrences.
  await expect(page.getByText(/sẽ tạo 7 buổi học/i)).toBeVisible()
})

test('conflict 409 renders the banner and force retries', async ({ page }) => {
  await mockAuth(page, ADMIN_USER)
  mockEverythingElse(page)
  await mockScheduleData(page)

  const createCalls: Array<Record<string, unknown>> = []
  await page.route('**/api/v4/lms/sessions/create', (route) => {
    createCalls.push(route.request().postDataJSON() as Record<string, unknown>)
    if (createCalls.length === 1) {
      return json(
        route,
        {
          id: 'app.lms.session.teacher_conflict.app_error',
          message: 'Giáo viên đã có 1 buổi học trùng lịch trong khung giờ này.',
          detailed_error: '',
          status_code: 409,
          conflicts: [
            {
              date: iso(today),
              start_time: Date.parse('2026-09-07T01:00:00Z'),
              end_time: Date.parse('2026-09-07T02:30:00Z'),
              class_id: 'other123456789012345',
              class_name: 'Lớp Toán B',
              teacher_id: TEACHER.id,
              teacher_name: 'Nguyễn Lan',
            },
          ],
        },
        409,
      )
    }
    return json(route, { sessions: [wireSession(), wireSession({ id: 'sess223456789012345678', date: iso(addWeeks(1)) })], count: 2 }, 201)
  })

  await openCreateDialog(page)
  await pickToday(page)

  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: /IELTS 6\.5 Sáng/ }).click()

  await page.getByRole('button', { name: /tạo buổi học|đang tạo/i }).last().click()

  // 409 → inline conflict banner with the teacher name + conflicting class.
  const banner = page.getByTestId('teacher-conflict-banner')
  await expect(banner).toBeVisible({ timeout: 10_000 })
  await expect(banner).toContainText('Nguyễn Lan')
  await expect(banner).toContainText('Lớp Toán B')
  // The first submit carried repeat_until: '' (single) and no force flag.
  expect(createCalls[0]?.repeat_until).toBe('')
  expect(createCalls[0]?.force).toBeUndefined()

  // Force retry → created 2 sessions toast, dialog closed.
  await banner.getByRole('button', { name: /vẫn tạo buổi học/i }).click()
  await expect(page.getByText(/đã tạo 2 buổi học/i)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })
  expect(createCalls[1]?.force).toBe(true)
})
