'use client'

import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useTranslation()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
      className={cn('gap-1.5 text-xs font-medium', className)}
    >
      <Globe className="h-3.5 w-3.5" />
      {locale === 'vi' ? 'VN' : 'EN'}
    </Button>
  )
}
