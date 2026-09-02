import { test, expect } from '@playwright/test'
import { mockAuth, mockEverythingElse, paginated, wireStudent, wireClass, json, ADMIN_USER } from './fixtures'

/**
 * E2E — Admin Classes screen: main data table (server-driven) + the class
 * detail modal's nested data tables (students tab).
 */

const TOTAL = 12

function allClasses() {
  return Array.from({ length: TOTAL }, (_, i) =>
    wireClass({
      id: `c${i + 1}`,
      code: `VMG-${10 + i}A`,
      name: `IELTS ${5 + i} Sáng`,
      status: i % 4 === 0 ? 'OPEN' : i % 3 === 0 ? 'PAUSED' : 'ACTIVE',
      room: `A${100 + i}`,
      course: { name: `IELTS Course ${i + 1}` },
      teacher: { name: `Cô giáo ${i + 1}` },
      _count: { student_enrollments: (i * 3) % 15 },
    })
  )
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('renders classes with enrolled counts and server summary', async ({ page }) => {
  await mockAuth(page, ADMIN_USER)
  mockEverythingElse(page)
  await page.route('**/api/v4/lms/classes', (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    let rows = allClasses()
    if (body.where_ands && Array.isArray(body.where_ands)) {
      for (const cond of body.where_ands as Array<{ column: string; value: unknown }>) {
        if (cond.column === 'classes.status' && cond.value) {
          rows = rows.filter((c) => c.status === cond.value)
        }
      }
    }
    const limit = Number(body.limit ?? 10)
    const offset = Number(body.offset ?? 0)
    json(route, paginated(rows.slice(offset, offset + limit), rows.length))
  })
  await page.goto('/#lms_admin/classes')
  await expect(page.getByText('IELTS 5 Sáng').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-slot="pagination-summary"]')).toHaveText(
    /Hiển thị 1–10 trong tổng số 12/
  )
  // Course + teacher joins render
  await expect(page.getByText('IELTS Course 1').first()).toBeVisible()
})

test('status filter narrows classes and resets to page 1', async ({ page }) => {
  await mockAuth(page, ADMIN_USER)
  mockEverythingElse(page)
  await page.route('**/api/v4/lms/classes', (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    let rows = allClasses()
    if (body.where_ands && Array.isArray(body.where_ands)) {
      for (const cond of body.where_ands as Array<{ column: string; value: unknown }>) {
        if (cond.column === 'classes.status' && cond.value) {
          rows = rows.filter((c) => c.status === cond.value)
        }
      }
    }
    const limit = Number(body.limit ?? 10)
    const offset = Number(body.offset ?? 0)
    json(route, paginated(rows.slice(offset, offset + limit), rows.length))
  })
  await page.goto('/#lms_admin/classes')
  await expect(page.getByText('IELTS 5 Sáng').first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Tạm dừng' }).click()
  // PAUSED = i % 3 === 0 → i = 0, 3, 6, 9 — but i%4===0 (OPEN) wins at i=0 → 3 rows.
  await expect(page.locator('[data-slot="pagination-summary"]')).toHaveText(/trong tổng số 3/)
})

test('class detail modal shows the enrolled-students data table', async ({ page }) => {
  await mockAuth(page, ADMIN_USER)
  mockEverythingElse(page)
  await page.route('**/api/v4/lms/classes', (route) =>
    json(route, paginated([wireClass({ _count: { student_enrollments: 2 } })]))
  )
  await page.route('**/api/v4/lms/classes/c1', (route) =>
    json(route, {
      data: {
        ...wireClass(),
        // The class-detail endpoint returns raw camelCased joins
        // (enrollment.student.user) — NOT denormalized students.
        student_enrollments: [
          {
            id: 'e1', student_id: 's1', class_id: 'c1', status: 'ACTIVE',
            student: {
              id: 's1', code: 'HV001', phone: '0900000001', parent_name: 'Nguyễn Bố', vmg_class_code: 'VMG-10A',
              user: { name: 'Nguyễn An', phone: '0900000001' },
            },
          },
          {
            id: 'e2', student_id: 's2', class_id: 'c1', status: 'DROPPED',
            student: {
              id: 's2', code: 'HV002', phone: '0900000002', parent_name: 'Trần Cha', vmg_class_code: 'VMG-10A',
              user: { name: 'Trần Bình', phone: '0900000002' },
            },
          },
        ],
      },
    })
  )
  await page.route('**/api/v4/lms/sessions', (route) => json(route, paginated([])))
  await page.route('**/api/v4/lms/class_media**', (route) => json(route, paginated([])))

  await page.goto('/#lms_admin/classes')
  await expect(page.locator('[data-slot="table-body"] tr').first()).toBeVisible({ timeout: 30_000 })

  // Row actions: view (first button)
  await page.locator('[data-slot="table-body"] tr').first().getByRole('button').nth(0).click()
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()
  // Students tab is default — the enrollment table renders both students
  await expect(dialog.getByText('Nguyễn An')).toBeVisible()
  await expect(dialog.getByText('Trần Bình')).toBeVisible()
  // Enrollment status badges (VI locale: DROPPED → "Rớt lớp")
  await expect(dialog.getByText('Đang học').first()).toBeVisible()
  await expect(dialog.getByText('Rớt lớp')).toBeVisible()
})
