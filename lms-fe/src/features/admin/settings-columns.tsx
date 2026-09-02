'use client'

/**
 * Column definitions for the Admin Settings screen (branches + employees).
 */

import { createColumnHelper } from '@tanstack/react-table'
import { UserCheck, UserX } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Branch, User } from '@/lib/schemas'

// Staff roles a super admin / admin can assign to an employee. Keys match the
// canonical lowercase role IDs stored in the user's `roles` string.
export const ROLE_LABELS: Record<string, string> = {
  lms_super_admin: 'Super Admin',
  lms_admin: 'Quản lý',
  lms_counselor: 'Tư vấn viên',
  lms_teacher: 'Giáo viên',
  lms_accountant: 'Kế toán',
  lms_marketing: 'Marketing',
}

// Priority order to pick a single primary role for display from a roles string.
const ROLE_PRIORITY: string[] = [
  'lms_super_admin', 'lms_admin', 'lms_counselor', 'lms_teacher',
  'lms_accountant', 'lms_marketing',
]

/** Extract the primary (highest-priority) staff role from a roles string. */
export function primaryRole(rolesStr: string): string {
  const parts = (rolesStr || '').split(/\s+/).filter(Boolean)
  for (const r of ROLE_PRIORITY) {
    if (parts.includes(r)) return r
  }
  return ''
}

/**
 * Replace the primary LMS staff role in a roles string with `newRole`, keeping
 * system roles (system_user, system_admin) and any other non-staff roles intact.
 */
export function withRole(rolesStr: string, newRole: string): string {
  const parts = (rolesStr || '').split(/\s+/).filter(Boolean)
  const kept = parts.filter((r) => !ROLE_LABELS[r])
  kept.push(newRole)
  return Array.from(new Set(kept)).join(' ')
}

// ── Branches ──────────────────────────────────────────────────────

const branchHelper = createColumnHelper<DataTableFeatures, Branch>()

export function createBranchColumns(t: (key: string, fallback?: string) => string) {
  return [
    branchHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.name', 'Tên')} />
      ),
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('common.name', 'Tên') } satisfies DataTableColumnMeta,
    }),
    branchHelper.accessor((row) => row.address || '-', {
      id: 'address',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('settings.address', 'Địa chỉ')} />
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-sm text-muted-foreground">{row.getValue('address')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('settings.address', 'Địa chỉ'),
      } satisfies DataTableColumnMeta,
    }),
    branchHelper.accessor((row) => row.phone || '-', {
      id: 'phone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.phone', 'SĐT')} />
      ),
      cell: ({ row }) => (
        <span className="hidden sm:table-cell text-sm text-muted-foreground">{row.getValue('phone')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden sm:table-cell',
        headerTitle: t('common.phone', 'SĐT'),
      } satisfies DataTableColumnMeta,
    }),
  ]
}

// ── Employees (users) ─────────────────────────────────────────────

const userHelper = createColumnHelper<DataTableFeatures, User>()

export interface EmployeeRow extends User {
  name?: string
}

interface EmployeeColumnsHandlers {
  onRoleChange: (user: EmployeeRow, newRole: string) => void
  onDeactivate: (user: EmployeeRow) => void
  onReactivate: (user: EmployeeRow) => void
  /** Whether a user row should lock role/deactivate actions (e.g. self). */
  isLocked?: (user: EmployeeRow) => boolean
  isPending?: boolean
}

export function createEmployeeColumns(
  t: (key: string, fallback?: string) => string,
  { onRoleChange, onDeactivate, onReactivate, isLocked, isPending }: EmployeeColumnsHandlers
) {
  return [
    userHelper.accessor(
      (row) =>
        row.nickname ||
        row.name ||
        [row.firstname, row.lastname].filter(Boolean).join(' ') ||
        row.username,
      {
        id: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('common.name', 'Tên')} />
        ),
        cell: ({ row }) => <span className="font-medium text-sm">{row.getValue('name')}</span>,
        filterFn: 'includesString',
        meta: { headerTitle: t('common.name', 'Tên') } satisfies DataTableColumnMeta,
      }
    ),
    userHelper.accessor('email', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.email', 'Email')} />
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-sm text-muted-foreground">{row.original.email}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('common.email', 'Email'),
      } satisfies DataTableColumnMeta,
    }),
    userHelper.accessor((row) => row.phone || '-', {
      id: 'phone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.phone', 'SĐT')} />
      ),
      cell: ({ row }) => (
        <span className="hidden lg:table-cell text-sm text-muted-foreground">{row.getValue('phone')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('common.phone', 'SĐT'),
      } satisfies DataTableColumnMeta,
    }),
    userHelper.display({
      id: 'role',
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide">
          {t('settings.role', 'Vai trò')}
        </span>
      ),
      cell: ({ row }) => {
        const locked = isLocked?.(row.original) ?? false
        return (
          <EmployeeRoleSelect
            value={primaryRole(row.original.roles)}
            disabled={locked}
            onChange={(newRole) => onRoleChange(row.original, newRole)}
            placeholder={t('settings.selectRole', 'Chọn vai trò')}
          />
        )
      },
      enableSorting: false,
      meta: { headerTitle: t('settings.role', 'Vai trò') } satisfies DataTableColumnMeta,
    }),
    userHelper.display({
      id: 'status',
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide">
          {t('settings.status', 'Trạng thái')}
        </span>
      ),
      cell: ({ row }) => {
        const isActive = !row.original.deleteat
        return (
          <Badge
            variant={isActive ? 'default' : 'secondary'}
            className={cn(
              'rounded-full text-xs',
              isActive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isActive ? t('settings.active', 'Đang hoạt động') : t('settings.inactive', 'Đã vô hiệu')}
          </Badge>
        )
      },
      enableSorting: false,
      meta: { headerTitle: t('settings.status', 'Trạng thái') } satisfies DataTableColumnMeta,
    }),
    userHelper.display({
      id: 'actions',
      header: () => (
        <div className="text-right">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t('common.actions', 'Hành động')}
          </span>
        </div>
      ),
      cell: ({ row }) => {
        const isActive = !row.original.deleteat
        const locked = isLocked?.(row.original) ?? false
        return (
          <div className="flex justify-end">
            {isActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={isPending || locked}
                onClick={() => onDeactivate(row.original)}
              >
                <UserX className="h-3.5 w-3.5 mr-1" />
                {t('settings.deactivate', 'Vô hiệu')}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                disabled={isPending || locked}
                onClick={() => onReactivate(row.original)}
              >
                <UserCheck className="h-3.5 w-3.5 mr-1" />
                {t('settings.reactivate', 'Kích hoạt lại')}
              </Button>
            )}
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'text-right' } satisfies DataTableColumnMeta,
    }),
  ]
}

/** Role select used inside employee rows (extracted for reuse + testing). */
export function EmployeeRoleSelect({
  value,
  disabled,
  onChange,
  placeholder,
}: {
  value: string
  disabled?: boolean
  onChange: (role: string) => void
  placeholder: string
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-36 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(ROLE_LABELS).map(([key, label]) => (
          <SelectItem key={key} value={key}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
