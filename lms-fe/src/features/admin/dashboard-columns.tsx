'use client'

/**
 * Column definitions for the Admin Dashboard "recent sessions" table.
 */

import { createColumnHelper } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Session } from '@/lib/schemas'

/** Session rows already carry optional class/teacher joins. */
export type SessionRow = Session

const columnHelper = createColumnHelper<DataTableFeatures, SessionRow>()

export function createSessionColumns(t: (key: string, fallback?: string) => string) {
  return [
    columnHelper.accessor('title', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('dashboard.title', 'Tiêu đề')} />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('dashboard.title', 'Tiêu đề') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.class?.name || '', {
      id: 'class',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('dashboard.className', 'Lớp')} />
      ),
      cell: ({ row }) =>
        row.original.class?.name ? (
          <Badge variant="outline" className="rounded-full text-xs">
            {row.original.class.name}
          </Badge>
        ) : null,
      filterFn: 'includesString',
      meta: { headerTitle: t('dashboard.className', 'Lớp') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.teacher?.name || '-', {
      id: 'teacher',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('dashboard.teacher', 'Giáo viên')} />
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-muted-foreground">{row.getValue('teacher')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('dashboard.teacher', 'Giáo viên'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => (row.date ? format(parseISO(row.date), 'dd/MM/yyyy') : '-'), {
      id: 'date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.date', 'Ngày')} />
      ),
      cell: ({ row }) => (
        <span className="hidden lg:table-cell text-muted-foreground">{row.getValue('date')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('common.date', 'Ngày'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => `${row.startTime} - ${row.endTime}`, {
      id: 'time',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('dashboard.time', 'Thời gian')} />
      ),
      cell: ({ row }) => (
        <span className="hidden sm:table-cell text-muted-foreground font-mono text-xs">
          {row.getValue('time')}
        </span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden sm:table-cell',
        headerTitle: t('dashboard.time', 'Thời gian'),
      } satisfies DataTableColumnMeta,
    }),
  ]
}
