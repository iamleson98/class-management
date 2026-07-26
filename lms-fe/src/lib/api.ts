import type {
  User, Branch, BranchListItem, Student, Course, Class,
  SessionListItem, Attendance, AttendanceResponse,
  Lead, LeadListItem, LeadActivity,
  FeePackage, FeePackageListItem, Tuition, TuitionListItem,
  Payment, PaymentWithUser, Material, MaterialListItem,
  Task, TaskListItem, Post, PostListItem, PostCategory, PostCategoryWithCount,
  Banner, DashboardData, NotificationListResponse,
  Homework, HomeworkSubmission, WeeklyReview, ClassMedia,
  ApiUser,
  CreateUserInput, UpdateUserInput,
  CreateStudentInput, UpdateStudentInput,
  CreateCourseInput, UpdateCourseInput,
  CreateClassInput, UpdateClassInput,
  CreateSessionInput, UpdateSessionInput, AttendanceInput,
  CreateLeadInput, UpdateLeadInput, LeadActivityInput,
  CreateTuitionInput, PaymentInput,
  CreateMaterialInput, UpdateMaterialInput,
  CreateTaskInput, UpdateTaskInput,
  CreatePostInput, UpdatePostInput, PostCategoryInput,
  CreateBranchInput, CreateBannerInput, UpdateBannerInput,
  CreateFeePackageInput,
} from '@/lib/schemas'
import type { SearchOpts } from '@/lib/query'
import { LMS_STAFF_ROLES } from '@/store/lms-store';

export const formatVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

// ─── Structured validation error ────────────────────────────────────
export class ValidationError extends Error {
  errors: Array<{ field: string; message: string }>
  constructor(errors: Array<{ field: string; message: string }>, message = 'Dữ liệu không hợp lệ') {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors
  }
}

// Absolute URL to the backend — used only for generating public URLs (e.g. image src)
// All API fetch calls use relative paths that are proxied by Next.js rewrites.
// const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8065'

// Relative base — proxied by Next.js rewrites to the backend
const BASE = '/api/v4'

// ─── Auth model ────────────────────────────────────────────────────
// Auth is exclusively via the httpOnly MMAUTHTOKEN cookie the backend sets at
// login (login.go AttachSessionCookies). The cookie is first-party because the
// Next.js rewrite proxy (next.config.ts) maps /api/v4/* on the frontend origin
// to the backend, so SameSite=Lax works without SameSite=None/Secure gymnastics.
//
// Every request uses credentials:'include' (sends the cookie) and the
// X-Requested-With: XMLHttpRequest header. The backend's CSRF check
// (handlers.go checkCSRFToken) fires for cookie-authenticated non-GET requests;
// because ExperimentalStrictCSRFEnforcement is false, X-Requested-With satisfies
// the legacy fallback. No JS-side token is stored — the token never touches JS,
// so it cannot be exfiltrated by XSS. Do not re-introduce a localStorage token.

/** Headers required on every API call: CSRF-satisfying header + JSON content type. */
function authHeaders(extra?: HeadersInit): HeadersInit {
  return { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...extra }
}

// ─── snake_case ↔ camelCase key transform ──────────────────────────

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/**
 * Mattermost-style entities store timestamps as lowercase-concatenated JSON keys
 * (e.g. `createat`, `updateat`, `deleteat`) — no underscore, so the snake→camel
 * regex above leaves them untouched. The frontend reads these as `createdAt`,
 * `updatedAt`, etc. This alias map closes that gap surgically: it only rewrites
 * a fixed set of known lowercase-concatenated keys, leaving real snake_case
 * (`course_id` → `courseId`) and already-correct keys alone.
 */
const LOWERCASE_ALIAS_MAP: Record<string, string> = {
  createat: 'createdAt',
  updateat: 'updatedAt',
  deleteat: 'deleteAt',
  authservice: 'authService',
  emailverified: 'emailVerified',
  lastactivityat: 'lastActivityAt',
  allowmarketing: 'allowMarketing',
  notifyprops: 'notifyProps',
  isbot: 'isBot',
  // NOTE: firstname / lastname intentionally NOT aliased — the frontend's
  // ApiUser type and components read them in their original lowercase form.
}

/** Recursively transform all object keys using the provided mapper. */
function transformKeys<T>(value: unknown, mapper: (k: string) => string): T {
  if (value === null || value === undefined) return value as T
  if (typeof value !== 'object') return value as T

  if (Array.isArray(value)) {
    return value.map((v) => transformKeys(v, mapper)) as T
  }

  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[mapper(key)] = val !== null && typeof val === 'object'
      ? transformKeys(val, mapper)
      : val
  }
  return result as T
}

/** Convert all snake_case keys in an object to camelCase. */
export function toCamel<T>(data: unknown): T {
  // Apply the lowercase-alias rewrite first (handles `createat` → `createdAt`),
  // then the standard snake→camel transform for the rest.
  return transformKeys<T>(data, (k) => {
    if (LOWERCASE_ALIAS_MAP[k]) return LOWERCASE_ALIAS_MAP[k]
    return snakeToCamel(k)
  })
}

/** Convert all camelCase keys in an object to snake_case. */
function toSnake<T>(data: unknown): T {
  return transformKeys<T>(data, camelToSnake)
}

// ─── Core fetch with Mattermost session auth ────────────────────────
// The Go server handles auth via MMAUTHTOKEN cookie set during login.
// Cookies are sent cross-origin via credentials: 'include'.

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // Auth is via the cookie (credentials:'include'); X-Requested-With satisfies
  // the backend CSRF check on non-GET requests. See the auth-model note above.
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: authHeaders(options?.headers),
    ...options,
  })

  if (res.status === 401) {
    // Session expired — dispatch event for the store to handle (logout + redirect)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    throw new Error('Phiên đăng nhập đã hết hạn')
  }

  if (!res.ok) {
    // The Go backend serializes errors as Mattermost AppError:
    //   { id, message, detailed_error, request_id, status_code }
    // (`message` is the human-readable, locale-translated string). Some older
    // paths may emit `{ error }`. Read `message` first, fall back to `error`.
    const err = await res.json().catch(() => ({ message: res.statusText }))
    if (res.status === 403) {
      throw new Error(err.message || err.error || 'Bạn không có quyền thực hiện thao tác này')
    }
    // 422 — validation errors from server-side parsing
    if (res.status === 422 && Array.isArray(err.errors)) {
      throw new ValidationError(err.errors, err.message || err.error || 'Dữ liệu không hợp lệ')
    }
    throw new Error(err.message || err.error || 'Lỗi hệ thống')
  }
  const json = await res.json()
  // Backend wraps some responses in { data: ... }, some in { items, total_count }, some raw.
  // Unwrap { data: ... } envelope when present (but not when { items } is also present).
  const raw = json.data !== undefined && json.items === undefined ? json.data : json
  // Convert snake_case keys to camelCase for frontend consumption.
  return toCamel<T>(raw)
}

// ─── Fetch a list endpoint and extract .items (unwraps ResponseList) ─
// Supports both GET (no body) and POST with JSON body for search/filter endpoints.
async function apiFetchList<T>(path: string, options?: RequestInit): Promise<T[]> {
  // See apiFetch: auth via cookie + X-Requested-With for CSRF.
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: authHeaders(options?.headers),
    ...options,
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    throw new Error('Phiên đăng nhập đã hết hạn')
  }

  if (!res.ok) {
    // See apiFetch for the Mattermost AppError shape ({ id, message, ... }).
    const err = await res.json().catch(() => ({ message: res.statusText }))
    if (res.status === 403) throw new Error(err.message || err.error || 'Bạn không có quyền thực hiện thao tác này')
    if (res.status === 422 && Array.isArray(err.errors)) {
      throw new ValidationError(err.errors, err.message || err.error || 'Dữ liệu không hợp lệ')
    }
    throw new Error(err.message || err.error || 'Lỗi hệ thống')
  }
  const json = await res.json()
  // List endpoints return { items: [...], total_count: N }
  const items = Array.isArray(json.items) ? json.items
    // Some endpoints return raw arrays or { data: [...] }
    : Array.isArray(json.data) ? json.data
      : Array.isArray(json) ? json
        : []
  return toCamel<T[]>(items)
}

/**
 * Fetch a list and return both items and total_count. Use this for paginated
 * listings so the UI can render server-driven page controls.
 */
async function apiSearchPaginated<T>(path: string, body: unknown): Promise<PaginatedList<T>> {
  const snakeBody = toSnake(body)
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
    body: JSON.stringify(snakeBody),
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    throw new Error('Phiên đăng nhập đã hết hạn')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    if (res.status === 403) throw new Error(err.message || err.error || 'Bạn không có quyền thực hiện thao tác này')
    if (res.status === 422 && Array.isArray(err.errors)) {
      throw new ValidationError(err.errors, err.message || err.error || 'Dữ liệu không hợp lệ')
    }
    throw new Error(err.message || err.error || 'Lỗi hệ thống')
  }

  const json = await res.json()
  const items = Array.isArray(json.items) ? json.items
    : Array.isArray(json.data) ? json.data
      : Array.isArray(json) ? json
        : []
  const totalCount = typeof json.total_count === 'number' ? json.total_count : items.length
  return { items: toCamel<T[]>(items), totalCount }
}

// ─── POST a search/filter body to a list endpoint ──────────────────
// List endpoints accept a POST JSON body (a FilterOpts struct embedding
// utils.SearchOpts) and return { items: [...], total_count: N }. The body is
// built with the typed helpers in src/lib/query.ts (operators EQ/LIKE/etc,
// typed ColumnNames). See backend server/public/utils/query.go for the contract.

/** Result of a paginated search — items plus the server-reported total count. */
export interface PaginatedList<T> {
  items: T[]
  totalCount: number
}

/** Fetch a list, returning only the items (drops total_count). */
async function apiSearchList<T>(path: string, body: unknown): Promise<T[]> {
  const result = await apiSearchPaginated<T>(path, body)
  return result.items
}

// ─── Convenience helpers ─────────────────────────────────────────
function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path)
}
function apiPost<T>(path: string, data: unknown): Promise<T> {
  // Convert camelCase keys to snake_case before sending to backend
  const snakeData = toSnake(data)
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(snakeData) })
}
function apiPut<T>(path: string, data: unknown): Promise<T> {
  const snakeData = toSnake(data)
  return apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(snakeData) })
}
function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' })
}

// ─── Auth ───────────────────────────────────────────────────────────

/**
 * The Go backend stores LMS roles as UPPERCASE Mattermost-style strings
 * (e.g. "STUDENT", "TEACHER", "ADMIN" — see server/channels/app/lms/student.go
 * and the dashboard switch in app/lms/dashboard.go). The frontend, however,
 * uses `lms_*` role strings everywhere (UserRole enum in schemas/enums.ts,
 * ROLE_PRIORITY in the store, NAV_MAP in page.tsx).
 *
 * To keep both sides' internal conventions intact, we translate the role
 * string here in the API layer on the way in (login / getMe), so the rest of
 * the frontend only ever sees `lms_student`, `lms_admin`, etc.
 */
const ROLE_BACKEND_TO_FRONTEND: Record<string, string> = {
  STUDENT: 'lms_student',
  TEACHER: 'lms_teacher',
  ADMIN: 'lms_admin',
  SUPER_ADMIN: 'lms_super_admin',
  COUNSELOR: 'lms_counselor',
  ACCOUNTANT: 'lms_accountant',
  MARKETING: 'lms_marketing',
  PARENT: 'lms_parent',
}

/** Reverse map for outbound requests (e.g. the dashboard `role` query param). */
const ROLE_FRONTEND_TO_BACKEND: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_BACKEND_TO_FRONTEND).map(([backend, frontend]) => [frontend, backend])
)

/**
 * Rewrite a space-separated roles string from backend conventions
 * ("system_user STUDENT") to frontend conventions ("system_user lms_student").
 * System roles (system_user, system_admin, ...) are passed through unchanged.
 */
function normalizeRolesString(roles: string): string {
  if (!roles) return ''
  return roles
    .split(/\s+/)
    .filter(Boolean)
    .map((r) => ROLE_BACKEND_TO_FRONTEND[r] ?? r)
    .join(' ')
}

/**
 * POST /api/v4/users/login returns a flat model.User JSON object.
 * The backend sets the httpOnly MMAUTHTOKEN session cookie when X-Requested-With
 * is present (login.go AttachSessionCookies) — that cookie IS the credential; no
 * token is read from the response or stored in JS. The `roles` field is a
 * space-separated string normalized to the lms_* convention for the store.
 */
export const loginWithMattermost = async (email: string, password: string) => {
  const res = await fetch('/api/v4/users/login', {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
    body: JSON.stringify({ login_id: email, password }),
  })
  if (!res.ok) {
    let errorMsg = 'Email hoặc mật khẩu không đúng'
    try { const err = await res.json(); errorMsg = err.message || err.error || errorMsg } catch { /* use default */ }
    throw new Error(errorMsg)
  }
  const userData: ApiUser = await res.json()

  // Translate backend role strings (e.g. "STUDENT") into the lms_* convention
  // the frontend uses everywhere.
  userData.roles = normalizeRolesString(userData.roles)

  return userData
}

/**
 * GET /api/v4/users/me returns the same model.User JSON object.
 * Auth is via the cookie only (credentials:'include'). Returns null on failure
 * (401, network error, etc.) instead of throwing, so the caller can handle
 * unauthenticated state gracefully.
 */
export const getMe = (): Promise<ApiUser | null> => {
  return fetch('/api/v4/users/me', {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  }).then(async (r) => {
    if (!r.ok) return null
    const json: ApiUser = await r.json()
    // Translate backend role strings (e.g. "STUDENT") into the lms_* convention
    // the frontend uses everywhere.
    json.roles = normalizeRolesString(json.roles)
    return json
  }).catch(() => null)
}

export const logout = () => {
  // POST /users/logout clears the server-side session + the MMAUTHTOKEN cookie.
  return fetch('/api/v4/users/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
    .then(() => { })
    .catch(() => { /* session may already be expired — ignore */ })
}

// ─── Public — no auth required ─────────────────────────────────────
const PUBLIC_BASE = '/api/v4/lms/public'

export const getPublicCourses = (): Promise<Course[]> =>
  fetch(`${PUBLIC_BASE}/courses`, { credentials: 'include' }).then(async (r) => {
    const json = await r.json()
    const items = Array.isArray(json.items) ? json.items
      : Array.isArray(json.data) ? json.data
        : Array.isArray(json) ? json
          : []
    return toCamel<Course[]>(items)
  })

export const getPublicPosts = (): Promise<PostListItem[]> =>
  fetch(`${PUBLIC_BASE}/posts`, { credentials: 'include' }).then(async (r) => {
    const json = await r.json()
    const raw = json.data ?? json
    return toCamel<PostListItem[]>(raw)
  })

export const submitRegistration = (data: Record<string, unknown>) =>
  fetch(`${PUBLIC_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toSnake(data)),
  }).then(async (r) => {
    if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || 'Đăng ký thất bại') }
    const json = await r.json()
    return json.data ?? json
  })

export const submitContact = (data: { name: string; email: string; phone: string; message: string }) =>
  fetch(`${PUBLIC_BASE}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toSnake(data)),
  }).then(async (r) => {
    if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || 'Gửi tin nhắn thất bại') }
    const json = await r.json()
    return json.data ?? json
  })

export const sendPasswordReset = (email: string) =>
  fetch(`${PUBLIC_BASE}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).then(async (r) => {
    if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || 'Gửi yêu cầu thất bại') }
    const json = await r.json()
    return json as { success: boolean; message: string }
  })

export const verifyResetToken = (token: string) =>
  fetch(`${PUBLIC_BASE}/verify-token?token=${encodeURIComponent(token)}`).then(async (r) => {
    const json = await r.json()
    return json as { valid: boolean }
  })

export const resetPassword = (token: string, password: string) =>
  fetch(`${PUBLIC_BASE}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  }).then(async (r) => {
    if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || 'Đặt lại mật khẩu thất bại') }
    const json = await r.json()
    return json as { success: boolean; message: string }
  })

// ─── Users ─────────────────────────────────────────────────────────

export interface GetUsersParams {
  role?: string
  /** Include soft-deleted (deactivated) users in the result. */
  includeInactive?: boolean
  /** Restrict to users holding any staff/employee LMS role. */
  staffOnly?: boolean
}

export const getUsers = (params: GetUsersParams = {}) => {
  const opts: SearchOpts = {
    where_ands: [],
    where_ors: [],
    count_total: true,
  }
  if (params.role) opts.where_ands?.push({
    column: 'users.roles',
    operator: 'ILIKE',
    value: `%${params.role}%`,
  })
  if (!params.includeInactive) opts.where_ands?.push({
    column: 'users.deleteat',
    operator: '=',
    value: 0
  })
  if (params.staffOnly) {
    LMS_STAFF_ROLES.forEach(role => {
      opts.where_ors?.push({
        column: 'users.roles',
        operator: 'ILIKE',
        value: `%${role}%`,
      })
    })
  }
  return apiSearchPaginated<User>(`/users/search2`, opts)
}
export const createUser = (data: CreateUserInput): Promise<User> => apiPost<User>('/lms/users', data)
export const updateUser = (id: string, data: UpdateUserInput): Promise<User> => apiPut<User>(`/lms/users/${id}`, data)
export const deleteUser = (id: string): Promise<void> => apiDelete<void>(`/lms/users/${id}`)
/** Soft-deactivate an employee (blocks login, keeps the record). */
export const deactivateUser = (id: string): Promise<User> => apiPost<User>(`/lms/users/${id}/deactivate`, {})
/** Reactivate a previously deactivated employee. */
export const reactivateUser = (id: string): Promise<User> => apiPost<User>(`/lms/users/${id}/reactivate`, {})

// ─── Students ───────────────────────────────────────────────────────
// `opts` is a utils.SearchOpts body (built via src/lib/query.ts). StudentFilterOpts
// also honors top-level `search`, `status`, and `class_id` fields, so callers may
// include those directly in the body alongside the generic where_ands/limit/etc.

/** List students (items only). */
export const getStudents = (opts: SearchOpts = {}): Promise<Student[]> =>
  apiSearchList<Student>('/lms/students', opts)
/** List students with total_count for server-driven paging. */
export const getStudentsPaginated = (opts: SearchOpts = {}): Promise<PaginatedList<Student>> =>
  apiSearchPaginated<Student>('/lms/students', opts)
export const createStudent = (data: CreateStudentInput): Promise<Student> => apiPost<Student>('/lms/students/create', data)
export const updateStudent = (id: string, data: UpdateStudentInput): Promise<Student> => apiPut<Student>(`/lms/students/${id}`, data)
export const deleteStudent = (id: string): Promise<void> => apiFetch<void>(`/lms/students/${id}`, { method: 'DELETE' })

// ─── Counselor: user ↔ student conversions ─────────────────────────
// All gated by PermissionLmsManageStudents on the backend.

/** List non-student, non-deactivated users eligible to be converted to students. */
export const getConvertibleUsers = (): Promise<User[]> => apiFetchList<User>('/lms/students/convertible-users')
/** Promote an existing user to a student. */
export const convertUserToStudent = (userId: string): Promise<User> => apiPost<User>(`/lms/users/${userId}/convert-to-student`, {})
/** Demote a student back to a regular user. */
export const revertStudentToUser = (studentId: string): Promise<User> => apiPost<User>(`/lms/students/${studentId}/revert-to-user`, {})

// ─── Courses ────────────────────────────────────────────────────────

/** List courses (items only). GET endpoint — body is ignored, filters are client-side. */
export const getCourses = (): Promise<Course[]> => apiFetchList<Course>('/lms/courses')
/**
 * List courses with total_count. Courses are served via GET (no POST search body),
 * so paging is emulated client-side over the full list while returning the
 * PaginatedList shape for uniformity with other endpoints.
 */
export const getCoursesPaginated = (opts: SearchOpts = {}): Promise<PaginatedList<Course>> =>
  getCourses().then((items) => {
    const total = items.length
    const limit = opts.limit && opts.limit > 0 ? opts.limit : total
    const offset = opts.offset && opts.offset >= 0 ? opts.offset : 0
    return { items: items.slice(offset, offset + limit), totalCount: total }
  })
export const createCourse = (data: CreateCourseInput): Promise<Course> => apiPost<Course>('/lms/courses', data)
export const updateCourse = (id: string, data: UpdateCourseInput): Promise<Course> => apiPut<Course>(`/lms/courses/${id}`, data)
export const deleteCourse = (id: string): Promise<void> => apiFetch<void>(`/lms/courses/${id}`, { method: 'DELETE' })

// ─── Classes ─────────────────────────────────────────────────────────

export const getClasses = (opts: SearchOpts = {}): Promise<Class[]> =>
  apiSearchList<Class>('/lms/classes', opts)
export const getClassesPaginated = (opts: SearchOpts = {}): Promise<PaginatedList<Class>> =>
  apiSearchPaginated<Class>('/lms/classes', opts)
export const createClass = (data: CreateClassInput): Promise<Class> => apiPost<Class>('/lms/classes/create', data)
export const updateClass = (id: string, data: UpdateClassInput): Promise<Class> => apiPut<Class>(`/lms/classes/${id}`, data)
export const deleteClass = (id: string): Promise<void> => apiFetch<void>(`/lms/classes/${id}`, { method: 'DELETE' })
export const getClassDetail = (id: string): Promise<any> => apiGet(`/lms/classes/${id}`)
export const enrollStudents = (classId: string, studentIds: string[]): Promise<Class> =>
  apiPost<Class>(`/lms/classes/${classId}/enroll`, { studentIds })

// ─── Sessions ───────────────────────────────────────────────────────

/**
 * POST /lms/sessions — list sessions. `opts` is a SearchOpts body (typed columns
 * via src/lib/query.ts). NOTE: the `lms_sessions` table has NO `month` and NO
 * `student_id` column — sessions link to students only indirectly via class
 * enrollment. Filter those client-side on the returned list.
 */
export const getSessions = (opts: SearchOpts = {}): Promise<SessionListItem[]> =>
  apiSearchList<SessionListItem>('/lms/sessions', opts)
export const createSession = (data: CreateSessionInput): Promise<SessionListItem> =>
  apiPost<SessionListItem>('/lms/sessions/create', data)
export const updateSession = (id: string, data: UpdateSessionInput): Promise<SessionListItem> =>
  apiPut<SessionListItem>(`/lms/sessions/${id}`, data)
export const deleteSession = (id: string): Promise<void> =>
  apiDelete<void>(`/lms/sessions/${id}`)

// ─── Attendance ────────────────────────────────────────────────────

export const getSessionAttendance = (sessionId: string): Promise<AttendanceResponse> =>
  apiFetch<AttendanceResponse>(`/lms/sessions/${sessionId}/attendance`)
export const saveAttendance = (sessionId: string, records: AttendanceInput[]): Promise<{ count: number; records: Attendance[] }> =>
  apiPost<{ count: number; records: Attendance[] }>(`/lms/sessions/${sessionId}/attendance`, { records })

// ─── Leads (CRM) ────────────────────────────────────────────────────

export const getLeads = (opts: SearchOpts = {}): Promise<LeadListItem[]> =>
  apiSearchList<LeadListItem>('/lms/leads', opts)
export const getLeadsPaginated = (opts: SearchOpts = {}): Promise<PaginatedList<LeadListItem>> =>
  apiSearchPaginated<LeadListItem>('/lms/leads', opts)
export const createLead = (data: CreateLeadInput): Promise<Lead> => apiPost<Lead>('/lms/leads/create', data)
export const updateLead = (id: string, data: UpdateLeadInput): Promise<Lead> => apiPut<Lead>(`/lms/leads/${id}`, data)
export const deleteLead = (id: string): Promise<void> => apiDelete<void>(`/lms/leads/${id}`)
export const getLeadActivities = (leadId: string): Promise<LeadActivity[]> => apiFetch<LeadActivity[]>(`/lms/leads/${leadId}/activities`)
export const createLeadActivity = (leadId: string, data: LeadActivityInput): Promise<LeadActivity> =>
  apiPost<LeadActivity>(`/lms/leads/${leadId}/activities`, data)
export const convertLeadToStudent = (leadId: string, data: Record<string, unknown>): Promise<Lead> =>
  apiPost<Lead>(`/lms/leads/${leadId}/convert`, data)

// ─── Tuitions ──────────────────────────────────────────────────────

export const getTuitions = (opts: SearchOpts = {}): Promise<TuitionListItem[]> =>
  apiSearchList<TuitionListItem>('/lms/tuitions', opts)
export const getTuitionsPaginated = (opts: SearchOpts = {}): Promise<PaginatedList<TuitionListItem>> =>
  apiSearchPaginated<TuitionListItem>('/lms/tuitions', opts)
export const createTuition = (data: CreateTuitionInput): Promise<Tuition> => apiPost<Tuition>('/lms/tuitions/create', data)
export const getTuitionPayments = (tuitionId: string): Promise<PaymentWithUser[]> => apiFetch<PaymentWithUser[]>(`/lms/tuitions/${tuitionId}/payments`)
export const createPayment = (tuitionId: string, data: PaymentInput): Promise<Payment> =>
  apiPost<Payment>(`/lms/tuitions/${tuitionId}/payments`, data)

// ─── Materials ──────────────────────────────────────────────────────

export const getMaterials = (opts: SearchOpts = {}): Promise<MaterialListItem[]> =>
  apiSearchList<MaterialListItem>('/lms/materials', opts)
export const getMaterialsPaginated = (opts: SearchOpts = {}): Promise<PaginatedList<MaterialListItem>> =>
  apiSearchPaginated<MaterialListItem>('/lms/materials', opts)
export const createMaterial = (data: CreateMaterialInput): Promise<Material> => apiPost<Material>('/lms/materials/create', data)
export const updateMaterial = (id: string, data: UpdateMaterialInput): Promise<Material> => apiPut<Material>(`/lms/materials/${id}`, data)
export const deleteMaterial = (id: string): Promise<void> => apiDelete<void>(`/lms/materials/${id}`)

// ─── Tasks ───────────────────────────────────────────────────────────

export const getTasks = (opts: SearchOpts = {}): Promise<TaskListItem[]> =>
  apiSearchList<TaskListItem>('/lms/tasks', opts)
export const createTask = (data: CreateTaskInput): Promise<Task> => apiPost<Task>('/lms/tasks/create', data)
export const updateTask = (id: string, data: UpdateTaskInput): Promise<Task> => apiPut<Task>(`/lms/tasks/${id}`, data)
export const deleteTask = (id: string): Promise<void> => apiDelete<void>(`/lms/tasks/${id}`)

// ─── CMS — note: Go routes use /posts/categories not /post-categories
export const getPostCategories = (): Promise<PostCategoryWithCount[]> => apiFetchList<PostCategoryWithCount>('/lms/posts/categories')
export const getPosts = (opts: SearchOpts = {}): Promise<PostListItem[]> =>
  apiSearchList<PostListItem>('/lms/posts', opts)
export const getPostsPaginated = (opts: SearchOpts = {}): Promise<PaginatedList<PostListItem>> =>
  apiSearchPaginated<PostListItem>('/lms/posts', opts)
export const createPost = (data: CreatePostInput): Promise<Post> => apiPost<Post>('/lms/posts/create', data)
export const updatePost = (id: string, data: UpdatePostInput): Promise<Post> => apiPut<Post>(`/lms/posts/${id}`, data)
export const deletePost = (id: string): Promise<void> => apiDelete<void>(`/lms/posts/${id}`)
export const createPostCategory = (data: PostCategoryInput): Promise<PostCategory> => apiPost<PostCategory>('/lms/posts/categories', data)
export const getBanners = (): Promise<Banner[]> => apiFetchList<Banner>('/lms/banners')

// ─── Branches ────────────────────────────────────────────────────────

export const getBranches = (opts: SearchOpts = {}): Promise<BranchListItem[]> =>
  apiSearchList<BranchListItem>('/lms/branches', opts)
export const createBranch = (data: CreateBranchInput): Promise<Branch> => apiPost<Branch>('/lms/branches/create', data)

// ─── Fee Packages ────────────────────────────────────────────────────

export const getFeePackages = (opts: SearchOpts = {}): Promise<FeePackageListItem[]> =>
  apiSearchList<FeePackageListItem>('/lms/fee-packages', opts)
export const createFeePackage = (data: CreateFeePackageInput): Promise<FeePackage> =>
  apiPost<FeePackage>('/lms/fee-packages/create', data)

// ─── Banners ────────────────────────────────────────────────────────

export const createBanner = (data: CreateBannerInput): Promise<Banner> => apiPost<Banner>('/lms/banners', data)
export const updateBanner = (id: string, data: UpdateBannerInput): Promise<Banner> => apiPut<Banner>(`/lms/banners/${id}`, data)

// ─── Notifications ──────────────────────────────────────────────────

export const getNotifications = (): Promise<NotificationListResponse> =>
  apiFetch<NotificationListResponse>('/lms/notifications')
export const markNotificationRead = (id: string): Promise<void> => apiFetch<void>(`/lms/notifications/${id}/read`, { method: 'POST' })

// ─── Dashboard & Reports ────────────────────────────────────────────

/**
 * GET /lms/dashboard — returns dashboard stats.
 *
 * NOTE on backend behavior: the current API handler (server/channels/api4/
 * lms_api/dashboard.go) only calls GetDashboardStats(), which returns an
 * AGGREGATE object ({total_students, total_classes, total_courses, total_leads,
 * total_teachers, total_revenue}). The `role` / `user_id` query params are
 * currently IGNORED by the route — the per-role GetDashboard() in the app layer
 * is not wired into any endpoint yet. Components therefore use `?? 0` defaults
 * against the flexible DashboardStats type; role-specific fields simply stay
 * undefined until the backend exposes a role-aware endpoint. We still send
 * `role`/`user_id` (translated to the backend's UPPERCASE convention) so the
 * call is correct the moment that endpoint is wired up.
 */
export const getDashboard = (role: string, userId?: string): Promise<DashboardData> => {
  const backendRole = ROLE_FRONTEND_TO_BACKEND[role] ?? role
  const q = new URLSearchParams({ role: backendRole })
  if (userId) q.set('user_id', userId)
  return apiFetch<DashboardData>(`/lms/dashboard?${q}`)
}
export const getReport = (type: string, params?: Record<string, string>): Promise<Record<string, any>> => {
  const q = new URLSearchParams({ type, ...params })
  return apiFetch<Record<string, any>>(`/lms/reports?${q}`)
}

// ─── Homework (Go routes use /homeworks) ────────────────────────────

export function getHomework(opts: SearchOpts = {}) {
  return apiSearchList<Homework>('/lms/homeworks', opts)
}

export function getHomeworkPaginated(opts: SearchOpts = {}) {
  return apiSearchPaginated<Homework>('/lms/homeworks', opts)
}

export function getHomeworkById(id: string) {
  return apiGet(`/lms/homeworks/${id}`)
}

export function createHomework(data: Record<string, unknown>) {
  return apiPost('/lms/homeworks/create', data)
}

export function updateHomework(id: string, data: Record<string, unknown>) {
  return apiPut(`/lms/homeworks/${id}`, data)
}

export function deleteHomework(id: string) {
  return apiDelete(`/lms/homeworks/${id}`)
}

export function bulkAssignHomework(data: Record<string, unknown>) {
  return apiPost('/lms/homeworks/bulk-assign', data)
}

export function getHomeworkSubmissions(homeworkId: string) {
  return apiGet<HomeworkSubmission[]>(`/lms/homeworks/${homeworkId}/submissions`)
}

export function submitHomework(data: Record<string, unknown>) {
  return apiPost(`/lms/homeworks/${data.homeworkId}/submissions`, data)
}

export function gradeHomework(homeworkId: string, data: Record<string, unknown>) {
  return apiPut(`/lms/homeworks/${homeworkId}/submissions`, data)
}

// ─── Weekly Reviews ──────────────────────────────────────────────────

export function getWeeklyReviews(opts: SearchOpts = {}) {
  return apiSearchList<WeeklyReview>('/lms/weekly-reviews', opts)
}

export function getWeeklyReviewsPaginated(opts: SearchOpts = {}) {
  return apiSearchPaginated<WeeklyReview>('/lms/weekly-reviews', opts)
}

export function createWeeklyReview(data: Record<string, unknown>) {
  return apiPost('/lms/weekly-reviews/create', data)
}

export function updateWeeklyReview(id: string, data: Record<string, unknown>) {
  return apiPut(`/lms/weekly-reviews/${id}`, data)
}

export function deleteWeeklyReview(id: string) {
  return apiDelete(`/lms/weekly-reviews/${id}`)
}

// ─── Class Media ─────────────────────────────────────────────────────

export function getClassMedia(opts: SearchOpts = {}) {
  return apiSearchList<ClassMedia>('/lms/class-media/search', opts)
}

export function createClassMedia(data: Record<string, unknown>) {
  return apiPost('/lms/class-media', data)
}

export function deleteClassMedia(id: string) {
  return apiDelete(`/lms/class-media/${id}`)
}
