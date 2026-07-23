import { z } from 'zod/v4'

// ─── Reusable field validators ────────────────────────────────────────
export const requiredString = z
  .string()
  .min(1, 'Trường này là bắt buộc')
  .max(200, 'Tối đa 200 ký tự')

export const optionalString = z
  .string()
  .max(500, 'Tối đa 500 ký tự')
  .optional()
  .nullable()

export const emailField = z.email('Email không hợp lệ')

export const optionalEmailField = z
  .string()
  .email('Email không hợp lệ')
  .or(z.literal(''))
  .optional()
  .nullable()

export const phoneField = z
  .string()
  .regex(/^0[0-9]{9,10}$/, 'Số điện thoại không hợp lệ (bắt đầu bằng 0, 10-11 số)')
  .or(z.literal(''))

export const optionalPhoneField = phoneField.optional().nullable()

export const idField = z.string().min(1, 'ID là bắt buộc')

export const positiveNumber = z
  .number()
  .min(0, 'Giá trị không được âm')

export const dateField = z.string().min(1, 'Ngày không được để trống')

export const optionalDateField = z
  .string()
  .optional()
  .nullable()
  .or(z.literal(''))

export const notesField = z
  .string()
  .max(2000, 'Ghi chú tối đa 2000 ký tự')
  .optional()
  .nullable()
  .or(z.literal(''))
