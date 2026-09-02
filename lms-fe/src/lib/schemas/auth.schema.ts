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

/** Change password from the account page (logged-in flow). */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string()
    .min(6, 'Mật khẩu tối thiểu 6 ký tự')
    .regex(/[A-Za-z]/, 'Mật khẩu cần ít nhất 1 chữ cái')
    .regex(/[0-9]/, 'Mật khẩu cần ít nhất 1 chữ số'),
  confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới'),
}).refine((v) => v.newPassword === v.confirmPassword, {
  message: 'Mật khẩu nhập lại không khớp',
  path: ['confirmPassword'],
}).refine((v) => v.newPassword !== v.currentPassword, {
  message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  path: ['newPassword'],
})

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
