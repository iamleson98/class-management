import { z } from 'zod/v4'
import { requiredString, optionalString, optionalDateField, idField } from './common'

// Backend contract:
//   - lms_models.Homework: id, title, description, session_id (DB NOT NULL),
//     class_id, course_id, teacher_id, deadline (time.Time / RFC3339 string),
//     file_id, createat, updateat. No file_url/file_name.
//   - lms_models.Submission: id, title, student_id, homework_id, description,
//     file_id, feedback, createat, updateat. There is NO `grade` column on the
//     submissions table — only `feedback`. So gradeHomework only sends feedback.
//   - bulk-assign body is nested: { homework: {...}, student_ids: [...] }.
//     See server/channels/api4/lms_api/homework.go bulkAssignHomework.

export const createHomeworkSchema = z.object({
  title: requiredString,
  description: optionalString,
  sessionId: idField.optional().nullable().or(z.literal('')),
  classId: idField,
  courseId: idField,
  teacherId: idField,
  deadline: optionalDateField,
  fileId: idField.optional().nullable().or(z.literal('')),
})

export const updateHomeworkSchema = z.object({
  title: requiredString.optional(),
  description: optionalString,
  deadline: optionalDateField,
  fileId: idField.optional().nullable().or(z.literal('')),
})

// Body for POST /lms/homeworks/bulk-assign — a nested { homework, studentIds }
// object. The api layer converts studentIds → student_ids and nests under
// `homework` automatically (see buildBulkAssignPayload in api.ts).
export const bulkAssignSchema = z.object({
  title: requiredString,
  description: optionalString,
  sessionId: idField.optional().nullable().or(z.literal('')),
  classId: idField,
  courseId: idField,
  teacherId: idField,
  deadline: optionalDateField,
  fileId: idField.optional().nullable().or(z.literal('')),
  studentIds: z.array(idField).min(1, 'Chọn ít nhất 1 học sinh'),
})

// Body for POST /lms/homeworks/{id}/submissions (upsert keyed on
// homework_id + student_id). homework_id is taken from the URL; student_id
// from the body. File referenced by file_id.
export const homeworkSubmissionSchema = z.object({
  homeworkId: idField,
  studentId: idField,
  description: optionalString,
  fileId: idField.optional().nullable().or(z.literal('')),
})

// Body for PUT /lms/homeworks/{id}/submissions. The Submission struct has no
// `grade` field — only `feedback` is writable here.
export const gradeHomeworkSchema = z.object({
  feedback: optionalString,
})

export type CreateHomeworkInput = z.infer<typeof createHomeworkSchema>
export type UpdateHomeworkInput = z.infer<typeof updateHomeworkSchema>
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>
export type HomeworkSubmissionInput = z.infer<typeof homeworkSubmissionSchema>
export type GradeHomeworkInput = z.infer<typeof gradeHomeworkSchema>
