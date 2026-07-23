import { z } from 'zod/v4'
import { emailField } from './common'

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Mật khẩu là bắt buộc'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token là bắt buộc'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
})
