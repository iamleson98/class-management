'use client'

/**
 * Dashboard entry — providers + the app shell. All layout/routing logic
 * lives in features/shell; this file stays a thin mount point.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { LanguageProvider } from '@/lib/i18n'
import { AppShell } from '@/features/shell/app-shell'

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AppShell />
      </LanguageProvider>
    </QueryClientProvider>
  )
}
