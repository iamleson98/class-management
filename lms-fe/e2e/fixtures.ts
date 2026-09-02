import type { Page, Route } from '@playwright/test'

/**
 * Shared /api/v4 mocks — emulate the Mattermost-style backend so e2e tests
 * exercise the real UI (tables, toolbars, dialogs) without a Go server.
 *
 * The frontend hydrates auth from GET /api/v4/users/me (cookie session);
 * fulfilling that with a staff profile logs the browser in.
 */

export interface MockUser {
  id: string
  username: string
  email: string
  nickname: string
  firstname: string
  lastname: string
  roles: string
  props?: Record<string, unknown>
}

export const ADMIN_USER: MockUser = {
  id: 'admin-user-1',
  username: 'admin',
  email: 'admin@vmg.test',
  nickname: 'VMG Admin',
  firstname: 'VMG',
  lastname: 'Admin',
  roles: 'system_admin system_user lms_admin',
}

export const ACCOUNTANT_USER: MockUser = {
  id: 'accountant-user-1',
  username: 'accountant',
  email: 'accountant@vmg.test',
  nickname: 'VMG Accountant',
  firstname: 'VMG',
  lastname: 'Accountant',
  roles: 'system_user lms_accountant',
}

export const TEACHER_USER: MockUser = {
  id: 'teacher-user-1',
  username: 'teacher',
  email: 'teacher@vmg.test',
  nickname: 'VMG Teacher',
  firstname: 'VMG',
  lastname: 'Teacher',
  roles: 'system_user lms_teacher',
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** Log the page in as `user` by mocking the session hydration endpoint. */
export function mockAuth(page: Page, user: MockUser = ADMIN_USER) {
  return page.route('**/api/v4/users/me', (route) => json(route, user))
}

/** Default mock for any unmocked /api/v4 call — empty list / empty object. */
export function mockEverythingElse(page: Page) {
  return page.route('**/api/v4/**', (route) => {
    if (route.request().url().includes('/users/me')) return route.fallback()
    return json(route, { items: [], total_count: 0 })
  })
}

/** Create a paginated LMS list payload. */
export function paginated<T>(items: T[], totalCount = items.length) {
  return { items, total_count: totalCount }
}

/** Build a mock student row (real backend wire format: student props live
 * under user.props.student as a JSON string — see denormalizeStudent). */
export function wireStudent(overrides: Record<string, unknown> = {}) {
  const {
    code = 'HV001',
    gender = 'male',
    student_status = 'ACTIVE',
    school = 'THPT Le Quy Don',
    school_grade = '10',
    parent_name = 'Nguyễn Bố',
    vmg_class_code = 'VMG-10A',
    notes = '',
    ...rest
  } = overrides
  return {
    id: 's1',
    user_id: 's1',
    username: 'student1',
    email: 'student1@test.vn',
    phone: '0900000001',
    firstname: 'Nguyễn',
    lastname: 'An',
    props: {
      student: JSON.stringify({
        code,
        gender,
        student_status,
        school,
        school_grade,
        parent_name,
        vmg_class_code,
        notes,
      }),
    },
    create_at: 1700000000000,
    update_at: 1700000000000,
    ...rest,
  }
}

/** Build a mock class row (backend wire format). */
export function wireClass(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    code: 'VMG-10A',
    name: 'IELTS 6.5 Morning',
    course_id: 'course-1',
    teacher_id: 'teacher-user-1',
    room: 'A101',
    status: 'ACTIVE',
    start_date: '2026-01-05',
    branch_id: 'branch-1',
    chat_channel_id: 'chan-1',
    create_at: 1700000000000,
    update_at: 1700000000000,
    ...overrides,
  }
}

export { json }
