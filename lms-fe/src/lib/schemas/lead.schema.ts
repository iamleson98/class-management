import { z } from 'zod/v4'
import { requiredString, emailField, optionalPhoneField, optionalString, optionalDateField, notesField, idField } from './common'
import { LeadStatus, LeadSource, ActivityType } from './enums'

export const createLeadSchema = z.object({
  name: requiredString,
  phone: requiredString,
  email: emailField.optional().nullable().or(z.literal('')),
  age: optionalString,
  school: optionalString,
  need: optionalString,
  source: LeadSource.optional().nullable().or(z.literal('')),
  counselorId: optionalString,
  notes: notesField,
})

export const updateLeadSchema = z.object({
  name: requiredString.optional(),
  phone: requiredString.optional(),
  email: emailField.optional().nullable().or(z.literal('')),
  age: optionalString,
  school: optionalString,
  need: optionalString,
  source: LeadSource.optional().nullable().or(z.literal('')),
  status: LeadStatus.optional(),
  counselorId: optionalString,
  notes: notesField,
  testDate: optionalDateField,
  testResult: optionalString,
  testScore: z.number().min(0).max(100).optional().nullable(),
  studentId: optionalString,
})

export const leadActivitySchema = z.object({
  type: ActivityType,
  content: requiredString,
  nextFollowUp: optionalDateField,
  createdBy: idField,
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type LeadActivityInput = z.infer<typeof leadActivitySchema>
