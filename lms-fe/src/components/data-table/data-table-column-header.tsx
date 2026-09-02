'use client'

/**
 * DataTableColumnHeader — sortable column header (shadcn/ui pattern).
 *
 * Renders the title with a sort-direction indicator; clicking toggles asc →
 * desc → none. The dropdown exposes explicit sort options plus "Hide column"
 * so keyboard/mobile users get the same affordances.
 */

import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from 'lucide-react'
import type { Column, RowData } from '@tanstack/react-table'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/i18n'
import type { DataTableFeatures } from './data-table-features'

interface DataTableColumnHeaderProps<TData extends RowData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<DataTableFeatures, TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const { t } = useTranslation()

  if (!column.getCanSort()) {
    return (
      <span className={cn('text-xs font-semibold uppercase tracking-wide', className)}>
        {title}
      </span>
    )
  }

  const sorted = column.getIsSorted()

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent uppercase text-xs font-semibold tracking-wide"
          >
            {title}
            {sorted === 'desc' ? (
              <ArrowDown className="ml-1.5 h-3.5 w-3.5" />
            ) : sorted === 'asc' ? (
              <ArrowUp className="ml-1.5 h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground/60" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {sorted !== 'asc' && (
            <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
              <ArrowUp className="mr-2 h-3.5 w-3.5" />
              <span data-slot="sort-asc">{t('dataTable.sortAsc', 'Tăng dần')}</span>
            </DropdownMenuItem>
          )}
          {sorted !== 'desc' && (
            <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
              <ArrowDown className="mr-2 h-3.5 w-3.5" />
              <span data-slot="sort-desc">{t('dataTable.sortDesc', 'Giảm dần')}</span>
            </DropdownMenuItem>
          )}
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOff className="mr-2 h-3.5 w-3.5" />
                {t('dataTable.hideColumn', 'Ẩn cột')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
