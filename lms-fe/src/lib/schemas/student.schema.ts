import { z } from 'zod/v4'
import { requiredString, emailField, phoneField, optionalEmailField, optionalString, optionalDateField, notesField } from './common'
import { StudentStatus, Gender } from './enums'

export const createStudentSchema = z.object({
  name: requiredString,
  email: optionalEmailField,
  phone: phoneField,
  code: requiredString,
  dob: optionalDateField,
  gender: Gender.or(z.literal('')),
  school: optionalString,
  schoolGrade: optionalString,
  parentId: optionalString,
  parentName: optionalString,
  vmgClassCode: optionalString,
  branchId: optionalString,
  notes: notesField,
  status: StudentStatus.default('ACTIVE'),
})

export const updateStudentSchema = z.object({
  code: requiredString,
  name: requiredString,
  email: optionalEmailField,
  phone: phoneField,
  dob: optionalDateField,
  gender: Gender.or(z.literal('')),
  school: optionalString,
  schoolGrade: optionalString,
  status: StudentStatus,
  parentId: optionalString,
  parentName: optionalString,
  vmgClassCode: optionalString,
  branchId: optionalString,
  notes: notesField,
})

export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
