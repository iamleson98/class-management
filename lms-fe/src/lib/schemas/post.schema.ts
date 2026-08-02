import { z } from 'zod/v4'
import { requiredString, optionalString, idField } from './common'
import { PostStatus } from './enums'

// Backend contract: server/public/lms_models/blog_posts.go (lms_models.BlogPost).
// Wire fields: id, title (req), slug (req, max 220), content, excerpt,
// category_id (req), author_id (req), status (default DRAFT), seo_title,
// seo_description, seo_keywords, published_at (null.Int64 — epoch millis),
// createat, updateat.
// NOTE: there is NO `image_url` field on BlogPost — it is silently dropped.
export const postCategorySchema = z.object({
  name: requiredString,
  slug: z.string().min(1, 'Slug là bắt buộc').max(120),
})

export const createPostSchema = z.object({
  title: requiredString,
  slug: z.string().min(1, 'Slug là bắt buộc').max(220),
  content: optionalString,
  excerpt: optionalString,
  categoryId: idField,
  authorId: idField,
  status: PostStatus.optional().default('DRAFT'),
  // Epoch millis (null.Int64). Set automatically when status flips to PUBLISHED.
  publishedAt: z.number().int().nullable().optional(),
  seoTitle: optionalString,
  seoDescription: optionalString,
  seoKeywords: optionalString,
})

export const updatePostSchema = z.object({
  title: requiredString.optional(),
  slug: z.string().min(1, 'Slug là bắt buộc').max(220).optional(),
  content: optionalString,
  excerpt: optionalString,
  categoryId: idField.optional(),
  status: PostStatus.optional(),
  publishedAt: z.number().int().nullable().optional(),
  seoTitle: optionalString,
  seoDescription: optionalString,
  seoKeywords: optionalString,
})

export type PostCategoryInput = z.infer<typeof postCategorySchema>
export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
