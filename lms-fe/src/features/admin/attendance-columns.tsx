'use client'

/**
 * Column definitions for the Admin Attendance screen (roster marking table).
 */

import { createColumnHelper } from '@tanstack/react-table'
import { Check, X, Clock, LogOut, RotateCcw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'

/** Roster row: student joined with their attendance status. */
export interface AttendanceRow {
  id: string
  name: string
  username?: string
  code?: string
  phone?: string | null
  savedStatus?: string
  status?: string
  currentStatus: string
}

export const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Có mặt', icon: Check, className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200' },
  { value: 'EXCUSED_ABSENT', label: 'Vắng phép', icon: Clock, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' },
  { value: 'UNEXCUSED_ABSENT', label: 'Vắng không phép', icon: X, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
  { value: 'LATE', label: 'Đi muộn', icon: Clock, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' },
  { value: 'EARLY_LEAVE', label: 'Về sớm', icon: LogOut, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' },
  { value: 'MAKEUP', label: 'Học bù', icon: RotateCcw, className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200' },
]

export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Có mặt',
  EXCUSED_ABSENT: 'Vắng phép',
  UNEXCUSED_ABSENT: 'Vắng không phép',
  LATE: 'Đi muộn',
  EARLY_LEAVE: 'Về sớm',
  MAKEUP: 'Học bù',
}

export const ATTENDANCE_STATUS_BADGE: Record<string, string> = {
  PRESENT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  EXCUSED_ABSENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  UNEXCUSED_ABSENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  LATE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  EARLY_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  MAKEUP: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
}

const columnHelper = createColumnHelper<DataTableFeatures, AttendanceRow>()

export function createAttendanceColumns(
  t: (key: string, fallback?: string) => string,
  onMark: (studentId: string, status: string) => void
) {
  return [
    columnHelper.display({
      id: 'index',
      header: () => <span className="text-xs font-semibold w-12.5">{t('attendance.index', 'STT')}</span>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.index + 1}</span>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-12.5' } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('name', {
      header: () => <span className="text-xs font-semibold">{t('common.name', 'Họ tên')}</span>,
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.name || row.original.username}</span>,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('currentStatus', {
      id: 'status',
      header: () => <span className="text-xs font-semibold">{t('common.status', 'Trạng thái')}</span>,
      cell: ({ row }) => {
        const currentStatus = row.original.currentStatus
        return currentStatus ? (
          <div className="hidden md:table-cell">
            <Badge className={cn('rounded-full text-xs', ATTENDANCE_STATUS_BADGE[currentStatus] || 'bg-muted text-muted-foreground')}>
              {ATTENDANCE_STATUS_LABEL[currentStatus] || currentStatus}
            </Badge>
          </div>
        ) : (
          <div className="hidden md:table-cell">
            <span className="text-xs text-muted-foreground">{t('attendance.notMarked', 'Chưa điểm danh')}</span>
          </div>
        )
      },
      filterFn: 'equalsString',
      meta: { className: 'hidden md:table-cell' } satisfies DataTableColumnMeta,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="text-xs font-semibold">{t('common.actions', 'Thao tác')}</span>,
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap">
          {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={row.original.currentStatus === opt.value ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-7 text-[10px] px-2 rounded-lg',
                row.original.currentStatus === opt.value && opt.className
              )}
              onClick={() => onMark(row.original.id, opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    }),
  ]
}
