import { z } from 'zod/v4'
import { requiredString, idField, positiveNumber } from './common'

export const createFeePackageSchema = z.object({
  courseId: idField,
  name: requiredString,
  totalFee: positiveNumber,
  sessionsIncluded: z.number().int().min(1, 'Số buổi phải lớn hơn 0'),
  discountPercent: positiveNumber.optional().default(0),
  isActive: z.boolean().optional().default(true),
})

export type CreateFeePackageInput = z.infer<typeof createFeePackageSchema>
