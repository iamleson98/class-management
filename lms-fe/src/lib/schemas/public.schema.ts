import { z } from 'zod/v4'
import { requiredString, emailField, optionalPhoneField, optionalString } from './common'

export const registerSchema = z.object({
  name: requiredString,
  phone: requiredString,
  email: emailField.optional().nullable().or(z.literal('')),
  age: optionalString,
  school: optionalString,
  need: optionalString,
  source: optionalString,
})

export const contactSchema = z.object({
  name: requiredString,
  email: emailField.optional().nullable().or(z.literal('')),
  phone: optionalPhoneField,
  message: requiredString.min(10, 'Nội dung tối thiểu 10 ký tự').max(2000, 'Nội dung tối đa 2000 ký tự'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type ContactInput = z.infer<typeof contactSchema>
