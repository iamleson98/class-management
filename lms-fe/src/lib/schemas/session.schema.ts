import { z } from 'zod/v4'
import { requiredString, optionalString, dateField, idField } from './common'
import { SessionStatus } from './enums'

export const createSessionSchema = z.object({
  title: optionalString,
  date: dateField,
  startTime: requiredString,
  endTime: requiredString,
  room: optionalString,
  classId: idField,
  teacherId: idField,
  lessonId: optionalString,
  status: SessionStatus.optional().default('SCHEDULED'),
})

export const updateSessionSchema = z.object({
  title: optionalString,
  date: dateField.optional(),
  startTime: requiredString.optional(),
  endTime: requiredString.optional(),
  room: optionalString,
  classId: idField.optional(),
  teacherId: idField.optional(),
  lessonId: optionalString,
  status: SessionStatus.optional(),
})

export const attendanceRecordSchema = z.object({
  studentId: idField,
  status: requiredString,
  note: optionalString,
})

export const attendanceSchema = z.object({
  records: z.array(attendanceRecordSchema).min(1, 'Chưa có dữ liệu điểm danh'),
})

export type CreateSessionInput = z.infer<typeof createSessionSchema>
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>
export type AttendanceInput = z.infer<typeof attendanceSchema>
