import { z } from 'zod/v4'
import { optionalString, optionalDateField, idField, positiveNumber, notesField } from './common'
import { PaymentMethod, TuitionStatus } from './enums'

const additionalFeeItemSchema = z.object({
  label: z.enum(['BÁN_TRÚ', 'TRÔNG_MUỘN', 'ĐƯA_ĐÓN', 'NỘI_TRÚ', 'TÀI_LIỆU', 'ĐỒNG_PHỤC']),
  amount: positiveNumber,
})

export const createTuitionSchema = z.object({
  studentId: idField,
  classId: idField,
  feePackageId: idField,
  totalAmount: positiveNumber,
  discountType: z.enum(['PERCENT', 'FIXED_VND']).optional().nullable(),
  discountValue: positiveNumber.optional().default(0),
  dueDate: optionalDateField,
  note: notesField,
  additionalFees: z.array(additionalFeeItemSchema).optional().default([]),
})

export const updateTuitionSchema = z.object({
  totalAmount: positiveNumber.optional(),
  discountType: z.enum(['PERCENT', 'FIXED_VND']).optional().nullable(),
  discountValue: positiveNumber.optional(),
  dueDate: optionalDateField,
  note: notesField,
  status: TuitionStatus.optional(),
  additionalFees: z.array(additionalFeeItemSchema).optional(),
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
export type AdditionalFeeItem = z.infer<typeof additionalFeeItemSchema>
