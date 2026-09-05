import { z } from 'zod/v4'
import { requiredString, optionalString, optionalDateField, idField } from './common'
import { ClassStatus } from './enums'

// Backend contract: server/public/lms_models/classes.go (lms_models.Class).
// Fields: id, course_id, branch_id, name, code, teacher_id, status, room,
// start_date ("YYYY-MM-DD"), end_date ("YYYY-MM-DD" or null — optional),
// chat_channel_id, createat, updateat.
// NOTE: there is NO max_size / maxSize field on the backend Class struct.
// branch_id is a NOT NULL column with no server-side default → required
// here so the form shows the asterisk and blocks an empty submit instead
// of surfacing a server 500.
export const createClassSchema = z.object({
  code: requiredString,
  name: requiredString,
  courseId: idField,
  teacherId: idField,
  room: optionalString,
  status: ClassStatus.optional().default('OPEN'),
  startDate: optionalDateField,
  endDate: optionalDateField,
  branchId: idField,
})

export const updateClassSchema = z.object({
  code: requiredString.optional(),
  name: requiredString.optional(),
  courseId: idField.optional(),
  teacherId: idField.optional(),
  room: optionalString,
  status: ClassStatus.optional(),
  startDate: optionalDateField,
  endDate: optionalDateField,
  branchId: optionalString,
})

export const enrollSchema = z.object({
  studentIds: z.array(idField).min(1, 'Chọn ít nhất 1 học viên'),
})

export type CreateClassInput = z.infer<typeof createClassSchema>
export type UpdateClassInput = z.infer<typeof updateClassSchema>
export type EnrollInput = z.infer<typeof enrollSchema>
