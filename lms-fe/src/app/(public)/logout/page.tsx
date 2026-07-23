'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { useLMSStore } from '@/store/lms-store'

export default function LogoutPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const logout = useLMSStore((s) => s.logout)

  useEffect(() => {
    // Store logout clears cookies, zustand state, and sessionStorage
    logout().finally(() => router.replace('/home'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <div className="p-4 bg-sky-100 dark:bg-sky-900/30 rounded-full w-fit mx-auto">
          <LogOut className="h-10 w-10 text-sky-600" />
        </div>
        <h2 className="text-2xl font-bold">{t('logout.loggingOut', 'Đang đăng xuất...')}</h2>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t('logout.pleaseWait', 'Vui lòng chờ trong giây lát')}</span>
        </div>
      </div>
    </div>
  )
}
