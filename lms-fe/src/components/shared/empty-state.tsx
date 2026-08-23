'use client'

import { Button } from '@/components/ui/button'
import { LucideIcon, ArrowRight } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { isValidElement, ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon | ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-center px-4">
      {/* Decorative background ring */}
      <div className="relative mb-8">
        <div className="absolute -inset-3 rounded-full border-2 border-dashed border-sky-200/60 dark:border-sky-800/40 animate-[spin_20s_linear_infinite]" />
        <div className="absolute -inset-1 rounded-full border border-sky-100/80 dark:border-sky-900/50" />
        <div className="rounded-full p-0.5 bg-linear-to-br from-sky-300/60 via-teal-200/40 to-cyan-300/60 dark:from-sky-700/40 dark:via-teal-800/30 dark:to-cyan-700/40">
          <div className="relative h-24 w-24 rounded-full bg-linear-to-br from-sky-50 via-teal-50 to-cyan-50 dark:from-sky-950/60 dark:via-teal-950/40 dark:to-cyan-950/30 flex items-center justify-center">
            {isValidElement(Icon) ? Icon : <>{Icon && typeof Icon === 'function' && (() => { const C = Icon as any; return <C className="h-10 w-10 text-sky-600 dark:text-sky-400" strokeWidth={1.5} /> })()}</>}
          </div>
        </div>
      </div>

      <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 max-w-md">
        {title || t('common.noData', 'Chưa có dữ liệu')}
      </h3>

      <p className="text-sm sm:text-base text-muted-foreground max-w-lg leading-relaxed mb-8">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          size="lg"
          className="bg-linear-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-xl px-6 h-11 text-sm font-semibold gap-2"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}