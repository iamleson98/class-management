/**
 * Entity & response types for the VMG API.
 *
 * These represent the shapes that API routes actually return — including
 * computed fields (e.g. `studentName`, `_count`), selective relation includes,
 * and mapped list responses.  Keep in sync with the route handlers.
 *
 * IMPORTANT: The backend returns snake_case JSON (e.g. `course_id`, `createat`).
 * The apiFetch layer auto-converts snake_case → camelCase, so types here use
 * camelCase which is idiomatic TypeScript.
 */

// ─── Common ─────────────────────────────────────────────────────────

/** ISO-8601 date string as produced by JSON.stringify(new Date()) */
type IsoDate = string

/** Unix timestamp in milliseconds (as returned by backend `createat`/`updateat`) */
type UnixMs = number

// Re-export enum types so consumers can import from a single barrel
export type { UserRole, StudentStatus, Gender, LeadStatus, LeadSource, ActivityType, CourseLevel, ClassStatus, SessionStatus, TaskPriority, TaskStatus, PostStatus, MaterialVisibility, MaterialType, FileType, PaymentMethod, TuitionStatus } from './enums'

// ─── Auth — matches model.User from backend ──────────────────────────

/**
 * Raw Mattermost user shape returned by POST /api/v4/users/login
 * and GET /api/v4/users/me. Fields are ALL lowercase (Mattermost legacy).
 *
 * After apiFetch processing (snake→camel), the fields stay the same
 * since Mattermost uses no underscores except `parent_id`.
 */
export interface ApiUser {
  id: string
  createat: UnixMs
  updateat: UnixMs
  deleteat: number
  username: string
  authservice: string
  email: string
  emailverified: boolean
  nickname: string
  firstname: string
  lastname: string
  /** Optional display name (may come from backend joins) */
  name?: string
  position: string
  /** Space-separated role string, e.g. "system_admin system_user lms_admin" */
  roles: string
  allowmarketing: boolean
  props: Record<string, unknown>
  notifyprops: Record<string, unknown>
  locale: string
  phone: string | null
  parentId: string | null
  lastactivityat: number
  isbot: boolean
}

// ─── Dashboard ────────────────────────────────────────────────────

/**
 * GET /lms/dashboard — currently returns flat stats, but components expect
 * richer role-based data. Use a flexible type so both work.
 */
export interface DashboardStats {
  totalChildren?: number
  totalClasses?: number
  totalCourses?: number
  totalLeads?: number
  totalNewLeadsThisMonth?: number
  totalRevenue?: number
  totalStudents?: number
  totalTeachers?: number
  totalUpcomingSessions?: number
}

// ─── User ──────────────────────────────────────────────────────────

export interface User {
  id: string
  username: string
  email: string
  nickname: string
  firstname: string
  lastname: string
  /** Optional display name (may come from backend joins) */
  name?: string
  /** Space-separated role string */
  roles: string
  phone: string | null
  parentId: string | null
  position: string
  /** Non-zero when the account is deactivated (soft delete). */
  deleteat?: number | null
  createat: UnixMs
  updateat: UnixMs
}

// ─── Branch ────────────────────────────────────────────────────────

export interface Branch {
  id: string
  name: string
  address: string | null
  phone: string | null
  createat: UnixMs
  updateat: UnixMs
}

/** GET /api/branches — mapped with computed counts */
export interface BranchListItem extends Branch {
  userCount: number
  studentCount: number
  classCount: number
}

// ─── Course ───────────────────────────────────────────────────────

export interface Course {
  id: string
  code: string
  name: string
  level: string | null
  ageRange: string | null
  totalSessions: number
  durationPerSession: number
  fee: string | null
  description: string | null
  curriculum: string | null
  createat: UnixMs
  updateat: UnixMs
}

// ─── Class ───────────────────────────────────────────────────────

// ─── Student Enrollment — matches lms_models.StudentClass ──────────
// `studentId` stores the Mattermost USER id (students are users, and
// student_classes links them to classes).

export interface StudentEnrollment {
  id: string
  studentId: string
  classId: string
  enrollmentAt: UnixMs
  status: string
  createat: UnixMs
  updateat: UnixMs
  // Optional joined relation (class-detail API includes the student)
  student?: Student
}

export interface Class {
  id: string
  code: string
  name: string
  courseId: string
  teacherId: string
  room: string | null
  status: string
  startDate: number
  /** Planned end date "YYYY-MM-DD" (null = open-ended) — the weekly repeat
   *  option "đến hết thời gian của lớp học" expands to this date. */
  endDate: string | null
  branchId: string | null
  chatChannelId: string
  createat: UnixMs
  updateat: UnixMs
  // Optional joined relations (when backend includes them)
  course?: Course
  teacher?: User
  sessions?: Session[]
  students?: Student[]
  // Enrollment count (Prisma-style _count or inline enrollments relation)
  _count?: { studentEnrollments?: number }
  enrollments?: Array<{ id: string }>
  studentCount?: number
}

// ─── Session ───────────────────────────────────────────────────────
//
// Backend wire shape: `date` is RFC3339 (time.Time), `start_time`/`end_time`
// are int64 epoch millis. The api.ts inbound layer normalizes these to a
// display-friendly shape: `date` → 'yyyy-MM-dd', `startTime`/`endTime` →
// 'HH:mm'. So consumers can treat the three as simple strings.

export interface Session {
  id: string
  title: string | null
  date: string
  startTime: string
  endTime: string
  room: string | null
  classId: string
  teacherId: string
  lessonId: string | null
  status: string
  createat: UnixMs
  updateat: UnixMs
  // Optional joined relations (when backend includes them)
  class?: Class
  teacher?: User
  course?: Course
}

// ─── Attendance ────────────────────────────────────────────────────

export interface Attendance {
  id: string
  sessionId: string
  studentId: string
  status: string
  note: string | null
  locked: boolean
  createat: UnixMs
  updateat: UnixMs
}

// NOTE: the attendance endpoints exchange a bare [Attendance] array — there
// is no {session, records} envelope and no embedded student object. Callers
// join the class roster client-side via getStudents({ class_id }).

// ─── Student ───────────────────────────────────────────────────────
//
// A student is a model.User whose `roles` includes `lms_student`, with
// student-specific data stored as JSON under `user.props["student"]` (see
// app/lms/student.go). The api.ts inbound layer DENORMALIZES this into a flat
// display shape: base user fields + the student props (code, gender, status,
// dob, school, …) at the top level. The nested `user` is kept for fallback
// access to the raw model.User fields.

export interface Student {
  id: string
  userId: string
  // Base model.User fields (denormalized to the top level for convenience)
  username: string
  email: string
  phone: string | null
  parentId: string | null
  branchId: string | null
  // Family/given names lifted from user (or user relation) by denormalizeStudent
  firstname: string | null
  lastname: string | null
  // Student props (from user.props["student"])
  code: string
  name: string
  dob: string | null
  gender: string | null
  school: string | null
  schoolGrade: string | null
  status: string
  notes: string | null
  parentName: string | null
  vmgClassCode: string | null
  // Optional join relations
  user?: User
  enrollments?: Array<{ id: string; classId: string; status: string; className?: string }>
  createat: UnixMs
  updateat: UnixMs
}

// ─── Lead ─────────────────────────────────────────────────────────

export interface Lead {
  id: string
  name: string
  phone: string
  email: string | null
  age: string | null
  school: string | null
  need: string | null
  source: string | null
  status: string
  counselorId: string | null
  notes: string | null
  studentId: string | null
  testDate: string | null
  testResult: string | null
  testScore: string | null
  createat: UnixMs
  updateat: UnixMs
}

export interface LeadActivity {
  id: string
  leadId: string
  type: string
  content: string | null
  nextFollowUp: string | null
  createdBy: string
  createat: UnixMs
}

// ─── Fee Package ──────────────────────────────────────────────────

export interface FeePackage {
  id: string
  courseId: string
  name: string
  totalFee: number
  sessionsIncluded: number
  discountPercent: number
  isActive: boolean
  createat: UnixMs
  updateat: UnixMs
}

// ─── Tuition ──────────────────────────────────────────────────────

export interface Tuition {
  id: string
  studentId: string
  classId: string
  feePackageId: string
  totalAmount: number
  discountAmount: number
  paidAmount: number
  remainingAmount: number
  status: string
  dueDate: string | null
  note: string | null
  createat: UnixMs
  updateat: UnixMs
}

// ─── Payment ──────────────────────────────────────────────────────

export interface Payment {
  id: string
  tuitionId: string
  amount: number
  paymentDate: string | null
  method: string
  receiptNumber: string | null
  paidById: string
  note: string | null
  createat: UnixMs
  updateat: UnixMs
}

// ─── Material ─────────────────────────────────────────────────────

export interface Material {
  id: string
  title: string
  description: string | null
  fileId: string
  courseId: string
  unit: string | null
  visibility: string
  version: number
  uploadedById: string
  createat: UnixMs
  updateat: UnixMs
}

// ─── Task ─────────────────────────────────────────────────────────

export interface Task {
  id: string
  title: string
  description: string | null
  assigneeId: string
  creatorId: string
  deadline: string | null
  priority: string
  status: string
  notes: string | null
  createat: UnixMs
  updateat: UnixMs
}

// ─── Post / CMS ──────────────────────────────────────────────────

export interface PostCategory {
  id: string
  name: string
  slug: string
}

export interface Post {
  id: string
  title: string
  slug: string
  content: string | null
  excerpt: string | null
  categoryId: string
  authorId: string
  status: string
  // Epoch millis (null.Int64 on the backend)
  publishedAt: number | null
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string | null
  createat: UnixMs
  updateat: UnixMs
  // Optional joined relations
  categoryName?: string
  authorName?: string
}

// ─── Banner ───────────────────────────────────────────────────────

export interface Banner {
  id: string
  title: string
  imageUrl: string | null
  linkUrl: string | null
  position: number
  isActive: boolean
  createat: UnixMs
  updateat: UnixMs
}

// ─── Notification ─────────────────────────────────────────────────

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: string | null
  read: boolean
  linkUrl: string | null
  createat: UnixMs
}

/** GET /lms/notifications wrapper */
export interface NotificationListResponse {
  notifications: Notification[]
  unreadCount: number
}

// ─── Homework — matches lms_models.Homework ────────────────────────

export interface Homework {
  id: string
  title: string
  description: string | null
  sessionId: string
  classId: string
  courseId: string
  teacherId: string
  deadline: string
  fileId: string | null
  createat: UnixMs
  updateat: UnixMs
}

// ─── Homework Submission — matches lms_models.Submission ─────────
//
// Note: the submissions table has NO `grade` column — only `feedback`.

export interface HomeworkSubmission {
  id: string
  title: string
  studentId: string
  homeworkId: string
  description: string | null
  fileId: string | null
  feedback: string | null
  createat: UnixMs
  updateat: UnixMs
}

// ─── Weekly Review — matches lms_models.WeeklyReview ────────────────

export interface WeeklyReview {
  id: string
  studentId: string
  classId: string
  weekNumber: number
  content: string
  rating: number | null
  createdBy: string
  createat: UnixMs
  updateat: UnixMs
}

// ─── Class Media — matches lms_models.ClassMedium ───────────────────

export interface ClassMedia {
  id: string
  classId: string
  sessionId: string | null
  title: string | null
  fileUrl: string
  fileType: string
  uploadedById: string
  fileId: string
  createat: UnixMs
  updateat: UnixMs
}

// ─── List-item type aliases (backend returns same struct for list & detail) ─

export type SessionListItem = Session
export type ClassListItem = Class
export type LeadListItem = Lead
export type TuitionListItem = Tuition
export type PaymentWithUser = Payment
export type MaterialListItem = Material
export type PostListItem = Post
export type PostCategoryWithCount = PostCategory & { postCount?: number }
export type TaskListItem = Task
export type FeePackageListItem = FeePackage
export type NotificationListItem = Notification

// ─── API response wrappers ────────────────────────────────────────

/** Backend LMSResponse envelope: { data: T } */
export interface LMSResponse<T> {
  data: T
}

/** Backend ResponseList envelope: { items: T[], total_count: number } */
export interface ResponseList<T> {
  items: T[]
  totalCount: number
}
