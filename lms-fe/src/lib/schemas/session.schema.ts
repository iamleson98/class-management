import { z } from 'zod/v4'
import { requiredString, optionalString, idField } from './common'
import { SessionStatus } from './enums'

// Backend contract: server/public/lms_models/lms_sessions.go (LMSSession).
// Wire fields:
//   - date        → time.Time (RFC3339/ISO-8601 string), required
//   - start_time  → int64 epoch MILLISECONDS
//   - end_time    → int64 epoch MILLISECONDS
//   - title, room (nullable), class_id (req), teacher_id (req), lesson_id, status
//
// The form UX keeps a date picker + time-of-day pickers, so the FORM values are
// user-friendly strings (date 'yyyy-MM-dd', startTime/endTime 'HH:mm'). The
// api.ts boundary converts these to the backend shape on submit (combining
// date + 'HH:mm' into epoch ms for start_time/end_time and an RFC3339 string
// for date), and converts inbound epoch ms back to 'HH:mm' for display.

const timeOfDayField = z
  .string()
  .min(1, 'Giờ không được để trống')
  .regex(/^\d{2}:\d{2}$/, 'Định dạng giờ không hợp lệ (HH:mm)')

export const createSessionSchema = z.object({
  title: optionalString,
  date: requiredString.min(1, 'Ngày không được để trống'),
  startTime: timeOfDayField,
  endTime: timeOfDayField,
  room: optionalString,
  classId: idField,
  teacherId: idField,
  lessonId: optionalString,
  status: SessionStatus.optional().default('SCHEDULED'),
})

export const updateSessionSchema = z.object({
  title: optionalString,
  date: requiredString.min(1, 'Ngày không được để trống').optional(),
  startTime: timeOfDayField.optional(),
  endTime: timeOfDayField.optional(),
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

// Kept for backwards compatibility with existing imports; the attendance save
// endpoint takes a bare JSON array of records (not wrapped in { records }).
export const attendanceSchema = z.object({
  records: z.array(attendanceRecordSchema).min(1, 'Chưa có dữ liệu điểm danh'),
})

export type CreateSessionInput = z.infer<typeof createSessionSchema>
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>
export type AttendanceInput = z.infer<typeof attendanceRecordSchema>
