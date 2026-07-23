import { NextResponse } from 'next/server'
import type { ZodSchema } from 'zod/v4'

interface FieldError {
  field: string
  message: string
}

interface ValidationError {
  field: string
  message: string
}

/**
 * Validates a request body against a Zod schema.
 * Returns the parsed data on success, or a 422 Response on failure.
 */
export function validateBody<T>(schema: ZodSchema<T>, body: unknown): {
  data: T
  error: NextResponse | null
} {
  const result = schema.safeParse(body)
  if (!result.success) {
    const errors: ValidationError[] = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'unknown',
      message: issue.message,
    }))
    return {
      data: null as T,
      error: NextResponse.json(
        { data: null, error: 'Dữ liệu không hợp lệ', errors },
        { status: 422 }
      ),
    }
  }
  return { data: result.data, error: null }
}
