import { z } from 'zod/v4'
import { requiredString, idField, positiveNumber } from './common'

export const createWeeklyReviewSchema = z.object({
  studentId: idField,
  classId: idField,
  weekNumber: z.number().int().min(1, 'Tuần phải lớn hơn 0'),
  content: requiredString,
  rating: z.number().int().min(1).max(5).optional().nullable(),
  createdBy: idField,
})

export const updateWeeklyReviewSchema = z.object({
  content: requiredString.optional(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
})

export type CreateWeeklyReviewInput = z.infer<typeof createWeeklyReviewSchema>
export type UpdateWeeklyReviewInput = z.infer<typeof updateWeeklyReviewSchema>
