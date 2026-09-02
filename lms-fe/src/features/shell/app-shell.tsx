/**
 * AppShell — the authenticated dashboard layout: sidebar (desktop aside +
 * mobile sheet), sticky header (breadcrumbs, locale, theme, role switcher,
 * profile), animated content area routed by renderView, and the footer.
 *
 * Also owns the session concerns: one-shot hydration, the central auth gate
 * (redirect to /login on expiry), and hash-based role/view routing.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { ChevronDown, ChevronRight, Menu, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { LocaleToggle } from '@/components/shared/locale-toggle'
import { getInitials } from '@/components/shared/avatar'
import { useLMSStore, ROLE_COLORS, parseAllLMSRoles, type ActiveView } from '@/store/lms-store'
import type { UserRole } from '@/lib/schemas'
import { getUserDisplayName } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { NAV_MAP } from './nav-config'
import { Sidebar } from './sidebar'
import { renderView } from './view-router'

export function AppShell() {
  const { isAuthenticated, authUser, currentRole, activeView, sidebarOpen, isHydrating, setActiveView, setCurrentRole, logout, toggleSidebar, setSidebarOpen } = useLMSStore()

  // Parse all LMS roles the user has
  const allLMSRoles = authUser?.roles ? parseAllLMSRoles(authUser.roles) : []
  const hasMultipleRoles = allLMSRoles.length > 1
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)

  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const hydrateRef = useRef(false)

  // One-shot session hydration from the server cookie.
  useEffect(() => {
    if (!hydrateRef.current) {
      hydrateRef.current = true
      const state = useLMSStore.getState()
      if (!state.isAuthenticated || !state.authUser) {
        state.hydrate()
      }
    }
  }, [])

  // Central auth gate: whenever auth is resolved as invalid (initial
  // hydration returned 401, or a later API call fired `auth:expired`),
  // redirect to /login. Also covers "session dies mid-dashboard".
  useEffect(() => {
    if (!isHydrating && (!isAuthenticated || !authUser || !currentRole)) {
      router.replace('/login')
    }
  }, [isHydrating, isAuthenticated, authUser, currentRole, router])

  // Hash-based routing sync (role/view deep links).
  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash && isAuthenticated && authUser) {
        const [role, view] = hash.split('/')
        if (role && view) {
          const allRoles = parseAllLMSRoles(authUser.roles)
          if (allRoles.includes(role as UserRole) && role !== currentRole) {
            setCurrentRole(role as UserRole)
          }
          setActiveView(view as ActiveView)
        }
      }
    }
    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [isAuthenticated, authUser, currentRole, setCurrentRole, setActiveView])

  // Keep the URL hash in sync with the active (role, view).
  useEffect(() => {
    if (isAuthenticated && currentRole && activeView) {
      const newHash = `#${currentRole}/${activeView}`
      if (window.location.hash !== newHash) {
        window.location.hash = newHash
      }
    }
  }, [activeView, currentRole, isAuthenticated])

  if (isHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{t('auth.checking')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !authUser || !currentRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{t('auth.redirecting')}</p>
        </div>
      </div>
    )
  }

  const navItems = NAV_MAP[currentRole] || []
  const roleColor = ROLE_COLORS[currentRole] || ROLE_COLORS.lms_admin
  const activeNav = navItems.find(n => n.id === activeView)
  const activeNavLabel = activeNav ? t(activeNav.labelKey, activeNav.labelDefault) : ''
  const activeNavSection = activeNav?.sectionKey ? t(activeNav.sectionKey, activeNav.sectionDefault) : (activeNav?.sectionKey || 'Menu')

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar — the Sidebar component paints its own dark ink gradient */}
      <aside className="hidden lg:flex lg:w-65 lg:flex-col lg:fixed lg:inset-y-0 overflow-hidden">
        <Sidebar
          navItems={navItems}
          activeView={activeView!}
          currentRole={currentRole}
          roleColor={roleColor}
          theme={theme}
          setTheme={setTheme}
          logout={logout}
          setSidebarOpen={setSidebarOpen}
        />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-70 p-0 bg-transparent border-white/10">
          <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
          <Sidebar
            navItems={navItems}
            activeView={activeView!}
            currentRole={currentRole}
            roleColor={roleColor}
            theme={theme}
            setTheme={setTheme}
            logout={logout}
            setSidebarOpen={setSidebarOpen}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-65">
        {/* Header */}
        <header className="sticky top-0 z-40 h-14 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 shadow-[0_1px_12px_oklch(0.45_0.1_267/6%)] flex items-center px-4 gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={toggleSidebar}>
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-sm">
            {activeNav && (
              <>
                <span className="text-muted-foreground">{activeNavSection}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="font-medium">{activeNavLabel}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Role badge — clickable if user has multiple LMS roles */}
            {hasMultipleRoles ? (
              <div className="relative">
                <button
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className={`inline-flex items-center gap-1 rounded-full border-0 text-[11px] font-medium px-2.5 py-1 cursor-pointer ${roleColor.bgColor} ${roleColor.color}`}
                >
                  {roleColor.label}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {roleMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setRoleMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border bg-popover shadow-lg py-1">
                      {allLMSRoles.map((role) => {
                        const rc = ROLE_COLORS[role]
                        return (
                          <button
                            key={role}
                            onClick={() => { setCurrentRole(role); setRoleMenuOpen(false) }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${role === currentRole ? 'bg-muted font-medium' : ''}`}
                          >
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${rc.avatarBg}`}>{rc.label[0]}</div>
                            <span>{rc.label}</span>
                            {role === currentRole && <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Badge variant="secondary" className={`${roleColor.bgColor} ${roleColor.color} border-0 text-[11px] font-medium px-2.5`}>
                {roleColor.label}
              </Badge>
            )}

            <div className="flex items-center gap-2 pl-2 border-l">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${roleColor.avatarBg}`}>
                {getInitials(authUser.nickname || getUserDisplayName(authUser))}
              </div>
              <span className="hidden sm:block text-sm font-medium max-w-30 truncate">{authUser.nickname || getUserDisplayName(authUser)}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentRole}-${activeView}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {renderView(currentRole, activeView!)}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
          © 2026 Việt Mỹ Global — Hệ thống Quản lý Trung tâm Anh ngữ
        </footer>
      </div>
    </div>
  )
}
