'use client'

/**
 * Column definitions for the Counselor CRM screen (leads + convert tabs).
 */

import { createColumnHelper } from '@tanstack/react-table'
import { Clock, Mail, Phone, UserCheck, UserMinus } from 'lucide-react'
import { format, parseISO } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Lead } from '@/lib/schemas'

export const COUNSELOR_STATUS_OPTIONS = [
  { value: 'ALL', labelKey: 'counselor.crm.allStatuses', label: 'Tất cả trạng thái' },
  { value: 'NEW', labelKey: 'counselor.crm.statusNew', label: 'Mới' },
  { value: 'CONTACTED', labelKey: 'counselor.crm.statusContacted', label: 'Đã liên hệ' },
  { value: 'FOLLOW_UP', labelKey: 'counselor.crm.statusFollowUp', label: 'Theo dõi' },
  { value: 'CONVERTED', labelKey: 'counselor.crm.statusConverted', label: 'Đã chuyển đổi' },
  { value: 'LOST', labelKey: 'counselor.crm.statusLost', label: 'Đã mất' },
]

export const COUNSELOR_SOURCE_OPTIONS = [
  { value: 'ALL', labelKey: 'counselor.crm.allSources', label: 'Tất cả nguồn' },
  { value: 'FACEBOOK', labelKey: 'counselor.crm.sourceFacebook', label: 'Facebook' },
  { value: 'WEBSITE', labelKey: 'counselor.crm.sourceWebsite', label: 'Website' },
  { value: 'REFERRAL', labelKey: 'counselor.crm.sourceReferral', label: 'Giới thiệu' },
  { value: 'WALK_IN', labelKey: 'counselor.crm.sourceWalkIn', label: 'Đến trực tiếp' },
  { value: 'PHONE', labelKey: 'counselor.crm.sourcePhone', label: 'Điện thoại' },
  { value: 'EMAIL', labelKey: 'counselor.crm.sourceEmail', label: 'Email' },
]

export function getCounselorStatusBadge(status: string, t: (key: string, fallback?: string) => string) {
  switch (status) {
    case 'NEW': return <Badge className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">{t('counselor.crm.statusNew', 'Mới')}</Badge>
    case 'CONTACTED': return <Badge className="rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs">{t('counselor.crm.statusContacted', 'Đã liên hệ')}</Badge>
    case 'FOLLOW_UP': return <Badge className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">{t('counselor.crm.statusFollowUp', 'Theo dõi')}</Badge>
    case 'CONVERTED': return <Badge className="rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 text-xs">{t('counselor.crm.statusConverted', 'Đã chuyển đổi')}</Badge>
    case 'LOST': return <Badge className="rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">{t('counselor.crm.statusLost', 'Đã mất')}</Badge>
    default: return <Badge variant="outline" className="rounded-full text-xs">{status}</Badge>
  }
}

// ── Leads table ───────────────────────────────────────────────────

/** Loose lead row (counselor view). */
export interface CounselorLeadRow extends Lead {
  createdAt?: string
  nextFollowUp?: string
}

const leadHelper = createColumnHelper<DataTableFeatures, CounselorLeadRow>()

export function createCounselorLeadColumns(t: (key: string, fallback?: string) => string) {
  return [
    leadHelper.accessor('name', {
      id: 'customer',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.customer', 'Khách hàng')} />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-violet-700 dark:text-violet-400">
              {(row.original.name || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{row.original.name}</p>
            {row.original.nextFollowUp && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {t('counselor.crm.followUp', 'Theo dõi')}: {format(parseISO(row.original.nextFollowUp), 'dd/MM/yyyy')}
              </p>
            )}
          </div>
        </div>
      ),
      filterFn: 'includesString',
      meta: { headerTitle: t('common.customer', 'Khách hàng') } satisfies DataTableColumnMeta,
    }),
    leadHelper.accessor('status', {
      id: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.status', 'Trạng thái')} />
      ),
      cell: ({ row }) => (
        <div className="hidden md:table-cell">
          {getCounselorStatusBadge(row.original.status, t)}
        </div>
      ),
      filterFn: 'equalsString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('common.status', 'Trạng thái'),
      } satisfies DataTableColumnMeta,
    }),
    leadHelper.accessor('source', {
      id: 'source',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('counselor.crm.colSource', 'Nguồn')} />
      ),
      cell: ({ row }) => (
        <div className="hidden sm:table-cell">
          {row.original.source && (
            <span className="text-xs text-muted-foreground">{row.original.source}</span>
          )}
        </div>
      ),
      filterFn: 'equalsString',
      meta: {
        className: 'hidden sm:table-cell',
        headerTitle: t('counselor.crm.colSource', 'Nguồn'),
      } satisfies DataTableColumnMeta,
    }),
    leadHelper.display({
      id: 'contact',
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide">
          {t('common.contact', 'Liên hệ')}
        </span>
      ),
      cell: ({ row }) => (
        <div className="hidden lg:table-cell space-y-1">
          {row.original.phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {row.original.phone}
            </p>
          )}
          {row.original.email && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {row.original.email}
            </p>
          )}
        </div>
      ),
      enableSorting: false,
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('common.contact', 'Liên hệ'),
      } satisfies DataTableColumnMeta,
    }),
    leadHelper.accessor((row) =>
      row.createdAt ? format(parseISO(row.createdAt), 'dd/MM/yyyy') : '-'
    , {
      id: 'createdDate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.date', 'Ngày tạo')} />
      ),
      cell: ({ row }) => (
        <span className="hidden lg:table-cell text-xs text-muted-foreground">{row.getValue('createdDate')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('common.date', 'Ngày tạo'),
      } satisfies DataTableColumnMeta,
    }),
  ]
}

// ── Convert tab: convertible users ────────────────────────────────

export interface ConvertibleUserRow {
  id: string
  username?: string
  email?: string
  nickname?: string
  firstname?: string
  lastname?: string
}

const userRowHelper = createColumnHelper<DataTableFeatures, ConvertibleUserRow>()

export function createConvertibleUserColumns(
  t: (key: string, fallback?: string) => string,
  onConvert: (user: ConvertibleUserRow) => void,
  isPending?: boolean
) {
  return [
    userRowHelper.accessor((row) => row.nickname || [row.firstname, row.lastname].filter(Boolean).join(' ') || row.username || '-', {
      id: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.name', 'Tên')} />
      ),
      cell: ({ row }) => <span className="font-medium text-sm">{row.getValue('name')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('common.name', 'Tên') } satisfies DataTableColumnMeta,
    }),
    userRowHelper.accessor((row) => row.email || '-', {
      id: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.email', 'Email')} />
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-sm text-muted-foreground">{row.getValue('email')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('common.email', 'Email'),
      } satisfies DataTableColumnMeta,
    }),
    userRowHelper.display({
      id: 'actions',
      header: () => (
        <div className="text-right">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t('common.actions', 'Hành động')}
          </span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white"
            disabled={isPending}
            onClick={() => onConvert(row.original)}
          >
            <UserCheck className="h-3.5 w-3.5 mr-1" />
            {t('counselor.crm.convertToStudent', 'Chuyển thành học viên')}
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'text-right' } satisfies DataTableColumnMeta,
    }),
  ]
}

// ── Convert tab: students (revert) ────────────────────────────────

export interface RevertStudentRow {
  id: string
  name?: string
  email?: string
  code?: string
}

const studentRowHelper = createColumnHelper<DataTableFeatures, RevertStudentRow>()

export function createRevertStudentColumns(
  t: (key: string, fallback?: string) => string,
  onRevert: (student: RevertStudentRow) => void,
  isPending?: boolean
) {
  return [
    studentRowHelper.accessor((row) => row.name || row.email || '-', {
      id: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.name', 'Tên')} />
      ),
      cell: ({ row }) => <span className="font-medium text-sm">{row.getValue('name')}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('common.name', 'Tên') } satisfies DataTableColumnMeta,
    }),
    studentRowHelper.accessor((row) => row.email || '-', {
      id: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.email', 'Email')} />
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-sm text-muted-foreground">{row.getValue('email')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('common.email', 'Email'),
      } satisfies DataTableColumnMeta,
    }),
    studentRowHelper.display({
      id: 'actions',
      header: () => (
        <div className="text-right">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t('common.actions', 'Hành động')}
          </span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={isPending}
            onClick={() => onRevert(row.original)}
          >
            <UserMinus className="h-3.5 w-3.5 mr-1" />
            {t('counselor.crm.revertToUser', 'Chuyển về người dùng')}
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'text-right' } satisfies DataTableColumnMeta,
    }),
  ]
}
