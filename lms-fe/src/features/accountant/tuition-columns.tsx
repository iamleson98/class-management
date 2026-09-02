'use client'

/**
 * Column definitions for the Accountant Tuition screen.
 */

import { createColumnHelper } from '@tanstack/react-table'
import { Plus } from 'lucide-react'

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

/** Loose tuition row (joins may or may not be expanded). */
export interface AccountantTuitionRow extends Tuition {
  studentName?: string
  className?: string
  student?: { name?: string } | null
  class?: { name?: string } | null
}

const columnHelper = createColumnHelper<DataTableFeatures, AccountantTuitionRow>()

export function createAccountantTuitionColumns(
  t: (key: string, fallback?: string) => string,
  onCollect: (tuition: AccountantTuitionRow) => void
) {
  return [
    columnHelper.accessor((row) => row.studentName || row.student?.name || '—', {
      id: 'student',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('accountant.tuition.colStudent', 'Học viên')} />
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue('student')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('accountant.tuition.colStudent', 'Học viên') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.className || row.class?.name || '—', {
      id: 'class',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('accountant.tuition.colClass', 'Lớp')} />
      ),
      cell: ({ row }) => <span>{row.getValue('class')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('accountant.tuition.colClass', 'Lớp') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('totalAmount', {
      id: 'total',
      header: ({ column }) => (
        <div className="text-right">
          <DataTableColumnHeader column={column} title={t('accountant.tuition.colTotal', 'Tổng')} />
        </div>
      ),
      cell: ({ row }) => (
        <span className="text-right block">{formatVND(row.original.totalAmount || 0)}</span>
      ),
      meta: { headerTitle: t('accountant.tuition.colTotal', 'Tổng') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('paidAmount', {
      id: 'paid',
      header: ({ column }) => (
        <div className="text-right">
          <DataTableColumnHeader column={column} title={t('accountant.tuition.colPaid', 'Đã thu')} />
        </div>
      ),
      cell: ({ row }) => (
        <span className="text-right text-green-600 block">{formatVND(row.original.paidAmount || 0)}</span>
      ),
      meta: { headerTitle: t('accountant.tuition.colPaid', 'Đã thu') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => (row.totalAmount || 0) - (row.paidAmount || 0), {
      id: 'remaining',
      header: ({ column }) => (
        <div className="text-right">
          <DataTableColumnHeader column={column} title={t('accountant.tuition.colRemaining', 'Còn thiếu')} />
        </div>
      ),
      cell: ({ row }) => (
        <span className="text-right text-red-600 block">{formatVND(row.getValue<number>('remaining'))}</span>
      ),
      meta: { headerTitle: t('accountant.tuition.colRemaining', 'Còn thiếu') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('status', {
      id: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.status', 'Trạng thái')} />
      ),
      cell: ({ row }) => {
        const status = row.original.status
        switch (status) {
          case 'PAID':
            return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{t('accountant.tuition.statusPaid', 'Đã thanh toán')}</Badge>
          case 'PARTIAL':
            return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">{t('accountant.tuition.statusPartial', 'Thanh toán một phần')}</Badge>
          case 'UNPAID':
            return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{t('accountant.tuition.statusUnpaid', 'Chưa thanh toán')}</Badge>
          default:
            return <Badge variant="outline">{status}</Badge>
        }
      },
      filterFn: 'equalsString',
      meta: { headerTitle: t('common.status', 'Trạng thái') } satisfies DataTableColumnMeta,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => (
        <div className="text-right">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t('common.actions', 'Thao tác')}
          </span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCollect(row.original)}
            disabled={row.original.status === 'PAID'}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('accountant.tuition.collectFee', 'Thu phí')}
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-25 text-right' } satisfies DataTableColumnMeta,
    }),
  ]
}
