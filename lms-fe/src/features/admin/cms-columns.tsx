'use client'

/**
 * Column definitions for the Admin CMS (blog posts) screen.
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
import type { Post } from '@/lib/schemas'
import { getUserDisplayName } from '@/lib/api'

export const CMS_STATUS_MAP: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
  PENDING: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  PUBLISHED: { label: 'Đã xuất bản', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
}

/** Loose post row (author join may or may not be expanded). */
export interface PostRow extends Post {
  authorName?: string
  createdAt?: string
  author?: { nickname?: string; username?: string; firstname?: string; lastname?: string; id?: string } | null
}

const columnHelper = createColumnHelper<DataTableFeatures, PostRow>()

interface PostColumnsHandlers {
  onView: (post: PostRow) => void
  onEdit: (post: PostRow) => void
  onDelete: (post: PostRow) => void
  /** Resolves the category label for a post (categories are fetched apart). */
  getCategoryName: (post: PostRow) => string
  /** Fallback author display (the logged-in user). */
  getAuthorFallback: () => string
}

export function createPostColumns(
  t: (key: string, fallback?: string) => string,
  { onView, onEdit, onDelete, getCategoryName, getAuthorFallback }: PostColumnsHandlers
) {
  return [
    columnHelper.accessor('title', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('cms.title', 'Tiêu đề')} />
      ),
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.title}</span>,
      filterFn: 'includesString',
      meta: { headerTitle: t('cms.title', 'Tiêu đề') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor(getCategoryName, {
      id: 'category',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('cms.category', 'Chuyên mục')} />
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell text-sm text-muted-foreground">{row.getValue('category')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden md:table-cell',
        headerTitle: t('cms.category', 'Chuyên mục'),
      } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor(
      (row) =>
        row.authorName ||
        row.author?.nickname ||
        getUserDisplayName(row.author as never) ||
        getAuthorFallback() ||
        '-',
      {
        id: 'author',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('cms.author', 'Tác giả')} />
        ),
        cell: ({ row }) => (
          <span className="hidden lg:table-cell text-sm text-muted-foreground">{row.getValue('author')}</span>
        ),
        filterFn: 'includesString',
        meta: {
          className: 'hidden lg:table-cell',
          headerTitle: t('cms.author', 'Tác giả'),
        } satisfies DataTableColumnMeta,
      }
    ),
    columnHelper.accessor('status', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('common.status', 'Trạng thái')} />
      ),
      cell: ({ row }) => {
        const status = CMS_STATUS_MAP[row.original.status] ?? CMS_STATUS_MAP.DRAFT
        return <Badge className={cn('rounded-full text-xs', status.className)}>{status.label}</Badge>
      },
      filterFn: 'equalsString',
      meta: { headerTitle: t('common.status', 'Trạng thái') } satisfies DataTableColumnMeta,
    }),
    columnHelper.accessor((row) =>
      row.createdAt ? new Date(row.createdAt).toLocaleDateString('vi-VN') : '-'
    , {
      id: 'publishDate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('cms.publishDate', 'Ngày đăng')} />
      ),
      cell: ({ row }) => (
        <span className="hidden lg:table-cell text-sm text-muted-foreground">{row.getValue('publishDate')}</span>
      ),
      filterFn: 'includesString',
      meta: {
        className: 'hidden lg:table-cell',
        headerTitle: t('cms.publishDate', 'Ngày đăng'),
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(row.original)}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDelete(row.original)}>
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
