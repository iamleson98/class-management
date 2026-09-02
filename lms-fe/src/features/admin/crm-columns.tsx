'use client'

/**
 * Column definitions for the Admin CRM (leads) screen — also reused by the
 * counselor CRM view.
 */

import { createColumnHelper } from '@tanstack/react-table'
import { Eye, Pencil, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Lead } from '@/lib/schemas'

export const LEAD_STATUS_MAP: Record<string, { label: string; className: string }> = {
  NEW: { label: 'Mới', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  CONTACTED: { label: 'Đã liên hệ', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  TEST_SCHEDULED: { label: 'Hẹn test', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  TESTED: { label: 'Đã test', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  PENDING_PAYMENT: { label: 'Chờ đóng phí', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  ENROLLED: { label: 'Đã đăng ký', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  NOT_INTERESTED: { label: 'Không nhu cầu', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export const LEAD_SOURCE_MAP: Record<string, string> = {
  WEBSITE: 'Website',
  FACEBOOK: 'Facebook',
  REFERRAL: 'Giới thiệu',
  PHONE: 'Điện thoại',
  WALK_IN: 'Đến trực tiếp',
  ZALO: 'Zalo',
  TIKTOK: 'TikTok',
}

/** Loose lead row (counselor join may or may not be expanded). */
export interface LeadRow extends Lead {
  createdAt?: string
  counselor?: { name?: string } | null
}

const columnHelper = createColumnHelper<DataTableFeatures, LeadRow>()

interface LeadColumnsHandlers {
  onView: (lead: LeadRow) => void
  onEdit: (lead: LeadRow) => void
  onDelete: (lead: LeadRow) => void
}

export function createLeadColumns(
  t: (key: string, fallback?: string) => string,
  { onView, onEdit, onDelete }: LeadColumnsHandlers
) {
  return [
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.name', 'Tên')} />
      ),
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('common.name', 'Tên') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.phone || '-', {
      id: 'phone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.phone', 'SĐT')} />
      ),
      cell: ({ row }) => <span className="text-sm">{row.getValue('phone')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('common.phone', 'SĐT') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.source || '-', {
      id: 'source',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('crm.source', 'Nguồn')} />
      ),
      cell: ({ row }) => (
        <div className="hidden md:table-cell">
          <Badge variant="outline" className="rounded-full text-xs">
            {LEAD_SOURCE_MAP[row.original.source ?? ''] ?? row.original.source}
          </Badge>
        </div>
      ),
      filterFn: 'equalsString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('crm.source', 'Nguồn'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('status', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.status', 'Trạng thái')} />
      ),
      cell: ({ row }) => {
        const status = LEAD_STATUS_MAP[row.original.status] ?? LEAD_STATUS_MAP.NEW
        return <Badge className={cn('rounded-full text-xs', status.className)}>{status.label}</Badge>
      },
      filterFn: 'equalsString',
      meta: { headerTitle: t('common.status', 'Trạng thái') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.counselor?.name || '-', {
      id: 'counselor',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('crm.counselor', 'Tư vấn viên')} />
      ),
      cell: ({ row }) => (
        <span className="hidden lg:table-cell text-sm text-muted-foreground">{row.getValue('counselor')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('crm.counselor', 'Tư vấn viên'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) =>
      row.createdAt
        ? new Date(row.createdAt).toLocaleDateString('vi-VN')
        : row.createat
          ? new Date(row.createat).toLocaleDateString('vi-VN')
          : '-'
    , {
      id: 'createdDate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('crm.createdDate', 'Ngày tạo')} />
      ),
      cell: ({ row }) => (
        <span className="hidden lg:table-cell text-sm text-muted-foreground">{row.getValue('createdDate')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('crm.createdDate', 'Ngày tạo'),
      } satisfies DataTableColumnMeta,
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
            onClick={() => onView(row.original)}
            title={t('common.details', 'Chi tiết')}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(row.original)}>
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
