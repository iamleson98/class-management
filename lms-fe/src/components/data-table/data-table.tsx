'use client'

/**
 * DataTable — the reusable generic data table, following the shadcn/ui base
 * data-table guide (TanStack Table v9 `tableFeatures` pattern).
 *
 * https://ui.shadcn.com/docs/components/base/data-table
 *
 * One composed component used by every table in the app:
 *  - toolbar (optional): column search + custom filter slot + column visibility
 *  - the table itself: sortable headers, staggered row animation, selection,
 *    loading skeleton, empty / no-results states
 *  - pagination footer: client-side or server-driven (manual) mode
 *
 * Column definitions belong to each feature screen (see their columns.tsx);
 * this component only wires behavior.
 */

import * as React from 'react'
import { motion } from 'framer-motion'
import { SearchX } from 'lucide-react'
import {
  useTable,
  type ColumnDef,
  type ColumnMeta,
  type PaginationState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTranslation } from '@/lib/i18n'
import { staggerContainer, staggerItem } from '@/components/shared/animations'
import { DataTablePagination } from './data-table-pagination'
import { DataTableToolbar } from './data-table-toolbar'
import { dataTableFeatures, type DataTableFeatures } from './data-table-features'

/** Extra column metadata the data-table understands (via `columnDef.meta`). */
export interface DataTableColumnMeta {
  /** Classes applied to BOTH the header cell and body cells (e.g. `hidden md:table-cell`). */
  className?: string
  /** Human title for the view-options dropdown (falls back to the column id). */
  headerTitle?: string
}

export function getColumnMeta<TData extends RowData>(
  columnDef: ColumnDef<DataTableFeatures, TData, any>
): DataTableColumnMeta {
  return (columnDef.meta ?? {}) as DataTableColumnMeta
}

export interface DataTableProps<TData extends RowData> {
  /**
   * Column definitions (TValue is `any` so accessor columns typed with any
   * value generic are assignable — e.g. `columnHelper.accessor('name')`).
   */
  columns: ColumnDef<DataTableFeatures, TData, any>[]

  /** Rows to render. `undefined` while loading (renders the skeleton). */
  data: TData[] | undefined

  /* ---------- Toolbar ---------- */

  /** Column id the search input filters (column must set `filterFn: 'includesString'`). */
  searchColumnId?: string
  searchPlaceholder?: string
  /** Custom controls rendered next to the search input (Selects, buttons…). */
  toolbarActions?: React.ReactNode
  /** Hide the toolbar entirely (defaults to auto: shown when there is anything to show). */
  showToolbar?: boolean
  showViewOptions?: boolean

  /* ---------- Pagination ---------- */

  /**
   * - `client` (default): the table slices rows itself.
   * - `server`: pagination state is controlled by the parent (the parent fetches
   *   each page); pass `paginationState`, `onPaginationChange` and `rowCount`.
   * - `none`: no pagination footer (short lists, modal tables).
   */
  paginationMode?: 'client' | 'server' | 'none'
  /** Controlled pagination state — required for `server` mode. */
  paginationState?: PaginationState
  onPaginationChange?: (state: PaginationState) => void
  /** Total row count for `server` mode. */
  rowCount?: number
  pageSizeOptions?: number[]
  initialPageSize?: number

  /* ---------- Selection ---------- */

  selectionState?: RowSelectionState
  onSelectionChange?: (state: RowSelectionState) => void
  /** Stable row identity (defaults to the row index) — set for selection to survive re-sorts. */
  getRowId?: (row: TData, index: number) => string

  /* ---------- States ---------- */

  isLoading?: boolean
  /** Rendered inside the table when there is no data and no filters active. */
  emptyState?: React.ReactNode

  /* ---------- Behavior / styling ---------- */

  /** Disable the staggered row entrance animation (default: on). */
  animateRows?: boolean
  stickyHeader?: boolean
  className?: string
  tableClassName?: string
  /** Row click handler (does not hijack clicks on inner buttons). */
  onRowClick?: (row: TData) => void
  /** Show nothing at all while loading (feature-level loading screens stay in charge). */
  hideWhileLoading?: boolean
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  searchColumnId,
  searchPlaceholder,
  toolbarActions,
  showToolbar,
  showViewOptions = true,
  paginationMode = 'client',
  paginationState,
  onPaginationChange,
  rowCount,
  pageSizeOptions,
  initialPageSize = 10,
  selectionState,
  onSelectionChange,
  getRowId,
  isLoading,
  emptyState,
  animateRows = true,
  stickyHeader = false,
  className,
  tableClassName,
  onRowClick,
  hideWhileLoading,
}: DataTableProps<TData>) {
  const { t } = useTranslation()

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [internalPagination, setInternalPagination] =
    React.useState<PaginationState>({ pageIndex: 0, pageSize: initialPageSize })
  const [internalSelection, setInternalSelection] = React.useState<RowSelectionState>({})

  const serverMode = paginationMode === 'server'
  const controlledPagination = serverMode && paginationState ? paginationState : internalPagination
  const selection = selectionState ?? internalSelection

  const table = useTable({
    features: dataTableFeatures,
    data: data ?? [],
    columns,
    // Sorting always stays client-side — the API doesn't support sort orders
    // for these endpoints yet, so we sort the visible page.
    onSortingChange: setSorting,
    getRowId,
    manualPagination: serverMode,
    rowCount: serverMode ? rowCount : undefined,
    onPaginationChange: (updater: Updater<PaginationState>) => {
      const next =
        typeof updater === 'function' ? updater(controlledPagination) : updater
      if (serverMode && onPaginationChange) {
        onPaginationChange(next)
      } else {
        setInternalPagination(next)
      }
    },
    ...(selectionState !== undefined || onSelectionChange
      ? {
          onRowSelectionChange: (updater: Updater<RowSelectionState>) => {
            const next =
              typeof updater === 'function' ? updater(selection) : updater
            if (onSelectionChange) {
              onSelectionChange(next)
            } else {
              setInternalSelection(next)
            }
          },
        }
      : {}),
    state: {
      sorting,
      // Pagination is always controlled (React state in client mode, parent
      // state in server mode) — the shadcn controlled-pagination pattern.
      pagination: controlledPagination,
      rowSelection: selection,
    },
    autoResetPageIndex: !serverMode,
  })

  const loading = isLoading || data === undefined
  const hasFilters =
    Boolean(table.state.columnFilters?.length) || Boolean(table.state.globalFilter)
  const hasData = table.getRowCount() > 0
  const columnCount = table.getVisibleLeafColumns().length

  if (loading && hideWhileLoading) return null

  const toolbarVisible =
    showToolbar ??
    Boolean(searchColumnId || toolbarActions || (showViewOptions && columnCount > 0))

  return (
    <div data-slot="data-table" className={cn('w-full space-y-3', className)}>
      {toolbarVisible && (
        <DataTableToolbar
          table={table}
          searchColumnId={searchColumnId}
          searchPlaceholder={searchPlaceholder}
          toolbarActions={toolbarActions}
          showViewOptions={showViewOptions}
        />
      )}

      <motion.div
        variants={staggerContainer}
        initial={animateRows ? 'initial' : false}
        animate="animate"
        className={cn('rounded-xl overflow-hidden border', tableClassName)}
      >
        <Table>
          <TableHeader className={cn(stickyHeader && 'sticky top-0 bg-card z-10')}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                {headerGroup.headers.map((header) => {
                  const meta = getColumnMeta(header.column.columnDef)
                  return (
                    <TableHead key={header.id} className={meta.className}>
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, rowIdx) => (
                <TableRow key={`skeleton-${rowIdx}`}>
                  {table.getVisibleLeafColumns().map((column) => (
                    <TableCell key={column.id}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : hasData ? (
              table.getRowModel().rows.map((row) => {
                const Row = animateRows ? motion.tr : 'tr'
                return (
                  <Row
                    key={row.id}
                    variants={staggerItem}
                    className={cn('hover:bg-muted/30', onRowClick && 'cursor-pointer')}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    onClick={
                      onRowClick
                        ? (e: React.MouseEvent) => {
                            // Don't hijack clicks on interactive children.
                            if ((e.target as HTMLElement).closest('button, a, input, select, [role="menu"], [role="dialog"]')) return
                            onRowClick(row.original)
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = getColumnMeta(cell.column.columnDef)
                      return (
                        <TableCell key={cell.id} className={meta.className}>
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      )
                    })}
                  </Row>
                )
              })
            ) : hasFilters ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-32">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <SearchX className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm">{t('dataTable.noResults', 'Không tìm thấy kết quả nào')}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        table.resetColumnFilters()
                        table.resetGlobalFilter()
                      }}
                    >
                      {t('dataTable.clearFilters', 'Xóa bộ lọc')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell colSpan={columnCount} className="p-0 border-b-0">
                  {emptyState ?? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                      <p className="text-sm">{t('common.noData', 'Không có dữ liệu')}</p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </motion.div>

      {paginationMode !== 'none' && hasData && (
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </div>
  )
}

/** Select-all checkbox column definition (append to a columns array). */
export function selectColumn<TData extends RowData>(
  t: (key: string, fallback?: string) => string
): ColumnDef<DataTableFeatures, TData, any> {
  return {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label={t('dataTable.selectAll', 'Chọn tất cả')}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={t('dataTable.selectRow', 'Chọn dòng')}
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  }
}
