import type {
  User, Branch, BranchListItem, Student, Course, Class,
  SessionListItem, Attendance,
  Lead, LeadListItem, LeadActivity, StudentEnrollment,
  FeePackage, FeePackageListItem, Tuition, TuitionListItem,
  Payment, PaymentWithUser, Material, MaterialListItem,
  Task, TaskListItem, Post, PostListItem, PostCategory, PostCategoryWithCount,
  Banner, DashboardStats, NotificationListResponse,
  Homework, HomeworkSubmission, WeeklyReview, ClassMedia,
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
  UserRole,
} from '@/lib/schemas'
import type { SearchOpts } from '@/lib/query'
import { type UserProfile } from '@mattermost/types/users'

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

// ─── Teacher schedule conflict (session create/update, HTTP 409) ────

/** One of the teacher's existing sessions overlapping the proposed slot. */
export interface SessionConflictItem {
  /** "YYYY-MM-DD" of the conflicting session */
  date: string
  /** epoch ms */
  startTime: number
  /** epoch ms */
  endTime: number
  classId: string
  className: string
  teacherId: string
  teacherName: string
}

/**
 * Thrown when POST /lms/sessions/create or PUT /lms/sessions/{id} answers
 * 409 with a `conflicts` array. The UI shows the conflicts and may retry
 * with `force: true` after the admin acknowledges the overlap.
 */
export class SessionConflictError extends Error {
  conflicts: SessionConflictItem[]
  constructor(message: string, conflicts: SessionConflictItem[]) {
    super(message)
    this.name = 'SessionConflictError'
    this.conflicts = conflicts
  }
}

// Relative base — proxied by Next.js rewrites to the backend
const BASE = '/api/v4'

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
  return transformKeys<T>(data, (k) => LOWERCASE_ALIAS_MAP[k] ?? snakeToCamel(k))
}

/** Convert all camelCase keys in an object to snake_case. */
function toSnake<T>(data: unknown): T {
  return transformKeys<T>(data, camelToSnake)
}

// ─── Inbound value normalization ────────────────────────────────────
//
// The transform layer above only rewrites KEYS, never values. Two backend
// conventions need value-level fixes on the way in:
//
// 1. decimal.Decimal (shopspring) marshals as a JSON STRING ("1000000"), but
//    the frontend treats money/amount fields as numbers (arithmetic, formatVND).
//    We coerce known decimal fields to numbers on inbound.
// 2. Session `start_time`/`end_time` are int64 epoch MILLIS while `date` is an
//    RFC3339 string. The UI wants `startTime`/`endTime` as 'HH:mm' and `date`
//    as 'yyyy-MM-dd'. We normalize inbound sessions into that display shape.

/** Coerce a value that may be a numeric string into a number, else 0. */
function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v)
  return 0
}

const DECIMAL_FIELDS = new Set([
  'fee', 'totalAmount', 'discountAmount', 'paidAmount', 'remainingAmount',
  'discountValue', 'promotionalFee', 'totalFee', 'amount',
])

/** Recursively coerce known decimal-string fields to numbers. */
function coerceDecimals<T>(value: unknown): T {
  if (value === null || value === undefined) return value as T
  if (typeof value !== 'object') return value as T
  if (Array.isArray(value)) return value.map(coerceDecimals) as T

  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (DECIMAL_FIELDS.has(key) && (typeof val === 'string' || typeof val === 'number')) {
      result[key] = val === '' || val === null ? 0 : toNumber(val)
    } else if (val !== null && typeof val === 'object') {
      result[key] = coerceDecimals(val)
    } else {
      result[key] = val
    }
  }
  return result as T
}

/** Convert an epoch-ms or RFC3339 value into 'HH:mm' Vietnam time (UTC+7), else ''. */
function epochToTimeOfDay(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  const n = typeof v === 'number' ? v : Date.parse(String(v))
  if (typeof n !== 'number' || isNaN(n)) return typeof v === 'string' ? v : ''
  // The LMS calendar is Vietnam-based: format in ICT (UTC+7) regardless of
  // the browser's locale so times match what the admin picked.
  const d = new Date(n + 7 * 3600_000)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Format an epoch-ms value as 'HH:mm' Vietnam time (public helper). */
export function epochMsToHHmm(ms: number): string {
  return epochToTimeOfDay(ms)
}

/** Normalize a session's date/times into the display shape. */
function normalizeSession<T>(s: T): T {
  if (!s || typeof s !== 'object') return s
  const obj = s as Record<string, unknown>
  // date: backend is RFC3339 → keep as 'yyyy-MM-dd' for grouping/filtering
  if (typeof obj.date === 'string' && obj.date.length >= 10) {
    obj.date = obj.date.slice(0, 10)
  } else if (typeof obj.date === 'number') {
    obj.date = new Date(obj.date).toISOString().slice(0, 10)
  }
  // start_time / end_time: epoch ms (or RFC3339) → 'HH:mm'
  if (obj.startTime !== undefined || obj.starttime !== undefined) {
    obj.startTime = epochToTimeOfDay(obj.startTime ?? obj.starttime)
  }
  if (obj.endTime !== undefined || obj.endtime !== undefined) {
    obj.endTime = epochToTimeOfDay(obj.endTime ?? obj.endtime)
  }
  return s
}

/** Recursively normalize session display fields. */
function normalizeSessions<T>(value: unknown): T {
  if (value === null || value === undefined) return value as T
  if (Array.isArray(value)) return value.map(normalizeSession) as T
  if (typeof value === 'object') return normalizeSession(value as Record<string, unknown>) as T
  return value as T
}

/**
 * Denormalize a student record. The backend stores student-specific data as a
 * JSON string under `user.props.student` (see app/lms/student.go). For display
 * convenience we lift those keys to the top level and synthesize a `name`.
 * Canonical prop keys: gender, student_status, code, dob, school, school_grade,
 * parent_name, vmg_class_code, notes.
 */
function denormalizeStudent<T>(raw: T): T {
  if (!raw || typeof raw !== 'object') return raw
  const s = raw as Record<string, unknown>
  const props = (s.props ?? {}) as Record<string, unknown>
  // `props.student` is a JSON STRING; parse it.
  let studentProps: Record<string, unknown> = {}
  const rawStudent = props.student
  if (typeof rawStudent === 'string' && rawStudent !== '') {
    try { studentProps = JSON.parse(rawStudent) } catch { /* leave empty */ }
  } else if (rawStudent && typeof rawStudent === 'object') {
    studentProps = rawStudent as Record<string, unknown>
  }

  const firstname = (s.firstname as string) ?? (s.user as Record<string, unknown> | undefined)?.firstname as string | undefined
  const lastname = (s.lastname as string) ?? (s.user as Record<string, unknown> | undefined)?.lastname as string | undefined

  // Lift student props to top level (without clobbering existing user fields).
  const lifted: Record<string, unknown> = {
    userId: s.userId ?? s.id,
    firstname,
    lastname,
    // status lives under the canonical `student_status` prop key
    status: studentProps.student_status ?? s.status,
    gender: studentProps.gender ?? s.gender,
    code: studentProps.code ?? s.code,
    dob: studentProps.dob ?? s.dob,
    school: studentProps.school ?? s.school,
    schoolGrade: studentProps.school_grade ?? studentProps.schoolGrade ?? s.schoolGrade,
    parentName: studentProps.parent_name ?? studentProps.parentName ?? s.parentName,
    vmgClassCode: studentProps.vmg_class_code ?? studentProps.vmgClassCode ?? s.vmgClassCode,
    notes: studentProps.notes ?? s.notes,
  }
  // Synthesize a display `name` from firstname/lastname (Vietnamese: lastname
  // is the given name, firstname is the family name).
  if (s.name === undefined) {
    lifted.name = [firstname, lastname].filter(Boolean).join(' ').trim() || s.username || ''
  }
  return { ...s, ...lifted } as T
}

function denormalizeStudents<T>(value: unknown): T {
  if (value === null || value === undefined) return value as T
  if (Array.isArray(value)) return value.map(denormalizeStudent) as T
  if (typeof value === 'object') return denormalizeStudent(value as Record<string, unknown>) as T
  return value as T
}

// ─── Outbound transforms (request bodies) ───────────────────────────

/**
 * Combine a 'yyyy-MM-dd' date and an 'HH:mm' time-of-day into epoch
 * milliseconds, anchored to Vietnam time (UTC+7) so the instant is
 * deterministic regardless of the browser's locale.
 * Returns null if either part is missing/invalid.
 */
function combineDateAndTime(dateStr: string, timeStr: string): number | null {
  if (!dateStr || !timeStr) return null
  const d = new Date(`${dateStr}T${timeStr}:00+07:00`)
  return isNaN(d.getTime()) ? null : d.getTime()
}

/**
 * Convert a flat create/update session form value (date 'yyyy-MM-dd',
 * startTime/endTime 'HH:mm') into the backend wire shape: date as
 * "YYYY-MM-DD", startTime/endTime as epoch ms (UTC+7 anchored). Extra
 * controls (repeatUntil, force) pass through `rest` and are snake_cased
 * by the request helpers.
 */
function buildSessionPayload(values: Record<string, unknown>): Record<string, unknown> {
  const { date, startTime, endTime, ...rest } = values
  const start = combineDateAndTime(String(date ?? ''), String(startTime ?? ''))
  const end = combineDateAndTime(String(date ?? ''), String(endTime ?? ''))
  const payload: Record<string, unknown> = { ...rest }
  // Backend VnTime decodes the date-only form "YYYY-MM-DD" (full RFC3339 is
  // also tolerated server-side, but date-only is the canonical wire shape —
  // this used to send toISOString(), which the server rejected with 400).
  if (date) payload.date = date
  if (start !== null) payload.startTime = start
  if (end !== null) payload.endTime = end
  return payload
}

/**
 * Split a flat student form value into the backend wrapper
 * `{ user: <model.User>, props: <map> }`. The server stores props as JSON under
 * `user.props["student"]`. Canonical prop keys: gender, student_status.
 */
function buildStudentPayload(values: Record<string, unknown>): { user: Record<string, unknown>; props: Record<string, unknown> } {
  const {
    firstname, lastname, email, phone, parentId, branchId,
    code, gender, status, dob, school, schoolGrade, parentName, vmgClassCode, notes,
  } = values

  const user: Record<string, unknown> = {}
  if (firstname !== undefined) user.firstname = firstname
  if (lastname !== undefined) user.lastname = lastname
  if (email !== undefined) user.email = email
  if (phone !== undefined) user.phone = phone
  if (parentId !== undefined) user.parentId = parentId
  if (branchId !== undefined) user.branchId = branchId

  const props: Record<string, unknown> = {}
  if (code !== undefined) props.code = code
  if (gender !== undefined && gender !== '') props.gender = gender
  if (status !== undefined && status !== '') props.student_status = status
  if (dob !== undefined && dob !== '') props.dob = dob
  if (school !== undefined && school !== '') props.school = school
  if (schoolGrade !== undefined && schoolGrade !== '') props.school_grade = schoolGrade
  if (parentName !== undefined && parentName !== '') props.parent_name = parentName
  if (vmgClassCode !== undefined && vmgClassCode !== '') props.vmg_class_code = vmgClassCode
  if (notes !== undefined && notes !== '') props.notes = notes

  return { user, props }
}

/**
 * Convert a flat bulk-assign homework form value into the backend nested body
 * `{ homework: {...}, student_ids: [...] }`. See homework.go bulkAssignHomework.
 */
function buildBulkAssignPayload(values: Record<string, unknown>): { homework: Record<string, unknown>; studentIds: unknown } {
  const { studentIds, ...homeworkFields } = values
  return { homework: homeworkFields, studentIds }
}

/** Result of a paginated search — items plus the server-reported total count. */
export interface PaginatedList<T> {
  items: T[]
  totalCount: number
}

// ─── Shared response handling ──────────────────────────────────────
// The Go backend serializes errors as a Mattermost AppError:
//   { id, message, detailed_error, request_id, status_code }
// (`message` is the human-readable, locale-translated string). Some older paths
// emit `{ error }`. We read `message` first, fall back to `error`.

/** Normalize a parsed JSON error body into a thrown Error (or ValidationError). */
function throwApiError(status: number, err: { message?: string; error?: string; errors?: unknown; conflicts?: unknown }) {
  if (status === 403) {
    throw new Error(err.message || err.error || 'Bạn không có quyền thực hiện thao tác này')
  }
  // 422 — structured validation errors from server-side parsing
  if (status === 422 && Array.isArray(err.errors)) {
    throw new ValidationError(err.errors, err.message || err.error || 'Dữ liệu không hợp lệ')
  }
  // 409 + conflicts — teacher schedule overlap on session create/update.
  // The payload carries the conflicting sessions for review (date/time/
  // class/teacher); the user can retry with force after acknowledging.
  if (status === 409 && Array.isArray(err.conflicts)) {
    throw new SessionConflictError(err.message || err.error || 'Trùng lịch giáo viên', toCamel<SessionConflictItem[]>(err.conflicts))
  }
  throw new Error(err.message || err.error || 'Lỗi hệ thống')
}

/**
 * Parse a fetch Response from an authenticated API call.
 * - 401 → dispatch `auth:expired` (handled by the store) and throw.
 * - !ok → throw a localized Error / ValidationError from the AppError body.
 * - ok → return the parsed JSON (still snake_case; callers run toCamel).
 */
async function readJson(res: Response): Promise<any> {
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    throw new Error('Phiên đăng nhập đã hết hạn')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throwApiError(res.status, err)
  }
  return res.json()
}

/** Pull an array of items out of a response that may be `{items}`, `{data}`, or a raw array. */
function extractItems(json: any): any[] {
  return Array.isArray(json?.items) ? json.items
    : Array.isArray(json?.data) ? json.data
      : Array.isArray(json) ? json
        : []
}

// ─── Core fetchers ─────────────────────────────────────────────────
// All use cookie auth (credentials:'include') + X-Requested-With for CSRF.

/** Single-object endpoint. Unwraps `{ data }` and camelCases the result. */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: authHeaders(options?.headers),
    ...options,
  })
  const json = await readJson(res)
  // Unwrap { data: ... } envelope when present (but not when { items } is also present).
  const raw = json.data !== undefined && json.items === undefined ? json.data : json
  return coerceDecimals<T>(toCamel<T>(raw))
}

/** List endpoint (GET or POST with body). Returns only the items, camelCased. */
async function apiFetchList<T>(path: string, options?: RequestInit): Promise<T[]> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: authHeaders(options?.headers),
    ...options,
  })
  const json = await readJson(res)
  return coerceDecimals<T[]>(toCamel<T[]>(extractItems(json)))
}

/**
 * POST a search/filter body to a paginated list endpoint. Returns items plus
 * the server-reported total_count, so the UI can render server-driven paging.
 */
async function apiSearchPaginated<T>(path: string, body: unknown): Promise<PaginatedList<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
    body: JSON.stringify(toSnake(body)),
  })
  const json = await readJson(res)
  const items = extractItems(json)
  const totalCount = typeof json.total_count === 'number' ? json.total_count : items.length
  return { items: coerceDecimals<T[]>(toCamel<T[]>(items)), totalCount }
}

/** Fetch a list, returning only the items (drops total_count). */
async function apiSearchList<T>(path: string, body: unknown): Promise<T[]> {
  const result = await apiSearchPaginated<T>(path, body)
  return result.items
}

// ─── Convenience helpers ─────────────────────────────────────────
const apiGet = <T>(path: string): Promise<T> => apiFetch<T>(path)
const apiPost = <T>(path: string, data: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(toSnake(data)) })
const apiPut = <T>(path: string, data: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(toSnake(data)) })
const apiDelete = <T>(path: string): Promise<T> => apiFetch<T>(path, { method: 'DELETE' })


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
    .join(' ')
}

export const login = async (email: string, password: string) => {
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
  const userData: UserProfile = await res.json()

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
export const getMe = (): Promise<UserProfile | null> => {
  return fetch('/api/v4/users/me', {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  }).then(async (r) => {
    if (!r.ok) return null
    const json: UserProfile = await r.json()
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

/**
 * Fetch a public endpoint and throw a localized error on failure. Public
 * endpoints are unauthenticated, so they don't dispatch `auth:expired` or use
 * the CSRF header. Returns the parsed JSON (still snake_case).
 * @param defaultError message shown if the backend didn't provide one.
 */
async function publicJson(path: string, init: RequestInit, defaultError: string): Promise<any> {
  const res = await fetch(`${PUBLIC_BASE}${path}`, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    // Mattermost AppError puts the human-readable text in `message`; some older
    // paths use `error`. Prefer the server message so users see exactly what the
    // backend reports (e.g. "An account with that email already exists.").
    throw new Error(err.message || err.error || defaultError)
  }
  return res.json()
}

const jsonBody = (data: unknown): string => JSON.stringify(toSnake(data))

export const getPublicCourses = (): Promise<Course[]> =>
  fetch(`${PUBLIC_BASE}/courses`, { credentials: 'include' })
    .then((r) => r.json())
    .then((json) => toCamel<Course[]>(extractItems(json)))

export const getPublicPosts = (): Promise<PostListItem[]> =>
  fetch(`${PUBLIC_BASE}/posts`, { credentials: 'include' })
    .then((r) => r.json())
    .then((json) => toCamel<PostListItem[]>(extractItems(json)))

export const submitRegistration = (data: Record<string, unknown>) =>
  publicJson('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: jsonBody(data) }, 'Đăng ký thất bại')
    .then((json) => json.data ?? json)

export const submitContact = (data: { name: string; email: string; phone: string; message: string }) =>
  publicJson('/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: jsonBody(data) }, 'Gửi tin nhắn thất bại')
    .then((json) => json.data ?? json)

export const sendPasswordReset = (email: string) =>
  publicJson('/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }, 'Gửi yêu cầu thất bại') as Promise<{ success: boolean; message: string }>

export const verifyResetToken = (token: string) =>
  fetch(`${PUBLIC_BASE}/verify-token?token=${encodeURIComponent(token)}`)
    .then((r) => r.json()) as Promise<{ valid: boolean }>

export const resetPassword = (token: string, password: string) =>
  publicJson('/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) }, 'Đặt lại mật khẩu thất bại') as Promise<{ success: boolean; message: string }>

// ─── Users ─────────────────────────────────────────────────────────

export interface GetUsersParams {
  role?: string
  /** Include soft-deleted (deactivated) users in the result. */
  includeInactive?: boolean
  /** Restrict to users holding any staff/employee LMS role. */
  staffOnly?: boolean
}

/**
 * Best-effort display name for a Mattermost UserProfile.
 *
 * The backend serializes names as `firstname`/`lastname` (lowercase, no
 * underscore — see model.User json tags), while @mattermost/types declares
 * `first_name`/`last_name`. Read both spellings and fall back to username.
 */
export function getUserDisplayName(user: Partial<UserProfile> | null | undefined): string {
  if (!user) return ''
  const anyUser = user as Record<string, unknown>
  const first = (anyUser.firstname as string) ?? (anyUser.first_name as string) ?? ''
  const last = (anyUser.lastname as string) ?? (anyUser.last_name as string) ?? ''
  return [first, last].filter(Boolean).join(' ').trim() || user.username || ''
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
    opts.employee_only = true;
  }
  return apiSearchPaginated<UserProfile>(`/users/search2`, opts)
}
export const createUser = (data: CreateUserInput): Promise<UserProfile> => apiPost<UserProfile>('/lms/users', data)
export const updateUser = (id: string, data: UpdateUserInput): Promise<UserProfile> => apiPut<UserProfile>(`/lms/users/${id}`, data)
export const deleteUser = (id: string): Promise<void> => apiDelete<void>(`/lms/users/${id}`)
/** Soft-deactivate an employee (blocks login, keeps the record). */
export const deactivateUser = (id: string): Promise<UserProfile> => apiPost<UserProfile>(`/lms/users/${id}/deactivate`, {})
/** Reactivate a previously deactivated employee. */
export const reactivateUser = (id: string): Promise<UserProfile> => apiPost<UserProfile>(`/lms/users/${id}/reactivate`, {})

// ─── Students ───────────────────────────────────────────────────────
// `opts` is a utils.SearchOpts body (built via src/lib/query.ts). StudentFilterOpts
// also honors top-level `search`, `status`, and `class_id` fields, so callers may
// include those directly in the body alongside the generic where_ands/limit/etc.

/** List students (items only). Denormalizes props.student for display. */
export const getStudents = (opts: SearchOpts = {}): Promise<Student[]> =>
  apiSearchList<Student>('/lms/students', opts).then((items) => denormalizeStudents<Student[]>(items))
/** List students with total_count for server-driven paging. */
export const getStudentsPaginated = (opts: SearchOpts = {}): Promise<PaginatedList<Student>> =>
  apiSearchPaginated<Student>('/lms/students', opts).then((r) => ({ ...r, items: denormalizeStudents<Student[]>(r.items) }))
// Create/update decode into a wrapper `{ user, props }` (see app/lms/student.go);
// buildStudentPayload splits the flat form value into that shape.
export const createStudent = (data: CreateStudentInput): Promise<Student> =>
  apiPost<Student>('/lms/students/create', buildStudentPayload(data as Record<string, unknown>))
    .then((s) => denormalizeStudents<Student>(s))
export const updateStudent = (id: string, data: UpdateStudentInput): Promise<Student> =>
  apiPut<Student>(`/lms/students/${id}`, buildStudentPayload(data as Record<string, unknown>))
    .then((s) => denormalizeStudents<Student>(s))
export const deleteStudent = (id: string): Promise<void> => apiDelete<void>(`/lms/students/${id}`)

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
export const deleteCourse = (id: string): Promise<void> => apiDelete<void>(`/lms/courses/${id}`)

// ─── Classes ─────────────────────────────────────────────────────────

export const getClasses = (opts: SearchOpts = {}): Promise<Class[]> =>
  apiSearchList<Class>('/lms/classes', opts)

export const getClassesPaginated = (opts: SearchOpts = {}): Promise<PaginatedList<Class>> =>
  apiSearchPaginated<Class>('/lms/classes', opts)
export const createClass = (data: CreateClassInput): Promise<Class> => apiPost<Class>('/lms/classes/create', data)
export const updateClass = (id: string, data: UpdateClassInput): Promise<Class> => apiPut<Class>(`/lms/classes/${id}`, data)
export const deleteClass = (id: string): Promise<void> => apiDelete<void>(`/lms/classes/${id}`)
export const getClassDetail = (id: string): Promise<any> => apiGet(`/lms/classes/${id}`)
export const enrollStudents = (classId: string, studentIds: string[]): Promise<StudentEnrollment[]> =>
  apiPost<StudentEnrollment[]>(`/lms/classes/${classId}/enroll`, { studentIds })
export const unenrollStudent = (classId: string, studentId: string): Promise<void> =>
  apiDelete<void>(`/lms/classes/${classId}/students/${studentId}`)

// ─── Sessions ───────────────────────────────────────────────────────

/**
 * POST /lms/sessions — list sessions. `opts` is a SearchOpts body (typed columns
 * via src/lib/query.ts). NOTE: the `lms_sessions` table has NO `month` and NO
 * `student_id` column — sessions link to students only indirectly via class
 * enrollment. Filter those client-side on the returned list.
 *
 * Inbound normalization: backend `date` is RFC3339 and `start_time`/`end_time`
 * are epoch millis; we convert to 'yyyy-MM-dd' and 'HH:mm' for display.
 */
export const getSessions = (opts: SearchOpts = {}): Promise<SessionListItem[]> =>
  apiSearchPaginated<SessionListItem>('/lms/sessions', opts).then((r) => normalizeSessions<SessionListItem[]>(r.items))
/** Result of a session create (or force-update): the saved rows + count. */
export interface SessionCreateResult {
  sessions: SessionListItem[]
  count: number
}

function toSessionCreateResult(raw: unknown): SessionCreateResult {
  const obj = (raw ?? {}) as Record<string, unknown>
  const list = Array.isArray(obj.sessions)
    ? obj.sessions
    : Array.isArray(raw)
      ? (raw as unknown[])
      : []
  const sessions = normalizeSessions<SessionListItem[]>(list)
  const count = typeof obj.count === 'number' ? obj.count : sessions.length
  return { sessions, count }
}

/** Payload accepted by POST /lms/sessions/create. */
export type SessionSubmitPayload = CreateSessionInput & {
  /** "YYYY-MM-DD" — weekly repeat until this date inclusive ("" = single) */
  repeatUntil?: string
  /** proceed despite teacher schedule conflicts */
  force?: boolean
}

export const createSession = (data: SessionSubmitPayload): Promise<SessionCreateResult> =>
  apiFetch<unknown>('/lms/sessions/create', { method: 'POST', body: JSON.stringify(toSnake(buildSessionPayload(data as Record<string, unknown>))) })
    .then(toSessionCreateResult)

export const updateSession = (id: string, data: UpdateSessionInput & { force?: boolean }): Promise<SessionCreateResult> =>
  apiFetch<unknown>(`/lms/sessions/${id}`, { method: 'PUT', body: JSON.stringify(toSnake(buildSessionPayload(data as Record<string, unknown>))) })
    .then(toSessionCreateResult)
export const deleteSession = (id: string): Promise<void> =>
  apiDelete<void>(`/lms/sessions/${id}`)

// ─── Attendance ────────────────────────────────────────────────────
//
// Both endpoints are session-scoped by the path id and exchange a BARE JSON
// ARRAY of attendance records (the handlers decode/encode []*Attendance):
//   GET  /lms/sessions/{id}/attendance → [Attendance]   (after {data} unwrap)
//   POST /lms/sessions/{id}/attendance → [Attendance]   (full-replace upsert;
//        session_id is forced from the path over any body value)
// There are NO embedded student/session objects — callers join the roster
// client-side via getStudents({ class_id }) (see the attendance views).

export const getSessionAttendance = (sessionId: string): Promise<Attendance[]> =>
  apiFetch<Attendance[]>(`/lms/sessions/${sessionId}/attendance`)
export const saveAttendance = (sessionId: string, records: AttendanceInput[]): Promise<Attendance[]> =>
  apiFetch<Attendance[]>(
    `/lms/sessions/${sessionId}/attendance`,
    { method: 'POST', body: JSON.stringify(toSnake(records)) },
  )

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
// The convert endpoint takes no body — the server builds the student from the
// stored lead (default password Student@123) and marks it ENROLLED.
export const convertLeadToStudent = (leadId: string): Promise<{ user: UserProfile; lead: Lead }> =>
  apiPost<{ user: UserProfile; lead: Lead }>(`/lms/leads/${leadId}/convert`, {})

// ─── Tuitions ──────────────────────────────────────────────────────

export const getTuitions = (opts: SearchOpts = {}): Promise<TuitionListItem[]> =>
  apiSearchList<TuitionListItem>('/lms/tuitions', opts)
export const getTuitionsPaginated = (opts: SearchOpts = {}): Promise<PaginatedList<TuitionListItem>> =>
  apiSearchPaginated<TuitionListItem>('/lms/tuitions', opts)
export const createTuition = (data: CreateTuitionInput): Promise<Tuition> => apiPost<Tuition>('/lms/tuitions/create', data)
export const getTuitionPayments = (tuitionId: string): Promise<PaymentWithUser[]> => apiFetch<PaymentWithUser[]>(`/lms/tuitions/${tuitionId}/payments`)
/** Search payments (POST /lms/payments — PaymentFilterOpts body). */
export const getPayments = (opts: SearchOpts = {}): Promise<PaymentWithUser[]> =>
  apiSearchList<PaymentWithUser>('/lms/payments', opts)
export const getPaymentsPaginated = (opts: SearchOpts = {}): Promise<PaginatedList<PaymentWithUser>> =>
  apiSearchPaginated<PaymentWithUser>('/lms/payments', opts)
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
export const updatePostCategory = (id: string, data: PostCategoryInput): Promise<PostCategory> => apiPut<PostCategory>(`/lms/posts/categories/${id}`, data)
export const deletePostCategory = (id: string): Promise<void> => apiDelete<void>(`/lms/posts/categories/${id}`)
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

export const getDashboard = (role: UserRole, userId?: string): Promise<DashboardStats> => {
  const q = new URLSearchParams({ role })
  if (userId) q.set('user_id', userId)
  return apiFetch<DashboardStats>(`/lms/dashboard?${q}`)
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

// Bulk-assign decodes into a nested body `{ homework, student_ids }`
// (see homework.go bulkAssignHomework), so the flat form value is split here.
export function bulkAssignHomework(data: Record<string, unknown>) {
  return apiPost('/lms/homeworks/bulk-assign', buildBulkAssignPayload(data))
}

export function getHomeworkSubmissions(homeworkId: string) {
  return apiGet<HomeworkSubmission[]>(`/lms/homeworks/${homeworkId}/submissions`)
}

/** Payload for creating/replacing a homework submission (lms_models.Submission). */
export interface SubmitHomeworkInput {
  studentId: string
  /** Student's note accompanying the submission. */
  description?: string
  /** Uploaded file id (see lib/file-upload.ts uploadLmsFile). */
  fileId?: string
}

/**
 * Submit (or re-submit) a homework. The backend upserts by
 * homework_id + student_id — student_id is REQUIRED.
 */
export function submitHomework(homeworkId: string, data: SubmitHomeworkInput) {
  return apiPost<HomeworkSubmission>(`/lms/homeworks/${homeworkId}/submissions`, data)
}

/**
 * Upsert a homework submission (same endpoint as submitHomework). Used by the
 * grading UI: pass the EXISTING submission with `feedback` merged in — the
 * upsert replaces the whole row, so partial payloads would wipe the student's
 * file/description.
 */
export function upsertHomeworkSubmission(homeworkId: string, submission: Partial<HomeworkSubmission> & Pick<HomeworkSubmission, 'studentId'>) {
  return apiPost<HomeworkSubmission>(`/lms/homeworks/${homeworkId}/submissions`, submission)
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
