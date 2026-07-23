import { z } from 'zod/v4'
import { requiredString, optionalString, idField } from './common'
import { MaterialVisibility } from './enums'

export const createMaterialSchema = z.object({
  title: requiredString,
  description: optionalString,
  fileUrl: optionalString,
  fileName: optionalString,
  fileType: optionalString,
  courseId: idField,
  unit: optionalString,
  visibility: MaterialVisibility.optional().default('TEACHER_ONLY'),
  uploadedById: idField,
})

export const updateMaterialSchema = z.object({
  title: requiredString.optional(),
  description: optionalString,
  fileUrl: optionalString,
  fileName: optionalString,
  fileType: optionalString,
  courseId: idField.optional(),
  unit: optionalString,
  visibility: MaterialVisibility.optional(),
  uploadedById: idField.optional(),
})

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>
