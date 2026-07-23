'use client'

import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
      <div className="relative mb-6">
        <div className="rounded-full p-0.5 bg-linear-to-br from-red-300/60 via-orange-200/40 to-amber-300/60 dark:from-red-700/40 dark:via-orange-800/30 dark:to-amber-700/40">
          <div className="relative h-16 w-16 rounded-full bg-linear-to-br from-red-50 via-orange-50 to-amber-50 dark:from-red-950/60 dark:via-orange-950/40 dark:to-amber-950/30 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500 dark:text-red-400" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
        {title || t('common.errorTitle', 'Đã xảy ra lỗi')}
      </h3>

      <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
        {message || t('common.errorMessage', 'Không thể tải dữ liệu. Vui lòng thử lại sau.')}
      </p>

      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="gap-2 text-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('common.retry', 'Thử lại')}
        </Button>
      )}
    </div>
  )
}
