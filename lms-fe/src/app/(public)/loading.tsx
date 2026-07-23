"use client"

import { useTranslation } from '@/lib/i18n'

export default function PublicLoading() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">{t('common.loading', 'Đang tải...')}</p>
      </div>
    </div>
  )
}
