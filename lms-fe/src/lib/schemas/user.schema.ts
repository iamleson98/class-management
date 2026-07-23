import { z } from 'zod/v4'
import { requiredString, emailField, optionalPhoneField, optionalString } from './common'
import { UserRole } from './enums'

export const createUserSchema = z.object({
  name: requiredString,
  email: emailField,
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional().nullable().or(z.literal('')),
  phone: optionalPhoneField,
  role: UserRole,
  avatar: optionalString,
  branchId: optionalString,
})

export const updateUserSchema = z.object({
  name: requiredString.optional(),
  email: emailField.optional(),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional().nullable().or(z.literal('')),
  phone: optionalPhoneField,
  role: UserRole.optional(),
  avatar: optionalString,
  isActive: z.boolean().optional(),
  branchId: optionalString,
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
