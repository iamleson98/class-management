import { z } from 'zod/v4'
import { requiredString, optionalString, idField } from './common'
import { PostStatus } from './enums'

export const postCategorySchema = z.object({
  name: requiredString,
  slug: z.string().min(1, 'Slug là bắt buộc').max(100),
})

export const createPostSchema = z.object({
  title: requiredString,
  slug: z.string().min(1, 'Slug là bắt buộc').max(200),
  content: optionalString,
  excerpt: optionalString,
  categoryId: idField,
  imageUrl: optionalString,
  authorId: idField,
  status: PostStatus.optional().default('DRAFT'),
  seoTitle: optionalString,
  seoDescription: optionalString,
  seoKeywords: optionalString,
})

export const updatePostSchema = z.object({
  title: requiredString.optional(),
  slug: z.string().min(1, 'Slug là bắt buộc').max(200).optional(),
  content: optionalString,
  excerpt: optionalString,
  categoryId: idField.optional(),
  imageUrl: optionalString,
  status: PostStatus.optional(),
  seoTitle: optionalString,
  seoDescription: optionalString,
  seoKeywords: optionalString,
})

export type PostCategoryInput = z.infer<typeof postCategorySchema>
export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
