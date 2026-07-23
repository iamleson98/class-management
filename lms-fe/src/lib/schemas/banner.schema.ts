import { z } from 'zod/v4'
import { requiredString, optionalString, positiveNumber } from './common'

export const createBannerSchema = z.object({
  title: requiredString,
  imageUrl: optionalString,
  linkUrl: optionalString,
  position: positiveNumber.optional().default(0),
  isActive: z.boolean().optional().default(true),
})

export const updateBannerSchema = z.object({
  title: requiredString.optional(),
  imageUrl: optionalString,
  linkUrl: optionalString,
  position: positiveNumber.optional(),
  isActive: z.boolean().optional(),
})

export type CreateBannerInput = z.infer<typeof createBannerSchema>
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>
