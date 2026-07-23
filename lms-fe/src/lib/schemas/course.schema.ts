import { z } from 'zod/v4'
import { requiredString, optionalString, positiveNumber } from './common'
import { CourseLevel } from './enums'

export const createCourseSchema = z.object({
  code: requiredString,
  name: requiredString,
  level: CourseLevel.or(z.literal('')),
  ageRange: optionalString,
  totalSessions: positiveNumber.default(24),
  durationPerSession: positiveNumber.default(90),
  fee: positiveNumber,
  description: optionalString,
  curriculum: optionalString,
})

export const updateCourseSchema = z.object({
  code: requiredString,
  name: requiredString,
  level: CourseLevel.or(z.literal('')),
  ageRange: optionalString,
  totalSessions: positiveNumber,
  durationPerSession: positiveNumber,
  fee: positiveNumber,
  description: optionalString,
  curriculum: optionalString,
})

export type CreateCourseInput = z.infer<typeof createCourseSchema>
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>
