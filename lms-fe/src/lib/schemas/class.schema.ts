import { z } from 'zod/v4'
import { requiredString, optionalString, optionalDateField, idField, positiveNumber } from './common'
import { ClassStatus } from './enums'

export const createClassSchema = z.object({
  code: requiredString,
  name: requiredString,
  courseId: idField,
  teacherId: idField,
  room: optionalString,
  maxSize: positiveNumber.optional().default(15),
  status: ClassStatus.optional().default('OPEN'),
  startDate: optionalDateField,
  branchId: optionalString,
})

export const updateClassSchema = z.object({
  code: requiredString.optional(),
  name: requiredString.optional(),
  courseId: idField.optional(),
  teacherId: idField.optional(),
  room: optionalString,
  maxSize: positiveNumber.optional(),
  status: ClassStatus.optional(),
  startDate: optionalDateField,
  branchId: optionalString,
})

export const enrollSchema = z.object({
  studentIds: z.array(idField).min(1, 'Chọn ít nhất 1 học viên'),
})

export type CreateClassInput = z.infer<typeof createClassSchema>
export type UpdateClassInput = z.infer<typeof updateClassSchema>
export type EnrollInput = z.infer<typeof enrollSchema>
