/**
 * Sidebar — the dashboard navigation column (desktop aside + mobile sheet).
 *
 * Renders sectioned nav links driven by nav-config, with theme toggle and
 * logout in the footer. Links use hash routing (`#<role>/<view>`).
 */

'use client'

import { GraduationCap, ChevronLeft, LogOut, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from '@/lib/i18n'
import type { NavItem } from './nav-config'

export interface SidebarProps {
  navItems: NavItem[]
  activeView: string
  currentRole: string
  roleColor: { bgColor: string; color: string }
  theme?: string
  setTheme: (theme: string) => void
  logout: () => void
  setSidebarOpen: (open: boolean) => void
}

export function Sidebar({
  navItems,
  activeView,
  currentRole,
  roleColor,
  theme,
  setTheme,
  logout,
  setSidebarOpen,
}: SidebarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-14 flex items-center gap-3 px-2">
        <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
          <GraduationCap className="h-6 w-6 text-sky-600 dark:text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-sm truncate">Việt Mỹ Global</h1>
          <p className="text-xs text-muted-foreground truncate">{t('sidebar.subtitle')}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 px-3 py-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeView === item.id
            return (
              <div key={item.id}>
                {item.sectionKey && (
                  <div className="pt-4 pb-1 px-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{t(item.sectionKey, item.sectionDefault)}</span>
                  </div>
                )}
                <a
                  href={`#${currentRole}/${item.id}`}
                  onClick={() => setSidebarOpen(false)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer no-underline ${isActive
                      ? `bg-linear-to-r ${roleColor.bgColor} ${roleColor.color}`
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="truncate">{t(item.labelKey, item.labelDefault)}</span>
                </a>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{theme === 'dark' ? t('sidebar.light') : t('sidebar.dark')}</span>
        </button>
        <button
          onClick={() => { localStorage.removeItem('vmg-ui'); logout() }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>{t('sidebar.logout')}</span>
        </button>
      </div>
    </div>
  )
}
