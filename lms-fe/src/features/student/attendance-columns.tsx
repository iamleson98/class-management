'use client'

/**
 * Column definitions for the Student Attendance history table.
 */

import { createColumnHelper } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Session } from '@/lib/schemas'

export const STUDENT_ATTENDANCE_STATUS_MAP: Record<string, { label: string; className: string }> = {
  PRESENT: { label: 'Có mặt', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 hover:bg-sky-100' },
  ABSENT_EXCUSED: { label: 'Vắng có phép', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100' },
  ABSENT_UNEXCUSED: { label: 'Vắng không phép', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100' },
  LATE: { label: 'Đi muộn', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100' },
  EARLY_LEAVE: { label: 'Về sớm', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100' },
  MAKEUP: { label: 'Học bù', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 hover:bg-violet-100' },
}

/** Attendance history row (session + status + note). */
export interface AttendanceHistoryRow {
  id?: string
  status: string
  note?: string | null
  className?: string
  sessionName?: string
  session?: Session | null
}

const columnHelper = createColumnHelper<DataTableFeatures, AttendanceHistoryRow>()

export function createAttendanceHistoryColumns(t: (key: string, fallback?: string) => string) {
  return [
    columnHelper.accessor(
      (row) =>
        row.session?.date ? format(parseISO(row.session.date), 'dd/MM/yyyy') : '—',
      {
        id: 'date',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('common.date', 'Ngày')} />
        ),
        cell: ({ row }) => <span className="text-sm font-medium">{row.getValue('date')}</span>,
        filterFn: 'includesString',
        meta: { headerTitle: t('common.date', 'Ngày') } satisfies DataTableColumnMeta,
      }
    ),
    columnHelper.accessor((row) => row.session?.class?.name || row.className || '—', {
      id: 'class',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('student.attendance.class', 'Lớp')} />
      ),
      cell: ({ row }) => <span className="text-sm">{row.getValue('class')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('student.attendance.class', 'Lớp') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.session?.title || row.sessionName || '—', {
      id: 'session',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('student.attendance.session', 'Buổi học')} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.getValue('session')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden sm:table-cell',
        headerTitle: t('student.attendance.session', 'Buổi học'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('status', {
      id: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.status', 'Trạng thái')} />
      ),
      cell: ({ row }) => {
        const statusInfo = STUDENT_ATTENDANCE_STATUS_MAP[row.original.status] ?? STUDENT_ATTENDANCE_STATUS_MAP.PRESENT
        return <Badge className={cn(statusInfo.className)}>{statusInfo.label}</Badge>
      },
      filterFn: 'equalsString',
      meta: { headerTitle: t('common.status', 'Trạng thái') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.note || '—', {
      id: 'note',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('student.attendance.note', 'Ghi chú')} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.getValue('note')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('student.attendance.note', 'Ghi chú'),
      } satisfies DataTableColumnMeta,
    }),
  ]
}
