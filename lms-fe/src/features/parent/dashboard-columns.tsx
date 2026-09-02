'use client'

/**
 * Column definitions for the Parent Dashboard tuition table.
 */

import { createColumnHelper } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Tuition } from '@/lib/schemas'
import { formatVND } from '@/lib/api'

/** Loose tuition row (class name resolved at render time). */
export interface ParentTuitionRow extends Tuition {
  className?: string
}

const columnHelper = createColumnHelper<DataTableFeatures, ParentTuitionRow>()

export function createParentTuitionColumns(
  t: (key: string, fallback?: string) => string,
  getClassName: (tuition: ParentTuitionRow) => string
) {
  return [
    columnHelper.accessor(getClassName, {
      id: 'class',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('parent.dashboard.class', 'Lớp')} />
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue('class')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('parent.dashboard.class', 'Lớp') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('totalAmount', {
      id: 'total',
      header: ({ column }) => (
        <div className="text-right">
          <DataTableColumnHeader column={column} title={t('common.total', 'Tổng')} />
        </div>
      ),
      cell: ({ row }) => (
        <span className="text-right block">{formatVND(row.original.totalAmount || 0)}</span>
      ),
      meta: { headerTitle: t('common.total', 'Tổng') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('paidAmount', {
      id: 'paid',
      header: ({ column }) => (
        <div className="text-right">
          <DataTableColumnHeader column={column} title={t('parent.dashboard.paid', 'Đã thu')} />
        </div>
      ),
      cell: ({ row }) => (
        <span className="text-right text-green-600 block">{formatVND(row.original.paidAmount || 0)}</span>
      ),
      meta: { headerTitle: t('parent.dashboard.paid', 'Đã thu') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('remainingAmount', {
      id: 'remaining',
      header: ({ column }) => (
        <div className="text-right">
          <DataTableColumnHeader column={column} title={t('parent.dashboard.remaining', 'Còn thiếu')} />
        </div>
      ),
      cell: ({ row }) => (
        <span className="text-right text-red-600 block">{formatVND(row.original.remainingAmount || 0)}</span>
      ),
      meta: { headerTitle: t('parent.dashboard.remaining', 'Còn thiếu') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('status', {
      id: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.status', 'Trạng thái')} />
      ),
      cell: ({ row }) => {
        const status = row.original.status
        if (status === 'PAID') return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Đã thanh toán</Badge>
        if (status === 'PARTIAL') return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Còn thiếu</Badge>
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Chưa thanh toán</Badge>
      },
      filterFn: 'equalsString',
      meta: { headerTitle: t('common.status', 'Trạng thái') } satisfies DataTableColumnMeta,
    }),
  ]
}
