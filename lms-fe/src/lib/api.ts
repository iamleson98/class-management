import type {
  User, Branch, BranchListItem, Student, Course, Class,
  SessionListItem, Attendance, AttendanceResponse,
  Lead, LeadListItem, LeadActivity,
  FeePackage, FeePackageListItem, Tuition, TuitionListItem,
  Payment, PaymentWithUser, Material, MaterialListItem,
  Task, TaskListItem, Post, PostListItem, PostCategory, PostCategoryWithCount,
  Banner, DashboardData, Notification, NotificationListResponse,
  Homework, HomeworkSubmission, WeeklyReview,
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
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8065'

// Relative base — proxied by Next.js rewrites to the backend
const BASE = '/api/v4/lms'

// ─── snake_case ↔ camelCase key transform ──────────────────────────

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
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
  return transformKeys<T>(data, snakeToCamel)
}

/** Convert all camelCase keys in an object to snake_case. */
function toSnake<T>(data: unknown): T {
  return transformKeys<T>(data, camelToSnake)
}

// ─── Core fetch with Mattermost session auth ────────────────────────
// The Go server handles auth via MMAUTHTOKEN cookie set during login.
// Cookies are sent cross-origin via credentials: 'include'.

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })

  if (res.status === 401) {
    // Session expired — dispatch event for store to handle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    throw new Error('Phiên đăng nhập đã hết hạn')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    // 403 — permission denied
    if (res.status === 403) {
      throw new Error(err.error || 'Bạn không có quyền thực hiện thao tác này')
    }
    // 422 — validation errors from server-side parsing
    if (res.status === 422 && Array.isArray(err.errors)) {
      throw new ValidationError(err.errors, err.error || 'Dữ liệu không hợp lệ')
    }
    throw new Error(err.error || 'Lỗi hệ thống')
  }
  const json = await res.json()
  // Backend wraps some responses in { data: ... }, some in { items, total_count }, some raw.
  // Unwrap { data: ... } envelope when present (but not when { items } is also present).
  const raw = json.data !== undefined && json.items === undefined ? json.data : json
  // Convert snake_case keys to camelCase for frontend consumption.
  return toCamel<T>(raw)
}

// ─── Fetch a list endpoint and extract .items (unwraps ResponseList) ─
async function apiFetchList<T>(path: string, options?: RequestInit): Promise<T[]> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    throw new Error('Phiên đăng nhập đã hết hạn')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    if (res.status === 403) throw new Error(err.error || 'Bạn không có quyền thực hiện thao tác này')
    if (res.status === 422 && Array.isArray(err.errors)) {
      throw new ValidationError(err.errors, err.error || 'Dữ liệu không hợp lệ')
    }
    throw new Error(err.error || 'Lỗi hệ thống')
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
 * POST /api/v4/users/login returns a flat model.User JSON object.
 * The `roles` field is a space-separated string like "system_admin system_user lms_admin".
 * We parse it to extract LMS roles and return a clean object for the store.
 */
export const loginWithMattermost = async (email: string, password: string) => {
  const res = await fetch('/api/v4/users/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ login_id: email, password }),
  })
  if (!res.ok) {
    let errorMsg = 'Email hoặc mật khẩu không đúng'
    try { const err = await res.json(); errorMsg = err.message || err.error || errorMsg } catch { /* use default */ }
    throw new Error(errorMsg)
  }
  const userData: ApiUser = await res.json()
  return userData
}

/**
 * GET /api/v4/users/me returns the same model.User JSON object.
 * This fetch does NOT go through apiFetch (different base path, no LMS prefix).
 */
export const getMe = (): Promise<ApiUser> =>
  fetch('/api/v4/users/me', { credentials: 'include' }).then(async (r) => {
    if (!r.ok) throw new Error('Not authenticated')
    const json = await r.json()
    return json as ApiUser
  })

export const logout = () =>
  fetch('/api/v4/users/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
    .then(() => { })
    .catch(() => { /* session may already be expired — ignore */ })

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

export const getUsers = (role?: string): Promise<User[]> => apiFetchList<User>(`/users${role ? `?role=${role}` : ''}`)
export const createUser = (data: CreateUserInput): Promise<User> => apiPost<User>('/users', data)
export const updateUser = (id: string, data: UpdateUserInput): Promise<User> => apiPut<User>(`/users/${id}`, data)
export const deleteUser = (id: string): Promise<void> => apiDelete<void>(`/users/${id}`)

// ─── Students ───────────────────────────────────────────────────────

export const getStudents = (params?: { classId?: string; status?: string; search?: string }): Promise<Student[]> => {
  const q = new URLSearchParams()
  if (params?.classId) q.set('class_id', params.classId)
  if (params?.status) q.set('status', params.status)
  if (params?.search) q.set('search', params.search)
  return apiFetchList<Student>(`/students${q.toString() ? `?${q}` : ''}`)
}
export const createStudent = (data: CreateStudentInput): Promise<Student> => apiPost<Student>('/students', data)
export const updateStudent = (id: string, data: UpdateStudentInput): Promise<Student> => apiPut<Student>(`/students/${id}`, data)
export const deleteStudent = (id: string): Promise<void> => apiFetch<void>(`/students/${id}`, { method: 'DELETE' })

// ─── Courses ────────────────────────────────────────────────────────

export const getCourses = (): Promise<Course[]> => apiFetchList<Course>('/courses')
export const createCourse = (data: CreateCourseInput): Promise<Course> => apiPost<Course>('/courses', data)
export const updateCourse = (id: string, data: UpdateCourseInput): Promise<Course> => apiPut<Course>(`/courses/${id}`, data)
export const deleteCourse = (id: string): Promise<void> => apiFetch<void>(`/courses/${id}`, { method: 'DELETE' })

// ─── Classes ─────────────────────────────────────────────────────────

export const getClasses = (params?: { courseId?: string; status?: string; teacherId?: string }): Promise<Class[]> => {
  const q = new URLSearchParams()
  if (params?.courseId) q.set('course_id', params.courseId)
  if (params?.status) q.set('status', params.status)
  if (params?.teacherId) q.set('teacher_id', params.teacherId)
  return apiFetchList<Class>(`/classes${q.toString() ? `?${q}` : ''}`)
}
export const createClass = (data: CreateClassInput): Promise<Class> => apiPost<Class>('/classes', data)
export const updateClass = (id: string, data: UpdateClassInput): Promise<Class> => apiPut<Class>(`/classes/${id}`, data)
export const deleteClass = (id: string): Promise<void> => apiFetch<void>(`/classes/${id}`, { method: 'DELETE' })
export const getClassDetail = (id: string): Promise<any> => apiGet(`/classes/${id}`)
export const enrollStudents = (classId: string, studentIds: string[]): Promise<Class> =>
  apiPost<Class>(`/classes/${classId}/enroll`, { studentIds })

// ─── Sessions ───────────────────────────────────────────────────────

export const getSessions = (params?: { classId?: string; teacherId?: string; studentId?: string; month?: string; date?: string }): Promise<SessionListItem[]> => {
  const q = new URLSearchParams()
  if (params?.classId) q.set('class_id', params.classId)
  if (params?.teacherId) q.set('teacher_id', params.teacherId)
  if (params?.studentId) q.set('student_id', params.studentId)
  if (params?.month) q.set('month', params.month)
  if (params?.date) q.set('date', params.date)
  return apiFetchList<SessionListItem>(`/sessions${q.toString() ? `?${q}` : ''}`)
}
export const createSession = (data: CreateSessionInput): Promise<SessionListItem> =>
  apiPost<SessionListItem>('/sessions', data)
export const updateSession = (id: string, data: UpdateSessionInput): Promise<SessionListItem> =>
  apiPut<SessionListItem>(`/sessions/${id}`, data)
export const deleteSession = (id: string): Promise<void> =>
  apiDelete<void>(`/sessions/${id}`)

// ─── Attendance ────────────────────────────────────────────────────

export const getSessionAttendance = (sessionId: string): Promise<AttendanceResponse> =>
  apiFetch<AttendanceResponse>(`/sessions/${sessionId}/attendance`)
export const saveAttendance = (sessionId: string, records: AttendanceInput[]): Promise<{ count: number; records: Attendance[] }> =>
  apiPost<{ count: number; records: Attendance[] }>(`/sessions/${sessionId}/attendance`, { records })

// ─── Leads (CRM) ────────────────────────────────────────────────────

export const getLeads = (params?: { status?: string; source?: string; counselorId?: string; search?: string }): Promise<LeadListItem[]> => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.source) q.set('source', params.source)
  if (params?.counselorId) q.set('counselor_id', params.counselorId)
  if (params?.search) q.set('search', params.search)
  return apiFetchList<LeadListItem>(`/leads${q.toString() ? `?${q}` : ''}`)
}
export const createLead = (data: CreateLeadInput): Promise<Lead> => apiPost<Lead>('/leads', data)
export const updateLead = (id: string, data: UpdateLeadInput): Promise<Lead> => apiPut<Lead>(`/leads/${id}`, data)
export const deleteLead = (id: string): Promise<void> => apiDelete<void>(`/leads/${id}`)
export const getLeadActivities = (leadId: string): Promise<LeadActivity[]> => apiFetch<LeadActivity[]>(`/leads/${leadId}/activities`)
export const createLeadActivity = (leadId: string, data: LeadActivityInput): Promise<LeadActivity> =>
  apiPost<LeadActivity>(`/leads/${leadId}/activities`, data)
export const convertLeadToStudent = (leadId: string, data: Record<string, unknown>): Promise<Lead> =>
  apiPost<Lead>(`/leads/${leadId}/convert`, data)

// ─── Tuitions ──────────────────────────────────────────────────────

export const getTuitions = (params?: { studentId?: string; classId?: string; status?: string }): Promise<TuitionListItem[]> => {
  const q = new URLSearchParams()
  if (params?.studentId) q.set('student_id', params.studentId)
  if (params?.classId) q.set('class_id', params.classId)
  if (params?.status) q.set('status', params.status)
  return apiFetchList<TuitionListItem>(`/tuitions${q.toString() ? `?${q}` : ''}`)
}
export const createTuition = (data: CreateTuitionInput): Promise<Tuition> => apiPost<Tuition>('/tuitions', data)
export const getTuitionPayments = (tuitionId: string): Promise<PaymentWithUser[]> => apiFetch<PaymentWithUser[]>(`/tuitions/${tuitionId}/payments`)
export const createPayment = (tuitionId: string, data: PaymentInput): Promise<Payment> =>
  apiPost<Payment>(`/tuitions/${tuitionId}/payments`, data)

// ─── Materials ──────────────────────────────────────────────────────

export const getMaterials = (params?: { courseId?: string; visibility?: string }): Promise<MaterialListItem[]> => {
  const q = new URLSearchParams()
  if (params?.courseId) q.set('course_id', params.courseId)
  if (params?.visibility) q.set('visibility', params.visibility)
  return apiFetchList<MaterialListItem>(`/materials${q.toString() ? `?${q}` : ''}`)
}
export const createMaterial = (data: CreateMaterialInput): Promise<Material> => apiPost<Material>('/materials', data)
export const updateMaterial = (id: string, data: UpdateMaterialInput): Promise<Material> => apiPut<Material>(`/materials/${id}`, data)
export const deleteMaterial = (id: string): Promise<void> => apiDelete<void>(`/materials/${id}`)

// ─── Tasks ───────────────────────────────────────────────────────────

export const getTasks = (params?: { assigneeId?: string; status?: string }): Promise<TaskListItem[]> => {
  const q = new URLSearchParams()
  if (params?.assigneeId) q.set('assignee_id', params.assigneeId)
  if (params?.status) q.set('status', params.status)
  return apiFetchList<TaskListItem>(`/tasks${q.toString() ? `?${q}` : ''}`)
}
export const createTask = (data: CreateTaskInput): Promise<Task> => apiPost<Task>('/tasks', data)
export const updateTask = (id: string, data: UpdateTaskInput): Promise<Task> => apiPut<Task>(`/tasks/${id}`, data)
export const deleteTask = (id: string): Promise<void> => apiDelete<void>(`/tasks/${id}`)

// ─── CMS — note: Go routes use /posts/categories not /post-categories
export const getPostCategories = (): Promise<PostCategoryWithCount[]> => apiFetchList<PostCategoryWithCount>('/posts/categories')
export const getPosts = (params?: { status?: string; categoryId?: string }): Promise<PostListItem[]> => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.categoryId) q.set('category_id', params.categoryId)
  return apiFetchList<PostListItem>(`/posts${q.toString() ? `?${q}` : ''}`)
}
export const createPost = (data: CreatePostInput): Promise<Post> => apiPost<Post>('/posts', data)
export const updatePost = (id: string, data: UpdatePostInput): Promise<Post> => apiPut<Post>(`/posts/${id}`, data)
export const deletePost = (id: string): Promise<void> => apiDelete<void>(`/posts/${id}`)
export const createPostCategory = (data: PostCategoryInput): Promise<PostCategory> => apiPost<PostCategory>('/posts/categories', data)
export const getBanners = (): Promise<Banner[]> => apiFetchList<Banner>('/banners')

// ─── Branches ────────────────────────────────────────────────────────

export const getBranches = (): Promise<BranchListItem[]> => apiFetchList<BranchListItem>('/branches')
export const createBranch = (data: CreateBranchInput): Promise<Branch> => apiPost<Branch>('/branches', data)

// ─── Fee Packages ────────────────────────────────────────────────────

export const getFeePackages = (params?: { courseId?: string }): Promise<FeePackageListItem[]> => {
  const q = new URLSearchParams()
  if (params?.courseId) q.set('course_id', params.courseId)
  return apiFetchList<FeePackageListItem>(`/fee-packages${q.toString() ? `?${q}` : ''}`)
}
export const createFeePackage = (data: CreateFeePackageInput): Promise<FeePackage> =>
  apiPost<FeePackage>('/fee-packages', data)

// ─── Banners ────────────────────────────────────────────────────────

export const createBanner = (data: CreateBannerInput): Promise<Banner> => apiPost<Banner>('/banners', data)
export const updateBanner = (id: string, data: UpdateBannerInput): Promise<Banner> => apiPut<Banner>(`/banners/${id}`, data)

// ─── Notifications ──────────────────────────────────────────────────

export const getNotifications = (): Promise<NotificationListResponse> =>
  apiFetch<NotificationListResponse>('/notifications')
export const markNotificationRead = (id: string): Promise<void> => apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' })

// ─── Dashboard & Reports ────────────────────────────────────────────

export const getDashboard = (role: string, userId?: string): Promise<DashboardData> => {
  const q = new URLSearchParams({ role })
  if (userId) q.set('user_id', userId)
  return apiFetch<DashboardData>(`/dashboard?${q}`)
}
export const getReport = (type: string, params?: Record<string, string>): Promise<Record<string, any>> => {
  const q = new URLSearchParams({ type, ...params })
  return apiFetch<Record<string, any>>(`/reports?${q}`)
}

// ─── Homework (Go routes use /homeworks) ────────────────────────────

export function getHomework(params?: { classId?: string; studentId?: string; teacherId?: string; courseId?: string }) {
  const query = new URLSearchParams()
  if (params?.classId) query.set('class_id', params.classId)
  if (params?.studentId) query.set('student_id', params.studentId)
  if (params?.teacherId) query.set('teacher_id', params.teacherId)
  if (params?.courseId) query.set('course_id', params.courseId)
  return apiGet<Homework[]>(`/homeworks?${query.toString()}`)
}

export function getHomeworkById(id: string) {
  return apiGet(`/homeworks/${id}`)
}

export function createHomework(data: Record<string, unknown>) {
  return apiPost('/homeworks', data)
}

export function updateHomework(id: string, data: Record<string, unknown>) {
  return apiPut(`/homeworks/${id}`, data)
}

export function deleteHomework(id: string) {
  return apiDelete(`/homeworks/${id}`)
}

export function bulkAssignHomework(data: Record<string, unknown>) {
  return apiPost('/homeworks/bulk-assign', data)
}

export function getHomeworkSubmissions(homeworkId: string) {
  return apiGet<HomeworkSubmission[]>(`/homeworks/${homeworkId}/submissions`)
}

export function submitHomework(data: Record<string, unknown>) {
  return apiPost(`/homeworks/${data.homeworkId}/submissions`, data)
}

export function gradeHomework(homeworkId: string, data: Record<string, unknown>) {
  return apiPut(`/homeworks/${homeworkId}/submissions`, data)
}

// ─── Weekly Reviews ──────────────────────────────────────────────────

export function getWeeklyReviews(params?: { studentId?: string; classId?: string }) {
  const query = new URLSearchParams()
  if (params?.studentId) query.set('student_id', params.studentId)
  if (params?.classId) query.set('class_id', params.classId)
  return apiGet<WeeklyReview[]>(`/weekly-reviews?${query.toString()}`)
}

export function createWeeklyReview(data: Record<string, unknown>) {
  return apiPost('/weekly-reviews', data)
}

export function updateWeeklyReview(id: string, data: Record<string, unknown>) {
  return apiPut(`/weekly-reviews/${id}`, data)
}

export function deleteWeeklyReview(id: string) {
  return apiDelete(`/weekly-reviews/${id}`)
}

// ─── Class Media ─────────────────────────────────────────────────────

export function getClassMedia(params?: { classId?: string; sessionId?: string }) {
  const query = new URLSearchParams()
  if (params?.classId) query.set('class_id', params.classId)
  if (params?.sessionId) query.set('session_id', params.sessionId)
  return apiGet(`/class-media?${query.toString()}`)
}

export function createClassMedia(data: Record<string, unknown>) {
  return apiPost('/class-media', data)
}

export function deleteClassMedia(id: string) {
  return apiDelete(`/class-media/${id}`)
}
