'use client'

/**
 * DataTablePagination — shadcn/ui data-table pagination footer.
 *
 * Rows-per-page selector + first/prev/page-numbers/next/last buttons and a
 * "showing X–Y of Z" counter. Works for both client-side pagination (page
 * count derived from the row model) and server-driven pagination (page count
 * derived from a `rowCount`/`pageCount` option passed to the table).
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { ReactTable, RowData } from '@tanstack/react-table'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n'
import type { DataTableFeatures } from './data-table-features'

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50]

interface DataTablePaginationProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>
  pageSizeOptions?: number[]
  className?: string
}

export function DataTablePagination<TData extends RowData>({
  table,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
}: DataTablePaginationProps<TData>) {
  const { t } = useTranslation()

  // Destructure so React re-renders when these change (controlled state).
  const { pageIndex, pageSize } = table.state.pagination
  const totalRowCount = table.getRowCount()
  const pageCount = table.getPageCount()
  const rowsOnPage = table.getRowModel().rows.length
  const startIndex = totalRowCount === 0 ? 0 : pageIndex * pageSize
  const endIndex = table.options.manualPagination
    ? startIndex + rowsOnPage
    : Math.min(startIndex + pageSize, totalRowCount)

  if (totalRowCount === 0 && pageCount <= 1) return null

  // Page number buttons (window of 5, with ellipsis), mirroring the app's
  // established pagination UX.
  const pageNumbers: (number | 'dots')[] = []
  const maxVisible = 5
  if (pageCount <= maxVisible + 2) {
    for (let i = 0; i < pageCount; i++) pageNumbers.push(i)
  } else {
    pageNumbers.push(0)
    if (pageIndex > 2) pageNumbers.push('dots')
    const start = Math.max(1, pageIndex - 1)
    const end = Math.min(pageCount - 2, pageIndex + 1)
    for (let i = start; i <= end; i++) pageNumbers.push(i)
    if (pageIndex < pageCount - 3) pageNumbers.push('dots')
    pageNumbers.push(pageCount - 1)
  }

  return (
    <div
      data-slot="data-table-pagination"
      className={cn('flex flex-col sm:flex-row items-center justify-between gap-3', className)}
    >
      <p className="text-sm text-muted-foreground order-2 sm:order-1" data-slot="pagination-summary">
        {t('pagination.showing', 'Hiển thị')}{' '}
        <span className="font-medium text-foreground">
          {totalRowCount === 0 ? 0 : startIndex + 1}–{endIndex}
        </span>{' '}
        {t('pagination.of', 'trong tổng số')}{' '}
        <span className="font-medium text-foreground">{totalRowCount}</span>
      </p>

      <div className="flex items-center gap-2 order-3 sm:order-2" data-slot="pagination-size">
        <span className="text-xs text-muted-foreground text-nowrap">
          {t('pagination.rows', 'Số dòng')}
        </span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            table.setPageIndex(0)
            table.setPageSize(Number(v))
          }}
        >
          <SelectTrigger className="h-8 w-16 rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)} className="text-xs">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1 order-1 sm:order-3" data-slot="pagination-nav">
        <Button
          variant="outline"
          size="icon"
          className="hidden h-8 w-8 rounded-lg sm:flex"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.setPageIndex(0)}
          aria-label={t('common.first', 'Trang đầu')}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          aria-label={t('common.previous', 'Trang trước')}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        {pageNumbers.map((page, idx) =>
          page === 'dots' ? (
            <span key={`dots-${idx}`} className="px-1.5 text-muted-foreground text-xs select-none">
              …
            </span>
          ) : (
            <Button
              key={page}
              variant={page === pageIndex ? 'default' : 'outline'}
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg text-xs font-medium',
                page === pageIndex && 'bg-sky-600 hover:bg-sky-700 text-white border-sky-600'
              )}
              onClick={() => table.setPageIndex(page)}
              aria-current={page === pageIndex ? 'page' : undefined}
            >
              {page + 1}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          aria-label={t('common.next', 'Trang sau')}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="hidden h-8 w-8 rounded-lg sm:flex"
          disabled={!table.getCanNextPage()}
          onClick={() => table.setPageIndex(pageCount - 1)}
          aria-label={t('common.last', 'Trang cuối')}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
