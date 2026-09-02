/**
 * Shared table features — the shadcn/ui base data-table pattern for
 * TanStack Table v9.
 *
 * TanStack Table v9 is feature-based: you opt into the behavior you want
 * (sorting, filtering, pagination, …) by declaring it with `tableFeatures()`.
 * Anything not registered is tree-shaken out of the bundle. Every data table
 * in the app reuses this single features object so behavior stays consistent;
 * the matching `DataTableFeatures` type is passed as the first generic
 * argument to `ColumnDef`, `ColumnHelper`, and `DataTable`.
 *
 * @see https://ui.shadcn.com/docs/components/base/data-table
 */

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrIncludes,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table"

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    equalsString: filterFn_equalsString,
    arrIncludes: filterFn_arrIncludes,
  },
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
})

/** Feature APIs available on every table in the app (see dataTableFeatures). */
export type DataTableFeatures = typeof dataTableFeatures
