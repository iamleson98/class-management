'use client'

import * as React from 'react'
import { ClockIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface TimePickerProps {
  /** Time value in 24h `HH:mm` format. */
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** When true the trigger border turns destructive red. Forwarded as
   *  aria-invalid so the Button's built-in styling applies. */
  invalid?: boolean
  /** Step between consecutive options, in minutes. Defaults to 15. */
  stepMinutes?: number
}

function buildOptions(stepMinutes: number): string[] {
  const step = Math.max(1, Math.round(stepMinutes))
  const opts: string[] = []
  for (let m = 0; m < 24 * 60; m += step) {
    const h = Math.floor(m / 60)
    const min = m % 60
    opts.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return opts
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Chọn giờ',
  className,
  disabled = false,
  invalid = false,
  stepMinutes = 15,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const options = React.useMemo(() => buildOptions(stepMinutes), [stepMinutes])

  const listRef = React.useRef<HTMLDivElement>(null)
  const selectedRef = React.useRef<HTMLButtonElement>(null)

  // Scroll the selected option into view when the popover opens.
  React.useEffect(() => {
    if (open && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center' })
    }
  }, [open])

  const handleSelect = (v: string) => {
    onChange?.(v)
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
            !value && 'text-muted-foreground',
            className
          )}
        >
          <ClockIcon className="mr-2 h-4 w-4" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div
          ref={listRef}
          className="max-h-64 overflow-y-auto p-1"
        >
          {options.map((opt) => {
            const isSelected = opt === value
            return (
              <button
                key={opt}
                ref={isSelected ? selectedRef : undefined}
                type="button"
                onClick={() => handleSelect(opt)}
                className={cn(
                  'flex w-full items-center justify-center rounded-sm px-3 py-1.5 text-sm font-mono tabular-nums transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
