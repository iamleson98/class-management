import { z } from 'zod/v4'
import { requiredString, optionalString, optionalDateField, idField, positiveNumber, notesField } from './common'

export const createHomeworkSchema = z.object({
  title: requiredString,
  description: optionalString,
  fileUrl: optionalString,
  fileName: optionalString,
  sessionId: idField.optional().nullable().or(z.literal('')),
  classId: idField,
  courseId: idField,
  teacherId: idField,
  deadline: optionalDateField,
})

export const updateHomeworkSchema = z.object({
  title: requiredString.optional(),
  description: optionalString,
  fileUrl: optionalString,
  fileName: optionalString,
  deadline: optionalDateField,
})

export const bulkAssignSchema = z.object({
  title: requiredString,
  description: optionalString,
  fileUrl: optionalString,
  fileName: optionalString,
  sessionId: idField.optional().nullable().or(z.literal('')),
  classId: idField,
  courseId: idField,
  teacherId: idField,
  deadline: optionalDateField,
  studentIds: z.array(idField).min(1, 'Chọn ít nhất 1 học sinh'),
})

export const homeworkSubmissionSchema = z.object({
  homeworkId: idField,
  studentId: idField,
  fileUrl: optionalString,
  fileName: optionalString,
})

export const gradeHomeworkSchema = z.object({
  grade: z.string().optional().nullable().or(z.literal('')),
  feedback: optionalString,
})

export type CreateHomeworkInput = z.infer<typeof createHomeworkSchema>
export type UpdateHomeworkInput = z.infer<typeof updateHomeworkSchema>
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>
export type HomeworkSubmissionInput = z.infer<typeof homeworkSubmissionSchema>
export type GradeHomeworkInput = z.infer<typeof gradeHomeworkSchema>
