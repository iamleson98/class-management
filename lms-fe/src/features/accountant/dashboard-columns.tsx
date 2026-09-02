'use client'

/**
 * Column definitions for the Accountant Dashboard "recent transactions" table.
 */

import { createColumnHelper } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Payment } from '@/lib/schemas'
import { formatVND } from '@/lib/api'

/** Loose payment row (student resolution happens at render time). */
export interface PaymentRow extends Payment {
  createdAt?: string
  studentName?: string
  student?: { name?: string } | null
}

const columnHelper = createColumnHelper<DataTableFeatures, PaymentRow>()

export function createPaymentColumns(t: (key: string, fallback?: string) => string) {
  return [
    columnHelper.accessor((row) => row.student?.name || row.studentName || '—', {
      id: 'student',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('accountant.dashboard.colStudent', 'Học viên')} />
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue('student')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('accountant.dashboard.colStudent', 'Học viên') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => (row.amount != null ? row.amount : null), {
      id: 'amount',
      header: ({ column }) => (
        <div className="text-right">
          <DataTableColumnHeader column={column} title={t('accountant.dashboard.colAmount', 'Số tiền')} />
        </div>
      ),
      cell: ({ row }) => (
        <span className="text-right text-green-600 block">
          {row.original.amount != null ? formatVND(row.original.amount) : '—'}
        </span>
      ),
      meta: { headerTitle: t('accountant.dashboard.colAmount', 'Số tiền') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) =>
      row.paymentDate || (row.createdAt ? new Date(row.createdAt).toLocaleDateString('vi-VN') : '—')
    , {
      id: 'date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('accountant.dashboard.colDate', 'Ngày thu')} />
      ),
      cell: ({ row }) => <span>{row.getValue('date')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('accountant.dashboard.colDate', 'Ngày thu') } satisfies DataTableColumnMeta,
    }),
    columnHelper.display({
      id: 'status',
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide">
          {t('common.status', 'Trạng thái')}
        </span>
      ),
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.method || 'CASH'}</Badge>
      ),
      enableSorting: false,
      meta: { headerTitle: t('common.status', 'Trạng thái') } satisfies DataTableColumnMeta,
    }),
  ]
}
