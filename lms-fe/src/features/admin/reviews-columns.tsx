'use client'

/**
 * Column definitions for the Admin Reviews screen.
 */

import { createColumnHelper } from '@tanstack/react-table'
import { Eye, Pencil, Star, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { WeeklyReview } from '@/lib/schemas'

/** Loose review row (joins may or may not be expanded by the backend). */
export interface ReviewRow extends WeeklyReview {
  studentName?: string
  className?: string
  createdAt?: string
  student?: { name?: string } | null
  class?: { name?: string } | null
}

const columnHelper = createColumnHelper<DataTableFeatures, ReviewRow>()

interface ReviewColumnsHandlers {
  onView: (review: ReviewRow) => void
  onEdit: (review: ReviewRow) => void
  onDelete: (review: ReviewRow) => void
}

/** Small read-only star rating (kept identical to the old inline rendering). */
function StarRating({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const starClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
  return (
    <div className="flex items-center gap-0.5 justify-center" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${starClass} ${i <= value ? 'fill-orange-400 text-orange-400' : 'fill-none text-muted-foreground/30'}`}
        />
      ))}
    </div>
  )
}

export function createReviewColumns(
  t: (key: string, fallback?: string) => string,
  { onView, onEdit, onDelete }: ReviewColumnsHandlers
) {
  return [
    columnHelper.accessor((row) => row.student?.name || row.studentName || '-', {
      id: 'student',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('reviews.student', 'Học viên')} />
      ),
      cell: ({ row }) => <span className="font-medium text-sm">{row.getValue('student')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('reviews.student', 'Học viên') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.class?.name || row.className || '-', {
      id: 'class',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('reviews.className', 'Lớp')} />
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-sm text-muted-foreground">{row.getValue('class')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('reviews.className', 'Lớp'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('weekNumber', {
      id: 'week',
      header: ({ column }) => (
        <div className="text-center">
          <DataTableColumnHeader column={column} title={t('reviews.week', 'Tuần')} />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Badge className="rounded-full text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
            {t('reviews.weekLabel', 'Tuần')} {row.original.weekNumber || '-'}
          </Badge>
        </div>
      ),
      meta: { headerTitle: t('reviews.week', 'Tuần') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('rating', {
      id: 'rating',
      header: ({ column }) => (
        <div className="text-center">
          <DataTableColumnHeader column={column} title={t('reviews.rating', 'Đánh giá')} />
        </div>
      ),
      cell: ({ row }) => <StarRating value={row.original.rating || 0} size="sm" />,
      meta: { headerTitle: t('reviews.rating', 'Đánh giá') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('content', {
      id: 'content',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('reviews.content', 'Nội dung')} />
      ),
      cell: ({ row }) => (
        <span className="hidden lg:table-cell text-sm text-muted-foreground max-w-50 truncate block">
          {row.original.content || '-'}
        </span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('reviews.content', 'Nội dung'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) =>
      row.createdAt
        ? new Date(row.createdAt).toLocaleDateString('vi-VN')
        : row.createat
          ? new Date(row.createat).toLocaleDateString('vi-VN')
          : '-'
    , {
      id: 'date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('reviews.date', 'Ngày')} />
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-sm text-muted-foreground">{row.getValue('date')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('reviews.date', 'Ngày'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide">
          {t('common.actions', 'Thao tác')}
        </span>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.view', 'Xem')} onClick={() => onView(row.original)}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.edit', 'Sửa')} onClick={() => onEdit(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" title={t('common.delete', 'Xóa')} onClick={() => onDelete(row.original)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-28' } satisfies DataTableColumnMeta,
    }),
  ]
}

export { StarRating }
