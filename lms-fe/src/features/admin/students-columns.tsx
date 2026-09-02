'use client'

/**
 * Column definitions for the Admin Students screen (shadcn/ui data-table
 * pattern — TanStack Table v9 column helper).
 */

import { createColumnHelper } from '@tanstack/react-table'
import { Pencil, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Student } from '@/lib/schemas'

export const STATUS_MAP: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang học', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  RESERVED: { label: 'Bảo lưu', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  DROPPED: { label: 'Nghỉ', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  PENDING: { label: 'Chờ xếp', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

const columnHelper = createColumnHelper<DataTableFeatures, Student>()

interface StudentsColumnsHandlers {
  onEdit: (student: Student) => void
  onDelete: (student: Student) => void
}

export function createStudentsColumns(
  t: (key: string, fallback?: string) => string,
  { onEdit, onDelete }: StudentsColumnsHandlers
) {
  return [
    columnHelper.accessor((row) => row.code || row.id.slice(0, 8), {
      id: 'code',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('students.studentCode', 'Mã HV')} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.getValue('code')}</span>
      ),
      filterFn: 'includesString',
      meta: { headerTitle: t('students.studentCode', 'Mã HV') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.name', 'Họ tên')} />
      ),
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.email || row.original.user?.email || ''}
          </p>
        </div>
      ),
      filterFn: 'includesString',
      meta: { headerTitle: t('common.name', 'Họ tên') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.phone || '-', {
      id: 'phone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.phone', 'SĐT')} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.getValue('phone')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('common.phone', 'SĐT'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.parentName || '-', {
      id: 'parentName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('students.parent', 'Phụ huynh')} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.getValue('parentName')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('students.parent', 'Phụ huynh'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.vmgClassCode || '-', {
      id: 'vmgClassCode',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('students.vmgClassCode', 'Mã lớp VMG')} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.getValue('vmgClassCode')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('students.vmgClassCode', 'Mã lớp VMG'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('gender', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('students.gender', 'Giới tính')} />
      ),
      cell: ({ row }) => {
        const gender = row.original.gender
        return (
          <span className="text-muted-foreground text-sm">
            {gender === 'male'
              ? t('students.male', 'Nam')
              : gender === 'female'
                ? t('students.female', 'Nữ')
                : t('students.other', 'Khác')}
          </span>
        )
      },
      filterFn: 'equalsString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('students.gender', 'Giới tính'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.school || '-', {
      id: 'school',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('students.school', 'Trường')} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.getValue('school')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('students.school', 'Trường'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.enrollments?.[0]?.className || '-', {
      id: 'class',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('students.grade', 'Lớp')} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.getValue('class')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden sm:table-cell',
        headerTitle: t('students.grade', 'Lớp'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('status', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.status', 'Trạng thái')} />
      ),
      cell: ({ row }) => {
        const status = STATUS_MAP[row.original.status ?? 'ACTIVE'] ?? STATUS_MAP.ACTIVE
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
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600"
            onClick={() => onDelete(row.original)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-20' } satisfies DataTableColumnMeta,
    }),
  ]
}
