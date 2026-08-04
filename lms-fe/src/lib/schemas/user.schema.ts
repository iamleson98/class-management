import { z } from 'zod/v4'
import { requiredString, emailField, optionalPhoneField, optionalString } from './common'
import { UserRole } from './enums'

// Backend contract: server/public/model/user.go (model.User). JSON keys are
// lowercase-concatenated (firstname, lastname, emailverified) — the api.ts
// transform layer handles camelCase↔snake_case, so these schemas use the
// idiomatic TS camelCase. There is NO `name` field on model.User — only
// `firstname`/`lastname`. Deactivation is modeled via `deleteat` (handled by
// dedicated /deactivate + /reactivate endpoints), so there is no `isActive`.

export const createUserSchema = z.object({
  firstname: requiredString,
  lastname: optionalString,
  email: emailField,
  // Username is optional: the server auto-derives it from the email's local
  // part when empty (see user.go createUser).
  username: requiredString,
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional().nullable().or(z.literal('')),
  phone: optionalPhoneField,
  // Single role token for create; the backend stores roles as a space-separated
  // string, and a single token is a valid 1-element value.
  roles: UserRole,
  nickname: optionalString,
  position: optionalString,
  avatar: optionalString,
  branchId: optionalString,
})

export const updateUserSchema = z.object({
  firstname: requiredString.optional(),
  lastname: optionalString,
  email: emailField.optional(),
  username: optionalString,
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional().nullable().or(z.literal('')),
  phone: optionalPhoneField,
  roles: UserRole.optional(),
  nickname: optionalString,
  position: optionalString,
  avatar: optionalString,
  branchId: optionalString,
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
