/**
 * Sidebar — the dashboard navigation column (desktop aside + mobile sheet).
 *
 * Renders sectioned nav links driven by nav-config on a dark "ink" gradient
 * shell with a glowing gradient pill for the active item. The footer holds
 * the theme toggle, logout and a compact user chip. Links use hash routing
 * (`#<role>/<view>`).
 *
 * Scrolling uses NATIVE overflow (custom-scrollbar) instead of the Radix
 * ScrollArea — the Radix custom viewport breaks mouse-wheel scrolling in
 * some browsers; native overflow always works.
 */

'use client'

import { GraduationCap, ChevronLeft, LogOut, Sun, Moon, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { useLMSStore, ROLE_COLORS, parseAllLMSRoles } from '@/store/lms-store'
import { getUserDisplayName } from '@/lib/api'
import { getInitials } from '@/components/shared/avatar'
import Link from 'next/link'
import type { NavItem } from './nav-config'

export interface SidebarProps {
  navItems: NavItem[]
  activeView: string
  currentRole: string
  roleColor: { bgColor: string; color: string; avatarBg?: string; label?: string }
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
  const authUser = useLMSStore((s) => s.authUser)
  const displayName = authUser ? (authUser.nickname || getUserDisplayName(authUser)) : ''
  const primaryRole = authUser?.roles ? parseAllLMSRoles(authUser.roles)[0] : null
  const chipColor = primaryRole ? ROLE_COLORS[primaryRole] : roleColor

  return (
    <div className="sidebar-ink relative flex flex-col h-full text-slate-200">
      {/* Logo */}
      <div className="relative h-16 flex items-center gap-3 px-4 shrink-0">
        <div className="p-2.5 rounded-xl bg-linear-to-br from-indigo-500 to-sky-400 shadow-lg shadow-indigo-950/50">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-sm text-white truncate">Việt Mỹ Global</h1>
          <p className="text-[11px] text-slate-400 truncate">{t('sidebar.subtitle')}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => setSidebarOpen(false)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation — native overflow scroll (see file docblock) */}
      <nav className="relative flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain px-3 py-2">
        <div className="space-y-1 pb-2">
          {navItems.map((item) => {
            const isActive = activeView === item.id
            return (
              <div key={item.id}>
                {item.sectionKey && (
                  <div className="pt-4 pb-1.5 px-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400/80">
                      {t(item.sectionKey, item.sectionDefault)}
                    </span>
                  </div>
                )}
                <a
                  href={`#${currentRole}/${item.id}`}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer no-underline ${
                    isActive
                      ? 'nav-active-pill text-white shadow-lg'
                      : 'text-slate-200 hover:text-white hover:bg-white/[0.08] active:scale-[0.98]'
                  }`}
                >
                  <item.icon className={`h-4 w-4 shrink-0 transition-transform ${isActive ? 'scale-110' : ''}`} />
                  <span className="truncate">{t(item.labelKey, item.labelDefault)}</span>
                </a>
              </div>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="relative shrink-0 border-t border-white/10 p-3 space-y-1">
        {/* Account quick link */}
        <Link
          href={`#${currentRole}/account`}
          onClick={() => setSidebarOpen(false)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer no-underline ${
            activeView === 'account'
              ? 'bg-white/10 text-white'
              : 'text-slate-200 hover:text-white hover:bg-white/[0.08]'
          }`}
        >
          <span className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-linear-to-br from-indigo-500 to-sky-500`}>
            {displayName ? getInitials(displayName) : '—'}
          </span>
          <span className="flex-1 min-w-0 truncate text-left font-medium">{displayName || t('nav.account', 'Tài khoản của tôi')}</span>
          <Settings2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Link>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{theme === 'dark' ? t('sidebar.light') : t('sidebar.dark')}</span>
        </button>
        <button
          onClick={() => { localStorage.removeItem('vmg-ui'); logout() }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-200 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>{t('sidebar.logout')}</span>
        </button>

        <div className="px-3 pt-1 pb-0.5 text-[10px] text-slate-500 truncate">
          {chipColor?.label ? `${chipColor.label} · Việt Mỹ Global` : 'Việt Mỹ Global'}
        </div>
      </div>
    </div>
  )
}
