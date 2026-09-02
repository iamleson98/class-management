'use client'

/**
 * DataTableToolbar — shadcn/ui data-table toolbar.
 *
 * Renders the column search input (bound to a column filter) plus a slot for
 * feature-specific controls (status selects, action buttons…) and the column
 * visibility dropdown on the right.
 */

import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import type { ReactTable, RowData } from '@tanstack/react-table'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n'
import { DataTableViewOptions } from './data-table-view-options'
import type { DataTableFeatures } from './data-table-features'

interface DataTableToolbarProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>
  searchColumnId?: string
  searchPlaceholder?: string
  toolbarActions?: ReactNode
  showViewOptions?: boolean
  className?: string
}

export function DataTableToolbar<TData extends RowData>({
  table,
  searchColumnId,
  searchPlaceholder,
  toolbarActions,
  showViewOptions = true,
  className,
}: DataTableToolbarProps<TData>) {
  const { t } = useTranslation()
  const searchColumn = searchColumnId ? table.getColumn(searchColumnId) : undefined
  const filterValue = (searchColumn?.getFilterValue() as string) ?? ''

  const isFiltered = Boolean(
    searchColumn?.getFilterValue() ||
    table.state.columnFilters?.length ||
    table.state.globalFilter
  )

  return (
    <div
      data-slot="data-table-toolbar"
      className={cn('flex flex-col sm:flex-row gap-3 items-start sm:items-center', className)}
    >
      {searchColumn && (
        <div className="relative w-full sm:max-w-70" data-slot="table-search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={filterValue}
            onChange={(e) => searchColumn.setFilterValue(e.target.value)}
            className="pl-9"
            inputMode="search"
          />
          {filterValue && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => searchColumn.setFilterValue(undefined)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {toolbarActions && (
        <div className="flex flex-wrap items-center gap-3" data-slot="toolbar-actions">
          {toolbarActions}
        </div>
      )}

      {showViewOptions && <DataTableViewOptions table={table} />}

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground"
          onClick={() => table.resetColumnFilters()}
          data-slot="reset-filters"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          {t('dataTable.clearFilters', 'Xóa bộ lọc')}
        </Button>
      )}
    </div>
  )
}
