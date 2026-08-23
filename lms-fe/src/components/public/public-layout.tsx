'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  GraduationCap, Menu, Sun, Moon, Phone, Mail, MapPin,
  Facebook, Instagram, Youtube, ChevronRight,
  Clock, LogOut, LayoutDashboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetTitle, SheetTrigger
} from '@/components/ui/sheet'
import { useLMSStore } from '@/store/lms-store'
import { getUserDisplayName } from '@/lib/api'
import { LanguageProvider } from '@/lib/i18n'
import { LocaleToggle } from '@/components/shared/locale-toggle'
import { useTranslation } from '@/lib/i18n'

/* ------------------------------------------------------------------ */
/*  Navigation links                                                   */
/* ------------------------------------------------------------------ */
const NAV_LINKS = [
  { href: '/home', labelKey: 'layout.nav.home' },
  { href: '/about', labelKey: 'layout.nav.about' },
  { href: '/courses', labelKey: 'layout.nav.courses' },
  { href: '/news', labelKey: 'layout.nav.news' },
  { href: '/contact', labelKey: 'layout.nav.contact' },
]

/* ------------------------------------------------------------------ */
/*  Mobile nav content (shared between Sheet & mobile drawer)           */
/* ------------------------------------------------------------------ */
function MobileNavContent({ close }: { close: () => void }) {
  const { isAuthenticated, authUser, logout } = useLMSStore()
  const { t } = useTranslation()

  const handleLogout = async () => {
    await logout()
    close()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center justify-between border-b">
        <Link href="/home" onClick={close} className="flex items-center gap-2">
          <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
            <GraduationCap className="h-6 w-6 text-sky-600 dark:text-sky-400" />
          </div>
          <span className="font-bold text-lg text-sky-600">VMG</span>
          <span className="text-sm text-muted-foreground hidden sm:inline">{t('layout.brand', 'Việt Mỹ Global')}</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={close}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-sky-50 dark:hover:bg-sky-950/30 hover:text-sky-600 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-sky-400" />
            {t(link.labelKey, '')}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t space-y-3">
        {isAuthenticated && authUser ? (
          <>
            <Link href="/" onClick={close} className="block">
              <Button variant="outline" className="w-full rounded-lg">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                {t('layout.nav.dashboard', 'Vào hệ thống quản lý')}
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full rounded-lg text-destructive hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('auth.logout', 'Đăng xuất')}
            </Button>
          </>
        ) : (
          <>
            <Link href="/login" onClick={close} className="block">
              <Button variant="outline" className="w-full rounded-lg">
                {t('auth.login', 'Đăng nhập')}
              </Button>
            </Link>
            <Link href="/register" onClick={close} className="block">
              <Button className="w-full rounded-lg bg-sky-600 hover:bg-sky-700">
                {t('layout.nav.register', 'Đăng ký tư vấn')}
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  PublicLayout                                                       */
/* ------------------------------------------------------------------ */
const AUTH_PAGES = ['/login', '/forgot-password', '/reset-password', '/logout']

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { setTheme, resolvedTheme } = useTheme()
  const { isAuthenticated, authUser, logout, isHydrating } = useLMSStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const hydrateRef = useRef(false)
  const { t } = useTranslation()

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  // Hydrate auth state on mount (check cookies)
  useEffect(() => {
    if (!hydrateRef.current) {
      hydrateRef.current = true
      useLMSStore.getState().hydrate()
    }
  }, [])

  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p))

  const handleLogout = async () => {
    await logout()
  }

  return (
    <LanguageProvider>
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* ============================================================ */}
      {/*  HEADER (hidden on auth pages)                                */}
      {/* ============================================================ */}
      {!isAuthPage && <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md dark:bg-gray-950/80 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/home" className="flex items-center gap-2.5 shrink-0">
              <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
                <GraduationCap className="h-6 w-6 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-xl text-sky-600 dark:text-sky-400">VMG</span>
                <span className="hidden sm:inline text-sm text-muted-foreground font-medium">{t('layout.brand', 'Việt Mỹ Global')}</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/home' && pathname.startsWith(link.href))
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30'
                        : 'text-gray-600 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    {t(link.labelKey, '')}
                  </Link>
                )
              })}
            </nav>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-2">
              <LocaleToggle />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                aria-label={t('layout.toggleTheme', 'Chuyển đổi giao diện')}
              >
                {mounted && resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {mounted && !isHydrating && isAuthenticated && authUser ? (
                <>
                  <Link href="/">
                    <Button variant="outline" size="sm" className="rounded-lg">
                      <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
                      {t('layout.nav.dashboard', 'Hệ thống')}
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-lg text-muted-foreground"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-3.5 w-3.5 mr-1" />
                    {t('auth.logout', 'Đăng xuất')}
                  </Button>
                  <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
                    {authUser.nickname || getUserDisplayName(authUser)}
                  </span>
                </>
              ) : mounted && !isHydrating ? (
                <>
                  <Link href="/login">
                    <Button variant="outline" size="sm" className="rounded-lg">
                      {t('auth.login', 'Đăng nhập')}
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm" className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white">
                      {t('layout.nav.register', 'Đăng ký tư vấn')}
                    </Button>
                  </Link>
                </>
              ) : null}
            </div>

            {/* Mobile actions */}
            <div className="flex md:hidden items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                aria-label={t('layout.toggleTheme', 'Chuyển đổi giao diện')}
              >
                {mounted && resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-75 p-0">
                  <SheetTitle className="sr-only">{t('layout.nav.menu', 'Menu điều hướng')}</SheetTitle>
                  <MobileNavContent close={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>}

      {/* ============================================================ */}
      {/*  MAIN CONTENT                                                 */}
      {/* ============================================================ */}
      <main className={`flex-1 ${isAuthPage ? '' : 'pt-16'}`}>
        {children}
      </main>

      {/* ============================================================ */}
      {/*  FOOTER (hidden on auth pages)                                */}
      {/* ============================================================ */}
      {!isAuthPage && <footer className="bg-gray-900 text-gray-300">
        {/* Main footer */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {/* Column 1: Thong tin */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-600/20 rounded-xl">
                  <GraduationCap className="h-6 w-6 text-sky-400" />
                </div>
                <div>
                  <span className="font-bold text-xl text-white">VMG</span>
                  <p className="text-xs text-sky-400">{t('layout.brand', 'Việt Mỹ Global')}</p>
                </div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                {t('layout.footer.description', 'Trung tâm Anh ngữ Việt Mỹ Global - Đào tạo tiếng Anh chất lượng cao với phương pháp hiện đại và đội ngũ giáo viên bản ngữ.')}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
                  <span>{t('layout.footer.address', '123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-sky-400 shrink-0" />
                  <span>(028) 1234 5678</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-sky-400 shrink-0" />
                  <span>info@vmg.edu.vn</span>
                </div>
              </div>
            </div>

            {/* Column 2: Khoa hoc */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-base">{t('layout.footer.courses', 'Khóa học')}</h3>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/courses" className="text-gray-400 hover:text-sky-400 transition-colors">{t('layout.footer.course1', 'Tiếng Anh giao tiếp')}</Link></li>
                <li><Link href="/courses" className="text-gray-400 hover:text-sky-400 transition-colors">{t('layout.footer.course2', 'IELTS / TOEFL')}</Link></li>
                <li><Link href="/courses" className="text-gray-400 hover:text-sky-400 transition-colors">{t('layout.footer.course3', 'Tiếng Anh trẻ em')}</Link></li>
                <li><Link href="/courses" className="text-gray-400 hover:text-sky-400 transition-colors">{t('layout.footer.course4', 'Tiếng Anh thiếu niên')}</Link></li>
                <li><Link href="/courses" className="text-gray-400 hover:text-sky-400 transition-colors">{t('layout.footer.course5', 'Luyện thi chứng chỉ')}</Link></li>
              </ul>
            </div>

            {/* Column 3: Ho tro */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-base">{t('layout.footer.support', 'Hỗ trợ')}</h3>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/about" className="text-gray-400 hover:text-sky-400 transition-colors">{t('layout.nav.about', 'Giới thiệu')}</Link></li>
                <li><Link href="/contact" className="text-gray-400 hover:text-sky-400 transition-colors">{t('layout.nav.contact', 'Liên hệ')}</Link></li>
                <li><Link href="/news" className="text-gray-400 hover:text-sky-400 transition-colors">{t('layout.nav.news', 'Tin tức')}</Link></li>
                <li><Link href="/register" className="text-gray-400 hover:text-sky-400 transition-colors">{t('layout.footer.registerCourse', 'Đăng ký học')}</Link></li>
                <li><Link href="/login" className="text-gray-400 hover:text-sky-400 transition-colors">{t('layout.footer.studentPortal', 'Cổng thông tin học viên')}</Link></li>
              </ul>
            </div>

            {/* Column 4: Ket noi */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-base">{t('layout.footer.connect', 'Kết nối')}</h3>
              <p className="text-sm text-gray-400">{t('layout.footer.followUs', 'Theo dõi chúng tôi trên mạng xã hội để cập nhật tin tức và chương trình ưu đãi.')}</p>
              <div className="flex items-center gap-3">
                <a href="#" className="p-2.5 bg-gray-800 rounded-lg hover:bg-sky-600 transition-colors" aria-label="Facebook">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="#" className="p-2.5 bg-gray-800 rounded-lg hover:bg-sky-600 transition-colors" aria-label="Instagram">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="#" className="p-2.5 bg-gray-800 rounded-lg hover:bg-sky-600 transition-colors" aria-label="Youtube">
                  <Youtube className="h-5 w-5" />
                </a>
              </div>
              <div className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="h-4 w-4 text-sky-400 shrink-0" />
                  <span>{t('layout.footer.openingHours', 'Giờ mở cửa')}: {t('layout.footer.openingDays', 'T2 - CN')}</span>
                </div>
                <div className="text-sm text-gray-400 ml-6">{t('layout.footer.openingHoursRange', '8:00 - 21:00')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
              <p>&copy; {new Date().getFullYear()} {t('layout.brand', 'Việt Mỹ Global')}. {t('layout.footer.copyright', 'Tất cả quyền được bảo lưu.')}.</p>
              <div className="flex items-center gap-4">
                <a href="#" className="hover:text-sky-400 transition-colors">{t('layout.footer.privacyPolicy', 'Chính sách bảo mật')}</a>
                <a href="#" className="hover:text-sky-400 transition-colors">{t('layout.footer.termsOfUse', 'Điều khoản sử dụng')}</a>
              </div>
            </div>
          </div>
        </div>
      </footer>}
    </div>
    </LanguageProvider>
  )
}
