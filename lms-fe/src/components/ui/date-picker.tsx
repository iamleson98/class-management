'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DatePickerProps {
  value?: string      // ISO date string or 'YYYY-MM-DD'
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** When true (or when rendered inside a FormField with an error), the
   *  trigger border/label turn destructive red. Forwarded as aria-invalid so
   *  the Button's built-in `aria-invalid:border-destructive` styling applies. */
  invalid?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Chọn ngày',
  className,
  disabled = false,
  invalid = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const date = value ? new Date(value) : undefined
  const formattedValue = date ? format(date, 'dd/MM/yyyy', { locale: vi }) : ''

  const handleSelect = (selected: Date | undefined) => {
    if (!selected) return
    // Convert to YYYY-MM-DD for consistency with native date input
    const y = selected.getFullYear()
    const m = String(selected.getMonth() + 1).padStart(2, '0')
    const d = String(selected.getDate()).padStart(2, '0')
    onChange?.(`${y}-${m}-${d}`)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            'h-9 w-full justify-start text-left font-normal',
            !formattedValue && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formattedValue || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
