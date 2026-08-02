import { z } from 'zod/v4'
import { requiredString, optionalString, optionalPhoneField } from './common'

// Backend contract: server/public/lms_models/branches.go (lms_models.Branch).
// The struct only has: id, name, address, phone, createat, updateat.
// There is NO `email` and NO `rooms` field — those are silently dropped.
export const createBranchSchema = z.object({
  name: requiredString,
  address: optionalString,
  phone: optionalPhoneField,
})

export type CreateBranchInput = z.infer<typeof createBranchSchema>
