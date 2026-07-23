import { z } from 'zod/v4'
import { requiredString, optionalString, idField } from './common'

export const createClassMediaSchema = z.object({
  classId: idField,
  sessionId: idField.optional().nullable().or(z.literal('')),
  title: optionalString,
  fileUrl: requiredString,
  fileType: z.enum(['PHOTO', 'VIDEO']),
  uploadedById: idField,
})

export type CreateClassMediaInput = z.infer<typeof createClassMediaSchema>
