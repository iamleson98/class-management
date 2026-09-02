'use client'

/**
 * Column definitions for the Admin Homework screen.
 */

import { createColumnHelper } from '@tanstack/react-table'
import { AlertTriangle, CheckCircle, Clock, Eye, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Homework } from '@/lib/schemas'

export const HOMEWORK_STATUS_MAP: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  PENDING: { label: 'Chờ nộp', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', icon: Clock },
  GRADED: { label: 'Đã chấm', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: CheckCircle },
  OVERDUE: { label: 'Quá hạn', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
}

export function getHomeworkStatus(
  deadline: string,
  submissionsCount: number,
  totalStudents: number
): string {
  const now = new Date()
  const dl = new Date(deadline)
  if (now > dl && submissionsCount < totalStudents) return 'OVERDUE'
  if (submissionsCount > 0) return 'GRADED'
  return 'PENDING'
}

/** Loose homework row (joins/counts may or may not be expanded by the backend). */
export interface HomeworkRow extends Homework {
  className?: string
  teacherName?: string
  class?: { name?: string } | null
  teacher?: { name?: string } | null
  submissionsCount?: number
  totalStudents?: number
}

const columnHelper = createColumnHelper<DataTableFeatures, HomeworkRow>()

interface HomeworkColumnsHandlers {
  onView: (homework: HomeworkRow) => void
  onDelete: (homework: HomeworkRow) => void
}

export function createHomeworkColumns(
  t: (key: string, fallback?: string) => string,
  { onView, onDelete }: HomeworkColumnsHandlers
) {
  return [
    columnHelper.accessor('title', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('homework.title', 'Tiêu đề')} />
      ),
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.title}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('homework.title', 'Tiêu đề') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.class?.name || row.className || '-', {
      id: 'class',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('homework.className', 'Lớp')} />
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-sm text-muted-foreground">{row.getValue('class')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('homework.className', 'Lớp'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.teacher?.name || row.teacherName || '-', {
      id: 'teacher',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('homework.teacher', 'Giáo viên')} />
      ),
      cell: ({ row }) => (
        <span className="hidden lg:table-cell text-sm text-muted-foreground">{row.getValue('teacher')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('homework.teacher', 'Giáo viên'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => (row.deadline ? new Date(row.deadline).toLocaleDateString('vi-VN') : '-'), {
      id: 'deadline',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('homework.deadline', 'Hạn nộp')} />
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-sm text-muted-foreground">{row.getValue('deadline')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('homework.deadline', 'Hạn nộp'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.submissionsCount ?? 0, {
      id: 'submissions',
      header: ({ column }) => (
        <div className="text-center">
          <DataTableColumnHeader column={column} title={t('homework.submissions', 'Bài nộp')} />
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center">
          <span className="text-sm font-medium">{row.original.submissionsCount || 0}</span>
          <span className="text-xs text-muted-foreground">/{row.original.totalStudents || 0}</span>
        </div>
      ),
      meta: { headerTitle: t('homework.submissions', 'Bài nộp') } satisfies DataTableColumnMeta,
    }),
    columnHelper.display({
      id: 'status',
      header: () => (
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t('common.status', 'Trạng thái')}
          </span>
        </div>
      ),
      cell: ({ row }) => {
        const status = getHomeworkStatus(
          row.original.deadline,
          row.original.submissionsCount || 0,
          row.original.totalStudents || 0
        )
        const statusInfo = HOMEWORK_STATUS_MAP[status] ?? HOMEWORK_STATUS_MAP.PENDING
        const StatusIcon = statusInfo.icon
        return (
          <div className="flex justify-center">
            <Badge className={cn('rounded-full text-xs gap-1', statusInfo.className)}>
              <StatusIcon className="h-3 w-3" />
              {statusInfo.label}
            </Badge>
          </div>
        )
      },
      enableSorting: false,
      meta: { headerTitle: t('common.status', 'Trạng thái') } satisfies DataTableColumnMeta,
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
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            title={t('common.view', 'Xem')}
            onClick={() => onView(row.original)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600"
            title={t('common.delete', 'Xóa')}
            onClick={() => onDelete(row.original)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-24' } satisfies DataTableColumnMeta,
    }),
  ]
}
