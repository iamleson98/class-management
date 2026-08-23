'use client'

import { useMemo, useCallback, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50]

export interface PaginationState {
  pageIndex: number
  pageSize: number
}

export function usePagination(initialPageSize = 10) {
  const [state, setState] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  })

  const setPageIndex = useCallback((pageIndex: number) => {
    setState(s => ({ ...s, pageIndex }))
  }, [])

  const setPageSize = useCallback((pageSize: number) => {
    setState({ pageIndex: 0, pageSize })
  }, [])

  const nextPage = useCallback(() => {
    setState(s => ({ ...s, pageIndex: s.pageIndex + 1 }))
  }, [])

  const prevPage = useCallback(() => {
    setState(s => ({ ...s, pageIndex: Math.max(0, s.pageIndex - 1) }))
  }, [])

  const reset = useCallback(() => {
    setState({ pageIndex: 0, pageSize: initialPageSize })
  }, [initialPageSize])

  return { ...state, setPageIndex, setPageSize, nextPage, prevPage, reset }
}

export interface PaginatedData<T> {
  data: T[]
  totalItems: number
  totalPages: number
  startIndex: number
  endIndex: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  pageIndex: number
  pageSize: number
}

export function paginate<T>(items: T[], pageIndex: number, pageSize: number): PaginatedData<T> {
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePageIndex = Math.min(pageIndex, totalPages - 1)
  const startIndex = safePageIndex * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  return {
    data: items.slice(startIndex, endIndex),
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    hasPreviousPage: safePageIndex > 0,
    hasNextPage: safePageIndex < totalPages - 1,
    pageIndex: safePageIndex,
    pageSize,
  }
}

/**
 * Compute page-control props from a SERVER-reported total count (server-driven
 * paging). Use this with the typed query mechanism: the API returns
 * { items, totalCount } for the requested page, and this helper derives the
 * PaginationControls props (totalPages, startIndex, hasNextPage, ...) without
 * needing the full client-side array.
 *
 * `itemsOnPage` is the number of items in the current page's response — used
 * only to compute endIndex for the "Showing X–Y of Z" label.
 */
export interface ServerPageInfo {
  totalItems: number
  totalPages: number
  startIndex: number
  endIndex: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  pageIndex: number
  pageSize: number
}

export function derivePageInfo(
  totalCount: number,
  pageIndex: number,
  pageSize: number,
  itemsOnPage: number,
): ServerPageInfo {
  const totalItems = totalCount
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePageIndex = Math.min(Math.max(0, pageIndex), totalPages - 1)
  const startIndex = safePageIndex * pageSize
  const endIndex = startIndex + Math.max(0, itemsOnPage)

  return {
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    hasPreviousPage: safePageIndex > 0,
    hasNextPage: safePageIndex < totalPages - 1,
    pageIndex: safePageIndex,
    pageSize,
  }
}

interface PaginationControlsProps {
  pageIndex: number
  totalPages: number
  totalItems: number
  pageSize: number
  startIndex: number
  endIndex: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  onPageIndexChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  className?: string
}

export function PaginationControls({
  pageIndex,
  totalPages,
  totalItems,
  pageSize,
  startIndex,
  endIndex,
  hasPreviousPage,
  hasNextPage,
  onPageIndexChange,
  onPageSizeChange,
  className,
}: PaginationControlsProps) {
  const { t } = useTranslation()
  const pageNumbers = useMemo(() => {
    const pages: (number | 'dots')[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible + 2) {
      for (let i = 0; i < totalPages; i++) pages.push(i)
    } else {
      pages.push(0)
      if (pageIndex > 2) pages.push('dots')
      const start = Math.max(1, pageIndex - 1)
      const end = Math.min(totalPages - 2, pageIndex + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (pageIndex < totalPages - 3) pages.push('dots')
      pages.push(totalPages - 1)
    }

    return pages
  }, [pageIndex, totalPages])

  if (totalItems === 0) return null

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-3', className)}>
      {/* Showing X-Y of Z */}
      <p className="text-sm text-muted-foreground order-2 sm:order-1">
        {t('pagination.showing', 'Hiển thị')}{' '}
        <span className="font-medium text-foreground">{startIndex + 1}–{endIndex}</span>{' '}
        {t('pagination.of', 'trong tổng số')} <span className="font-medium text-foreground">{totalItems}</span>
      </p>

      {/* Page size selector */}
      <div className="flex items-center gap-2 order-3 sm:order-2">
        <span className="text-xs text-muted-foreground text-nowrap">{t('pagination.rows', 'Số dòng')}</span>
        <Select
          value={String(pageSize)}
          onValueChange={v => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="h-8 w-16 rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(size => (
              <SelectItem key={size} value={String(size)} className="text-xs">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1 order-1 sm:order-3">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={!hasPreviousPage}
          onClick={() => onPageIndexChange(0)}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={!hasPreviousPage}
          onClick={() => onPageIndexChange(pageIndex - 1)}
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
              onClick={() => onPageIndexChange(page)}
            >
              {page + 1}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={!hasNextPage}
          onClick={() => onPageIndexChange(pageIndex + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={!hasNextPage}
          onClick={() => onPageIndexChange(totalPages - 1)}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}