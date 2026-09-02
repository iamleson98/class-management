'use client'

/**
 * Column definitions for the Admin Tuition screen (shared with the accountant
 * tuition view via a different columns factory).
 */

import { createColumnHelper } from '@tanstack/react-table'
import { CreditCard, Pencil, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Tuition } from '@/lib/schemas'
import { formatVND } from '@/lib/api'

export const TUITION_STATUS_MAP: Record<string, { label: string; className: string }> = {
  PAID: { label: 'Đã thanh toán', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  PARTIAL: { label: 'Đóng một phần', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  UNPAID: { label: 'Chưa thanh toán', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  OVERDUE: { label: 'Quá hạn', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

/** Display helpers shared by tuition screens. */
export function tuitionStudentName(tuition: TuitionRow): string {
  return tuition.student?.name || tuition.studentName || '-'
}

export function tuitionClassName(tuition: TuitionRow): string {
  return tuition.class?.name || tuition.className || '-'
}

export function tuitionTotal(tuition: TuitionRow): number {
  return tuition.totalFee || tuition.totalAmount || 0
}

export function tuitionRemaining(tuition: TuitionRow): number {
  return tuitionTotal(tuition) - (tuition.paidAmount || 0)
}

/** Loose tuition row type (joins may or may not be expanded by the backend). */
export interface TuitionRow extends Tuition {
  totalFee?: number
  studentName?: string
  className?: string
  student?: { name?: string } | null
  class?: { name?: string } | null
}

const columnHelper = createColumnHelper<DataTableFeatures, TuitionRow>()

interface TuitionColumnsHandlers {
  onCollect?: (tuition: TuitionRow) => void
  onEdit?: (tuition: TuitionRow) => void
  onDelete?: (tuition: TuitionRow) => void
}

export function createTuitionColumns(
  t: (key: string, fallback?: string) => string,
  { onCollect, onEdit, onDelete }: TuitionColumnsHandlers = {}
) {
  return [
    columnHelper.accessor(tuitionStudentName, {
      id: 'student',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('tuition.student', 'Học viên')} />
      ),
      cell: ({ row }) => <span className="font-medium text-sm">{row.getValue('student')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('tuition.student', 'Học viên') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor(tuitionClassName, {
      id: 'class',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('tuition.className', 'Lớp')} />
      ),
      cell: ({ row }) => <span className="text-sm">{row.getValue('class')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('tuition.className', 'Lớp') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor(tuitionTotal, {
      id: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('tuition.totalFee', 'Tổng phí')} />
      ),
      cell: ({ row }) => <span className="hidden md:table-cell text-sm">{formatVND(row.getValue<number>('total'))}</span>,
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('tuition.totalFee', 'Tổng phí'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('paidAmount', {
      id: 'paid',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('tuition.paidAmount', 'Đã thu')} />
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-sm text-sky-600">{formatVND(row.original.paidAmount || 0)}</span>
      ),
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('tuition.paidAmount', 'Đã thu'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor(tuitionRemaining, {
      id: 'remaining',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('tuition.remaining', 'Còn thiếu')} />
      ),
      cell: ({ row }) => {
        const remaining = row.getValue<number>('remaining')
        return (
          <span className={cn('text-sm font-medium', remaining > 0 ? 'text-red-600' : 'text-muted-foreground')}>
            {formatVND(remaining)}
          </span>
        )
      },
      meta: { headerTitle: t('tuition.remaining', 'Còn thiếu') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('status', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.status', 'Trạng thái')} />
      ),
      cell: ({ row }) => {
        const status = TUITION_STATUS_MAP[row.original.status] ?? TUITION_STATUS_MAP.UNPAID
        return <Badge className={cn('rounded-full text-xs', status.className)}>{status.label}</Badge>
      },
      filterFn: 'equalsString',
      meta: { headerTitle: t('common.status', 'Trạng thái') } satisfies DataTableColumnMeta,
    }),
    ...(onCollect || onEdit || onDelete
      ? [
          columnHelper.display({
            id: 'actions',
            header: () => (
              <span className="text-xs font-semibold uppercase tracking-wide">
                {t('common.actions', 'Thao tác')}
              </span>
            ),
            cell: ({ row }) => (
              <div className="flex items-center gap-1">
                {onCollect && (
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => onCollect(row.original)}
                    title={t('tuition.collectFee', 'Thu phí')}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onEdit && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(row.original)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                    onClick={() => onDelete(row.original)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ),
            enableSorting: false,
            enableHiding: false,
            meta: { className: 'w-20' } satisfies DataTableColumnMeta,
          }),
        ]
      : []),
  ]
}
