'use client'

/**
 * Column definitions for the Admin Materials screen.
 */

import { createColumnHelper } from '@tanstack/react-table'
import { Download, Eye } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Material } from '@/lib/schemas'

/** Loose material row (course join may or may not be expanded). */
export interface MaterialRow extends Material {
  courseName?: string
  course?: { name?: string } | null
}

const columnHelper = createColumnHelper<DataTableFeatures, MaterialRow>()

export function createMaterialColumns(t: (key: string, fallback?: string) => string) {
  return [
    columnHelper.accessor('title', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('materials.title', 'Tiêu đề')} />
      ),
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.title}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('materials.title', 'Tiêu đề') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.course?.name || row.courseName || '-', {
      id: 'course',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('materials.course', 'Khóa học')} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.getValue('course')}</span>
      ),
      filterFn: 'includesString',
      meta: { headerTitle: t('materials.course', 'Khóa học') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.unit || '-', {
      id: 'unit',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Unit" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.getValue('unit')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: 'Unit',
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('visibility', {
      id: 'visibility',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('materials.visibility', 'Hiển thị')} />
      ),
      cell: ({ row }) => (
        <div className="hidden md:table-cell">
          <Badge
            className={cn(
              'rounded-full text-xs',
              row.original.visibility === 'PUBLIC'
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            )}
          >
            {row.original.visibility === 'PUBLIC'
              ? t('materials.public', 'Công khai')
              : t('materials.private', 'Riêng tư')}
          </Badge>
        </div>
      ),
      filterFn: 'equalsString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('materials.visibility', 'Hiển thị'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide">
          {t('common.actions', 'Thao tác')}
        </span>
      ),
      cell: () => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.view', 'Xem')}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.download', 'Tải xuống')}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-20' } satisfies DataTableColumnMeta,
    }),
  ]
}
