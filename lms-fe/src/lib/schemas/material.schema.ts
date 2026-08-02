import { z } from 'zod/v4'
import { requiredString, optionalString, idField } from './common'
import { MaterialVisibility } from './enums'

// Backend contract: server/public/lms_models/materials.go (lms_models.Material).
// Fields: id, title, description, course_id, unit, visibility, file_id (DB
// NOT NULL), uploaded_by_id, version, createat, updateat.
// The file is referenced by `file_id` (a Mattermost FileInfo id), NOT by
// file_url/file_name/file_type — those keys do not exist on the struct.
export const createMaterialSchema = z.object({
  title: requiredString,
  description: optionalString,
  courseId: idField,
  unit: optionalString,
  visibility: MaterialVisibility.optional().default('TEACHER_ONLY'),
  fileId: idField,
  uploadedById: idField,
})

export const updateMaterialSchema = z.object({
  title: requiredString.optional(),
  description: optionalString,
  courseId: idField.optional(),
  unit: optionalString,
  visibility: MaterialVisibility.optional(),
  fileId: idField.optional(),
  uploadedById: idField.optional(),
})

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>
