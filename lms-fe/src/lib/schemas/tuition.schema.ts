import { z } from 'zod/v4'
import { optionalString, optionalDateField, idField, positiveNumber, notesField } from './common'
import { PaymentMethod, TuitionStatus } from './enums'

// Backend contract: server/public/lms_models/tuitions.go (lms_models.Tuition).
// Wire fields: student_id, class_id, fee_package_id, total_amount (decimal),
// discount_amount (read-only, server-computed), paid_amount (read-only),
// remaining_amount (read-only), status, due_date, note, promotional_fee,
// discount_value, discount_type.
//
// IMPORTANT: there is NO `additional_fees` field on the Tuition create/update
// struct (the handler decodes directly into lms_models.Tuition), and no
// additional-fee backend route exists. So additionalFees is omitted — it would
// be silently dropped.

export const createTuitionSchema = z.object({
  studentId: idField,
  classId: idField,
  feePackageId: idField,
  totalAmount: positiveNumber,
  discountType: z.enum(['PERCENT', 'FIXED_VND']).optional().nullable(),
  discountValue: positiveNumber.optional().default(0),
  dueDate: optionalDateField,
  note: notesField,
})

export const updateTuitionSchema = z.object({
  totalAmount: positiveNumber.optional(),
  discountType: z.enum(['PERCENT', 'FIXED_VND']).optional().nullable(),
  discountValue: positiveNumber.optional(),
  dueDate: optionalDateField,
  note: notesField,
  status: TuitionStatus.optional(),
})

export const paymentSchema = z.object({
  amount: positiveNumber.min(1, 'Số tiền thanh toán phải lớn hơn 0'),
  method: PaymentMethod.optional().default('CASH'),
  receiptNumber: optionalString,
  paidById: idField,
  note: notesField,
})

export type CreateTuitionInput = z.infer<typeof createTuitionSchema>
export type UpdateTuitionInput = z.infer<typeof updateTuitionSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
