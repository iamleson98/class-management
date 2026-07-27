/**
 * Typed query builder for the backend's generic listing mechanism.
 *
 * Mirrors the Go types in server/public/utils/query.go:
 *   - utils.SearchOpts  → SearchOpts
 *   - utils.WhereCond   → WhereCond
 *   - utils.OrderBy     → OrderBy
 *   - utils.Operator    → Operator
 *
 * The request body is POSTed to a list endpoint and must use snake_case keys
 * (`where_ands`, `where_ors`, `orderings`, `count_total`) with operator values
 * matching the backend constants EXACTLY (EQ, NEQ, GT, ...). The previous
 * frontend code sent `operator: '='`, which the backend's Operator.IsValid()
 * rejects — silently dropping every condition. These helpers make that
 * impossible by construction.
 *
 * Column names are typed against the generated `ColumnNames` union
 * (src/lib/schemas/columns_defs.ts), which is produced from the backend's
 * columns_defs.go — so any typo or invalid column is a compile error here.
 *
 * NOTE on key casing: all keys below are already snake_case, and `ColumnNames`
 * literals are dotted snake_case strings. apiSearchList runs the body through
 * `toSnake`, which is a no-op on already-snake keys and leaves dotted strings
 * untouched — so the body reaches the backend verbatim.
 */

import type { ColumnNames } from '@/lib/schemas/columns_defs'

/** Comparison operators — must match utils.Operator constants (query.go:16-29). */
export type Operator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'IN'
  | 'NOT IN'
  | 'LIKE'
  | 'ILIKE'
  | 'NOT LIKE'
  | 'NOT ILIKE'

export type OrderDirection = 'ASC' | 'DESC'

/** A single WHERE condition (mirrors utils.WhereCond). */
export interface WhereCond {
  column: ColumnNames
  operator: Operator
  value: unknown
}

/** A single ORDER BY clause (mirrors utils.OrderBy). */
export interface OrderBy {
  column: ColumnNames
  dir: OrderDirection
}

/**
 * The POST body sent to a list endpoint. `search` is a TOP-LEVEL convenience
 * field that only some FilterOpts honor (Student, Class, Lead, Tuition). For
 * entities without it, express text search via `where_ors` with ILIKE.
 *
 * The index signature allows entity-specific FilterOpts fields to be passed
 * straight through to the backend (e.g. StudentFilterOpts.ClassID /
 * StudentFilterOpts.Status, which live at the body root alongside the generic
 * SearchOpts fields — see server/public/model_helper/lms.go). Snake_case keys
 * are used to match the backend JSON tags directly.
 */
export interface SearchOpts {
  search?: string
  where_ands?: WhereCond[]
  where_ors?: WhereCond[]
  orderings?: OrderBy[]
  limit?: number
  offset?: number
  count_total?: boolean
  // Entity-specific top-level FilterOpts fields (e.g. { class_id, status, gender }
  // for StudentFilterOpts). Keys are snake_case to match backend JSON tags.
  [key: string]: unknown
}

// ─── Condition builders ─────────────────────────────────────────────
// Each returns `undefined` when the value is empty, so callers can spread them
// into `and(...)` / `or(...)` without manually filtering.

type Scalar = string | number | boolean | null

function build(op: Operator, col: ColumnNames, value: unknown): WhereCond | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return { column: col, operator: op, value }
}

export const eq = (col: ColumnNames, value?: Scalar) => build('=', col, value)
export const neq = (col: ColumnNames, value?: Scalar) => build('!=', col, value)
export const gt = (col: ColumnNames, value?: Scalar) => build('>', col, value)
export const lt = (col: ColumnNames, value?: Scalar) => build('<', col, value)
export const gte = (col: ColumnNames, value?: Scalar) => build('>=', col, value)
export const lte = (col: ColumnNames, value?: Scalar) => build('<=', col, value)
export const like = (col: ColumnNames, value?: string) => build('LIKE', col, value)
export const ilike = (col: ColumnNames, value?: string) => build('ILIKE', col, value)

/** IN condition — value must be a non-empty array. */
export const in_ = (col: ColumnNames, value: Scalar[]) =>
  Array.isArray(value) && value.length > 0 ? { column: col, operator: 'IN' as Operator, value } : undefined

/** NOT IN condition — value must be a non-empty array. */
export const notIn = (col: ColumnNames, value: Scalar[]) =>
  Array.isArray(value) && value.length > 0 ? { column: col, operator: 'NOT IN' as Operator, value } : undefined

/** ILIKE with wildcards on both ends — the common "contains" search pattern. */
export const contains = (col: ColumnNames, value: string) =>
  value ? { column: col, operator: 'ILIKE' as Operator, value: `%${value}%` } : undefined

/** Collect defined conditions into an AND group (filters out undefined). */
export function and(...conds: Array<WhereCond | undefined>): WhereCond[] {
  return conds.filter((c): c is WhereCond => c !== undefined)
}

/** Collect defined conditions into an OR group (filters out undefined). */
export function or(...conds: Array<WhereCond | undefined>): WhereCond[] {
  return conds.filter((c): c is WhereCond => c !== undefined)
}

// ─── Order builders ─────────────────────────────────────────────────

export const asc = (col: ColumnNames): OrderBy => ({ column: col, dir: 'ASC' })
export const desc = (col: ColumnNames): OrderBy => ({ column: col, dir: 'DESC' })

// ─── Pagination helper ──────────────────────────────────────────────

/**
 * Convert a zero-based page index + page size into the backend's limit/offset,
 * requesting a total count so the UI can render server-driven page controls.
 */
export function paginate(pageIndex: number, pageSize: number): Pick<SearchOpts, 'limit' | 'offset' | 'count_total'> {
  return {
    limit: pageSize,
    offset: pageIndex * pageSize,
    count_total: true,
  }
}
