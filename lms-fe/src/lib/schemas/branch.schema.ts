import { z } from 'zod/v4'
import { requiredString, optionalString, optionalPhoneField } from './common'

export const createBranchSchema = z.object({
  name: requiredString,
  address: optionalString,
  phone: optionalPhoneField,
  email: z.email('Email không hợp lệ').optional().nullable().or(z.literal('')),
  rooms: optionalString,
})

export type CreateBranchInput = z.infer<typeof createBranchSchema>
