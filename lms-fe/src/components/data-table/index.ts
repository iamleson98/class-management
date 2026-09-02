/**
 * Reusable data-table module — the shadcn/ui base data-table pattern built on
 * TanStack Table v9 (see data-table-features.ts for the feature registry).
 *
 * Feature screens define their columns (usually next to the screen, in
 * columns.tsx) and render the composed <DataTable />; sorting, filtering,
 * pagination, column visibility, loading/empty states come for free.
 *
 * @see https://ui.shadcn.com/docs/components/base/data-table
 */

export { DataTable, selectColumn, getColumnMeta, type DataTableProps, type DataTableColumnMeta } from './data-table'
export { DataTableColumnHeader } from './data-table-column-header'
export { DataTableToolbar } from './data-table-toolbar'
export { DataTableViewOptions } from './data-table-view-options'
export { DataTablePagination } from './data-table-pagination'
export { dataTableFeatures, type DataTableFeatures } from './data-table-features'
