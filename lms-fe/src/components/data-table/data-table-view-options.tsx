'use client'

/**
 * DataTableViewOptions — column visibility dropdown (shadcn/ui pattern).
 *
 * Lists every hideable column with a checkbox; unchecking hides the column
 * in the table. Rendered at the right end of the toolbar.
 */

import { Columns3 } from 'lucide-react'
import type { ReactTable, RowData } from '@tanstack/react-table'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/i18n'
import { getColumnMeta, type DataTableColumnMeta } from './data-table'
import type { DataTableFeatures } from './data-table-features'

interface DataTableViewOptionsProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>
}

export function DataTableViewOptions<TData extends RowData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  const { t } = useTranslation()
  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide())

  if (hideableColumns.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 lg:flex"
          data-slot="view-options"
        >
          <Columns3 className="mr-2 h-4 w-4" />
          {t('dataTable.columns', 'Cột')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>{t('dataTable.toggleColumns', 'Hiển thị cột')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hideableColumns.map((column) => {
          const meta = getColumnMeta(column.columnDef)
          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {meta.headerTitle ?? column.id}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
