'use client'

/**
 * Column definitions for the Admin Classes screen (main table + the two
 * detail-modal tables) — shadcn/ui data-table pattern.
 */

import { createColumnHelper } from '@tanstack/react-table'
import { Eye, Pencil, Trash2, UserMinus, UserPlus, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Class, StudentEnrollment, Session } from '@/lib/schemas'

export const CLASS_STATUS_MAP: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Chờ mở', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  ACTIVE: { label: 'Đang học', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  PAUSED: { label: 'Tạm dừng', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  COMPLETED: { label: 'Hoàn thành', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  CLOSED: { label: 'Đã đóng', className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
}

const columnHelper = createColumnHelper<DataTableFeatures, Class>()

interface ClassColumnsHandlers {
  onView: (cls: Class) => void
  onEnroll: (cls: Class) => void
  onEdit: (cls: Class) => void
  onDelete: (cls: Class) => void
}

export function createClassColumns(
  t: (key: string, fallback?: string) => string,
  { onView, onEnroll, onEdit, onDelete }: ClassColumnsHandlers
) {
  return [
    columnHelper.accessor((row) => row.code || row.id.slice(0, 8), {
      id: 'code',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('classes.classCode', 'Mã lớp')} />
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{row.getValue('code')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('classes.classCode', 'Mã lớp') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.name', 'Tên')} />
      ),
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('common.name', 'Tên') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.course?.name || '-', {
      id: 'course',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('classes.course', 'Khóa học')} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.getValue('course')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('classes.course', 'Khóa học'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.teacher?.name || '-', {
      id: 'teacher',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('classes.teacher', 'Giáo viên')} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.getValue('teacher')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('classes.teacher', 'Giáo viên'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.room || '-', {
      id: 'room',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('classes.room', 'Phòng')} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.getValue('room')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('classes.room', 'Phòng'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor(
      (row) => row._count?.studentEnrollments ?? row.enrollments?.length ?? row.studentCount ?? 0,
      {
        id: 'size',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('classes.classSize', 'Sĩ số')} />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{row.getValue<number>('size')}</span>
          </div>
        ),
        meta: {
          className: 'hidden sm:table-cell',
          headerTitle: t('classes.classSize', 'Sĩ số'),
        } satisfies DataTableColumnMeta,
      }
    ),
    columnHelper.accessor('status', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.status', 'Trạng thái')} />
      ),
      cell: ({ row }) => {
        const status = CLASS_STATUS_MAP[row.original.status] ?? CLASS_STATUS_MAP.OPEN
        return <Badge className={cn('rounded-full text-xs', status.className)}>{status.label}</Badge>
      },
      filterFn: 'equalsString',
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
            variant="ghost" size="icon" className="h-8 w-8 text-sky-500"
            onClick={() => onView(row.original)}
            title={t('common.details', 'Chi tiết')}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onEnroll(row.original)}
            title={t('classes.enroll', 'Ghi danh')}
          >
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-red-500"
            onClick={() => onDelete(row.original)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-30' } satisfies DataTableColumnMeta,
    }),
  ]
}

// ─── Class-detail modal: enrolled students table ───────────────────────

const enrollmentHelper = createColumnHelper<DataTableFeatures, StudentEnrollment>()

export function createEnrollmentColumns(
  t: (key: string, fallback?: string) => string,
  actions?: { onRemove?: (enrollment: StudentEnrollment) => void },
) {
  const columns = [
    enrollmentHelper.display({
      id: 'index',
      header: () => <span className="text-xs font-semibold">#</span>,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.index + 1}</span>
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    enrollmentHelper.accessor((row) => row.student?.user?.name || row.student?.code || '-', {
      id: 'name',
      header: () => <span className="text-xs font-semibold">{t('common.name', 'Họ tên')}</span>,
      cell: ({ row }) => <span className="font-medium text-sm">{row.getValue('name')}</span>,
      filterFn: 'includesString',
    }),
    enrollmentHelper.accessor((row) => row.student?.user?.phone || row.student?.phone || '-', {
      id: 'phone',
      header: () => <span className="text-xs font-semibold">{t('common.phone', 'SĐT')}</span>,
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-sm text-muted-foreground">{row.getValue('phone')}</span>
      ),
      filterFn: 'includesString',
      meta: { className: 'hidden md:table-cell' } satisfies DataTableColumnMeta,
    }),
    enrollmentHelper.accessor((row) => row.student?.parentName || '-', {
      id: 'parentName',
      header: () => <span className="text-xs font-semibold">{t('classes.parent', 'Phụ huynh')}</span>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.getValue('parentName')}</span>
      ),
      filterFn: 'includesString',
      meta: { className: 'hidden md:table-cell' } satisfies DataTableColumnMeta,
    }),
    enrollmentHelper.accessor((row) => row.student?.vmgClassCode || '-', {
      id: 'vmgClassCode',
      header: () => <span className="text-xs font-semibold">{t('classes.vmgClassCode', 'Mã lớp VMG')}</span>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground font-mono">{row.getValue('vmgClassCode')}</span>
      ),
      filterFn: 'includesString',
      meta: { className: 'hidden lg:table-cell' } satisfies DataTableColumnMeta,
    }),
    enrollmentHelper.accessor('status', {
      id: 'status',
      header: () => <span className="text-xs font-semibold">{t('common.status', 'Trạng thái')}</span>,
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <Badge
            className={cn(
              'rounded-full text-xs',
              status === 'ACTIVE'
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                : status === 'DROPPED'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
            )}
          >
            {status === 'ACTIVE'
              ? t('classes.studying', 'Đang học')
              : status === 'DROPPED'
                ? t('classes.dropped', 'Đã nghỉ')
                : status || '-'}
          </Badge>
        )
      },
      filterFn: 'equalsString',
    }),
  ]

  // Remove-from-class action (admin-only) — appended so the modal's students
  // tab doubles as the membership manager.
  if (actions?.onRemove) {
    columns.push(
      enrollmentHelper.display({
        id: 'actions',
        header: () => <span className="text-xs font-semibold sr-only">{t('common.actions', 'Thao tác')}</span>,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title={t('classes.removeStudent', 'Xóa khỏi lớp')}
            aria-label={t('classes.removeStudent', 'Xóa khỏi lớp')}
            onClick={() => actions.onRemove?.(row.original)}
          >
            <UserMinus className="h-4 w-4" />
          </Button>
        ),
        enableSorting: false,
        enableHiding: false,
      }),
    )
  }
  return columns
}

// ─── Class-detail modal: attendance matrix (sessions × students) ───────

interface AttendanceMatrixCell {
  session: Session
  marks: (string | null)[]
}

const matrixHelper = createColumnHelper<DataTableFeatures, AttendanceMatrixCell>()

export function createAttendanceMatrixColumns(
  t: (key: string, fallback?: string) => string,
  studentNames: string[]
) {
  const studentColumns: ReturnType<typeof matrixHelper.display>[] = studentNames.map((name, idx) =>
    matrixHelper.display({
      id: `student-${idx}`,
      header: () => (
        <span className="block truncate max-w-17.5 text-center" title={name}>
          {name?.split(' ').pop() || `HV${idx + 1}`}
        </span>
      ),
      cell: ({ row }) => {
        const mark = row.original.marks[idx]
        return (
          <span className="block text-center text-xs text-muted-foreground">
            {mark ?? '—'}
          </span>
        )
      },
      enableSorting: false,
      meta: { className: 'text-center min-w-20' } satisfies DataTableColumnMeta,
    })
  )

  return [
    matrixHelper.display({
      id: 'date',
      header: () => <span className="text-xs font-semibold">{t('classes.date', 'Ngày')}</span>,
      cell: ({ row }) => (
        <span className="text-xs font-medium">
          {row.original.session.date
            ? new Date(row.original.session.date).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
              })
            : '-'}
        </span>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'sticky left-0 bg-background z-10' } satisfies DataTableColumnMeta,
    }),
    ...studentColumns,
  ]
}

/** Build the attendance matrix rows (sessions × up-to-10 students). */
export function buildAttendanceMatrixRows(
  sessions: Session[],
  enrollments: StudentEnrollment[],
): AttendanceMatrixCell[] {
  return sessions.slice(0, 20).map((session) => ({
    session,
    // Detailed per-session attendance requires per-session fetches; the
    // matrix intentionally renders placeholders (same as the original UI).
    marks: enrollments.slice(0, 10).map(() => null),
  }))
}
