import { z } from 'zod/v4'

// ─── Roles ───────────────────────────────────────────────────────────
export const UserRole = z.enum([
  'lms_super_admin', 'lms_admin', 'lms_counselor', 'lms_teacher',
  'lms_accountant', 'lms_marketing', 'lms_parent', 'lms_student',
])
export type UserRole = z.infer<typeof UserRole>

// ─── Student ─────────────────────────────────────────────────────────
// Backend canonical values (see server/public/model_helper/lms.go,
// LmsStudentStatusProp). NOTE: 'COMPLETED' is NOT a backend student status.
export const StudentStatus = z.enum([
  'ACTIVE', 'RESERVED', 'DROPPED', 'PENDING',
])
export type StudentStatus = z.infer<typeof StudentStatus>

// Backend only accepts 'male' / 'female' (see model_helper/lms.go
// LmsUserGenderMale / LmsUserGenderFemale).
export const Gender = z.enum(['male', 'female'])
export type Gender = z.infer<typeof Gender>

// ─── Lead ───────────────────────────────────────────────────────────
export const LeadStatus = z.enum([
  'NEW', 'CONTACTED', 'TEST_SCHEDULED', 'TESTED',
  'PENDING_PAYMENT', 'ENROLLED', 'NOT_INTERESTED',
])
export type LeadStatus = z.infer<typeof LeadStatus>

export const LeadSource = z.enum([
  'WEBSITE', 'FACEBOOK', 'REFERRAL', 'PHONE', 'WALK_IN', 'ZALO', 'TIKTOK',
])
export type LeadSource = z.infer<typeof LeadSource>

export const ActivityType = z.enum(['NOTE', 'CALL', 'MEETING', 'EMAIL'])
export type ActivityType = z.infer<typeof ActivityType>

// ─── Course ──────────────────────────────────────────────────────────
export const CourseLevel = z.enum([
  'BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED',
])
export type CourseLevel = z.infer<typeof CourseLevel>

// ─── Class ──────────────────────────────────────────────────────────
// Backend ClassStatus enum (model_helper/lms.go): the full set the validator
// accepts. Matches the STATUS_MAP options offered in the UI.
export const ClassStatus = z.enum(['OPEN', 'CLOSED', 'PAUSED', 'ACTIVE', 'COMPLETED'])
export type ClassStatus = z.infer<typeof ClassStatus>

// ─── Session ─────────────────────────────────────────────────────────
export const SessionStatus = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED'])
export type SessionStatus = z.infer<typeof SessionStatus>

// ─── Task ────────────────────────────────────────────────────────────
export const TaskPriority = z.enum(['HIGH', 'MEDIUM', 'LOW'])
export type TaskPriority = z.infer<typeof TaskPriority>

export const TaskStatus = z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'])
export type TaskStatus = z.infer<typeof TaskStatus>

// ─── Post ─────────────────────────────────────────────────────────────
export const PostStatus = z.enum(['DRAFT', 'PUBLISHED'])
export type PostStatus = z.infer<typeof PostStatus>

// ─── Material ────────────────────────────────────────────────────────
export const MaterialVisibility = z.enum(['PUBLIC', 'TEACHER_ONLY'])
export type MaterialVisibility = z.infer<typeof MaterialVisibility>

export const MaterialType = z.enum([
  'DOCUMENT', 'VIDEO', 'AUDIO', 'EXERCISE', 'IMAGE',
])
export type MaterialType = z.infer<typeof MaterialType>

export const FileType = z.enum(['PDF', 'DOCX', 'PPTX', 'XLSX', 'IMAGE'])
export type FileType = z.infer<typeof FileType>

// ─── Payment ────────────────────────────────────────────────────────
export const PaymentMethod = z.enum(['CASH', 'TRANSFER', 'CARD'])
export type PaymentMethod = z.infer<typeof PaymentMethod>

export const TuitionStatus = z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'])
export type TuitionStatus = z.infer<typeof TuitionStatus>
