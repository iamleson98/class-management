'use client'

/**
 * Column definitions for the Marketing CMS screen.
 */

import { createColumnHelper } from '@tanstack/react-table'
import { Eye, Pencil } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTableColumnHeader,
  dataTableFeatures,
  type DataTableColumnMeta,
  type DataTableFeatures,
} from '@/components/data-table'
import type { Post } from '@/lib/schemas'

/** Loose post row (marketing view). */
export interface MarketingPostRow extends Post {
  category?: string
}

const columnHelper = createColumnHelper<DataTableFeatures, MarketingPostRow>()

export function getMarketingCategoryBadge(category: string, t: (key: string, fallback?: string) => string) {
  switch (category) {
    case 'NEWS': return <Badge variant="outline">{t('marketing.cms.categoryNews', 'Tin tức')}</Badge>
    case 'PROMOTION': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{t('marketing.cms.categoryPromotion', 'Khuyến mãi')}</Badge>
    case 'EVENT': return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">{t('marketing.cms.categoryEvent', 'Sự kiện')}</Badge>
    case 'BLOG': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{t('marketing.cms.categoryBlog', 'Blog')}</Badge>
    default: return <Badge variant="outline">{category}</Badge>
  }
}

export function getMarketingStatusBadge(status: string, t: (key: string, fallback?: string) => string) {
  switch (status) {
    case 'PUBLISHED': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{t('marketing.cms.statusPublished', 'Đã xuất bản')}</Badge>
    case 'DRAFT': return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">{t('marketing.cms.statusDraft', 'Nháp')}</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}

export function createMarketingPostColumns(
  t: (key: string, fallback?: string) => string,
  onEdit: (post: MarketingPostRow) => void
) {
  return [
    columnHelper.accessor('title', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('marketing.cms.colTitle', 'Tiêu đề')} />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('marketing.cms.colTitle', 'Tiêu đề') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) => row.category ?? row.categoryId, {
      id: 'category',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('marketing.cms.colCategory', 'Chuyên mục')} />
      ),
      cell: ({ row }) => getMarketingCategoryBadge(String(row.getValue('category')), t),
      filterFn: 'equalsString',
      meta: { headerTitle: t('marketing.cms.colCategory', 'Chuyên mục') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor('status', {
      id: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.status', 'Trạng thái')} />
      ),
      cell: ({ row }) => getMarketingStatusBadge(row.original.status, t),
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
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" title={t('common.view', 'Xem')}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-25 text-right' } satisfies DataTableColumnMeta,
    }),
  ]
}
