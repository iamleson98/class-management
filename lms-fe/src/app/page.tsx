'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, School, CalendarDays,
  ClipboardCheck, ChevronLeft, ChevronDown, Menu, Sun, Moon, ChevronRight,
  BarChart3, Bell, LogOut, Phone, FileText, DollarSign, ListTodo, Image,
  Settings, CreditCard, Newspaper, MessageSquare
} from 'lucide-react'
import { useLMSStore, ROLE_COLORS, ActiveView, parseAllLMSRoles } from '@/store/lms-store'
import type { UserRole } from '@/lib/schemas'
import { LanguageProvider, useTranslation } from '@/lib/i18n'
import { LocaleToggle } from '@/components/lms/locale-toggle'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getInitials } from '@/components/lms/shared/avatar'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'

// Lazy load view components to reduce initial bundle
const AdminDashboard = dynamic(() => import('@/components/lms/admin/dashboard').then(m => m.default), { loading: () => <LoadingView /> })
const AdminStudents = dynamic(() => import('@/components/lms/admin/students').then(m => m.default), { loading: () => <LoadingView /> })
const AdminCourses = dynamic(() => import('@/components/lms/admin/courses').then(m => m.default), { loading: () => <LoadingView /> })
const AdminClasses = dynamic(() => import('@/components/lms/admin/classes').then(m => m.default), { loading: () => <LoadingView /> })
const AdminSchedule = dynamic(() => import('@/components/lms/admin/schedule').then(m => m.default), { loading: () => <LoadingView /> })
const AdminTuition = dynamic(() => import('@/components/lms/admin/tuition').then(m => m.default), { loading: () => <LoadingView /> })
const AdminAttendance = dynamic(() => import('@/components/lms/admin/attendance').then(m => m.default), { loading: () => <LoadingView /> })
const AdminMaterials = dynamic(() => import('@/components/lms/admin/materials').then(m => m.default), { loading: () => <LoadingView /> })
const AdminTasks = dynamic(() => import('@/components/lms/admin/tasks').then(m => m.default), { loading: () => <LoadingView /> })
const AdminCRM = dynamic(() => import('@/components/lms/admin/crm').then(m => m.default), { loading: () => <LoadingView /> })
const AdminCMS = dynamic(() => import('@/components/lms/admin/cms').then(m => m.default), { loading: () => <LoadingView /> })
const AdminReports = dynamic(() => import('@/components/lms/admin/reports').then(m => m.default), { loading: () => <LoadingView /> })
const AdminSettings = dynamic(() => import('@/components/lms/admin/settings').then(m => m.default), { loading: () => <LoadingView /> })
const AdminHomework = dynamic(() => import('@/components/lms/admin/homework').then(m => m.default), { loading: () => <LoadingView /> })
const AdminReviews = dynamic(() => import('@/components/lms/admin/reviews').then(m => m.default), { loading: () => <LoadingView /> })

const CounselorDashboard = dynamic(() => import('@/components/lms/counselor/dashboard').then(m => m.default), { loading: () => <LoadingView /> })
const CounselorCRM = dynamic(() => import('@/components/lms/counselor/crm').then(m => m.default), { loading: () => <LoadingView /> })

const TeacherDashboard = dynamic(() => import('@/components/lms/teacher/dashboard').then(m => m.default), { loading: () => <LoadingView /> })
const TeacherSchedule = dynamic(() => import('@/components/lms/teacher/schedule').then(m => m.default), { loading: () => <LoadingView /> })
const TeacherAttendance = dynamic(() => import('@/components/lms/teacher/attendance').then(m => m.default), { loading: () => <LoadingView /> })

const AccountantDashboard = dynamic(() => import('@/components/lms/accountant/dashboard').then(m => m.default), { loading: () => <LoadingView /> })
const AccountantTuition = dynamic(() => import('@/components/lms/accountant/tuition').then(m => m.default), { loading: () => <LoadingView /> })

const MarketingDashboard = dynamic(() => import('@/components/lms/marketing/dashboard').then(m => m.default), { loading: () => <LoadingView /> })
const MarketingCMS = dynamic(() => import('@/components/lms/marketing/cms').then(m => m.default), { loading: () => <LoadingView /> })

const ParentDashboard = dynamic(() => import('@/components/lms/parent/dashboard').then(m => m.default), { loading: () => <LoadingView /> })
const ParentSchedule = dynamic(() => import('@/components/lms/parent/schedule').then(m => m.default), { loading: () => <LoadingView /> })
const ParentReviews = dynamic(() => import('@/components/lms/parent/reviews').then(m => m.default), { loading: () => <LoadingView /> })
const ParentHomework = dynamic(() => import('@/components/lms/parent/homework').then(m => m.default), { loading: () => <LoadingView /> })
const ParentMedia = dynamic(() => import('@/components/lms/parent/media').then(m => m.default), { loading: () => <LoadingView /> })

const StudentDashboard = dynamic(() => import('@/components/lms/student/dashboard').then(m => m.default), { loading: () => <LoadingView /> })
const StudentSchedule = dynamic(() => import('@/components/lms/student/schedule').then(m => m.default), { loading: () => <LoadingView /> })
const StudentReviews = dynamic(() => import('@/components/lms/student/reviews').then(m => m.default), { loading: () => <LoadingView /> })
const StudentHomework = dynamic(() => import('@/components/lms/student/homework').then(m => m.default), { loading: () => <LoadingView /> })
const StudentAttendance = dynamic(() => import('@/components/lms/student/attendance').then(m => m.default), { loading: () => <LoadingView /> })

const ChatView = dynamic(() => import('@/components/lms/chat/chat-view').then(m => m.default), { loading: () => <LoadingView /> })

function LoadingView() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 border-3 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
    </div>
  )
}

// Navigation definition
interface NavItem {
  id: ActiveView
  labelKey: string
  labelDefault: string
  icon: React.ComponentType<{ className?: string }>
  sectionKey?: string
  sectionDefault?: string
}

const ADMIN_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.overview', sectionDefault: 'Tổng quan' },
  { id: 'students', labelKey: 'nav.students', labelDefault: 'Học viên', icon: Users, sectionKey: 'section.management', sectionDefault: 'Quản lý' },
  { id: 'courses', labelKey: 'nav.courses', labelDefault: 'Khóa học', icon: BookOpen },
  { id: 'classes', labelKey: 'nav.classes', labelDefault: 'Lớp học', icon: School },
  { id: 'schedule', labelKey: 'nav.schedule', labelDefault: 'Thời khóa biểu', icon: CalendarDays },
  { id: 'attendance', labelKey: 'nav.attendance', labelDefault: 'Điểm danh', icon: ClipboardCheck },
  { id: 'tuition', labelKey: 'nav.tuition', labelDefault: 'Học phí', icon: DollarSign, sectionKey: 'section.finance', sectionDefault: 'Tài chính' },
  { id: 'materials', labelKey: 'nav.materials', labelDefault: 'Học liệu', icon: FileText, sectionKey: 'section.resources', sectionDefault: 'Nguồn lực' },
  { id: 'crm', labelKey: 'nav.crm', labelDefault: 'CRM Tuyển sinh', icon: Phone, sectionKey: 'section.admissions', sectionDefault: 'Tuyển sinh' },
  { id: 'tasks', labelKey: 'nav.tasks', labelDefault: 'Công việc', icon: ListTodo },
  { id: 'homework', labelKey: 'nav.homework', labelDefault: 'Bài tập', icon: FileText },
  { id: 'reviews', labelKey: 'nav.reviews', labelDefault: 'Nhận xét', icon: ClipboardCheck },
  { id: 'cms', labelKey: 'nav.cms', labelDefault: 'Tin tức', icon: Newspaper, sectionKey: 'section.content', sectionDefault: 'Nội dung' },
  { id: 'reports', labelKey: 'nav.reports', labelDefault: 'Báo cáo', icon: BarChart3, sectionKey: 'section.system', sectionDefault: 'Hệ thống' },
  { id: 'settings', labelKey: 'nav.settings', labelDefault: 'Cấu hình', icon: Settings },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

const COUNSELOR_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.overview', sectionDefault: 'Tổng quan' },
  { id: 'crm', labelKey: 'nav.crm', labelDefault: 'CRM Tuyển sinh', icon: Phone, sectionKey: 'section.admissions', sectionDefault: 'Tuyển sinh' },
  { id: 'students', labelKey: 'nav.students', labelDefault: 'Học viên', icon: Users },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

const TEACHER_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.overview', sectionDefault: 'Tổng quan' },
  { id: 'schedule', labelKey: 'nav.schedule', labelDefault: 'Thời khóa biểu', icon: CalendarDays, sectionKey: 'section.teaching', sectionDefault: 'Giảng dạy' },
  { id: 'attendance', labelKey: 'nav.attendance', labelDefault: 'Điểm danh', icon: ClipboardCheck },
  { id: 'materials', labelKey: 'nav.materials', labelDefault: 'Học liệu', icon: FileText },
  { id: 'homework', labelKey: 'nav.homework', labelDefault: 'Bài tập', icon: ListTodo },
  { id: 'reviews', labelKey: 'nav.reviews', labelDefault: 'Nhận xét', icon: CreditCard },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

const ACCOUNTANT_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.overview', sectionDefault: 'Tổng quan' },
  { id: 'tuition', labelKey: 'nav.tuition', labelDefault: 'Học phí', icon: DollarSign, sectionKey: 'section.finance', sectionDefault: 'Tài chính' },
  { id: 'payments', labelKey: 'nav.payments', labelDefault: 'Thanh toán', icon: CreditCard },
  { id: 'reports-finance', labelKey: 'nav.reports', labelDefault: 'Báo cáo', icon: BarChart3 },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

const MARKETING_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.overview', sectionDefault: 'Tổng quan' },
  { id: 'cms', labelKey: 'nav.cms', labelDefault: 'Tin tức', icon: Newspaper, sectionKey: 'section.content', sectionDefault: 'Nội dung' },
  { id: 'banners', labelKey: 'nav.banners', labelDefault: 'Banner', icon: Image },
  { id: 'reports-marketing', labelKey: 'nav.reports', labelDefault: 'Báo cáo', icon: BarChart3 },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

const PARENT_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.info', sectionDefault: 'Thông tin' },
  { id: 'child-info', labelKey: 'nav.childInfo', labelDefault: 'Hồ sơ con', icon: Users },
  { id: 'schedule', labelKey: 'nav.schedule', labelDefault: 'Lịch học', icon: CalendarDays, sectionKey: 'section.monitoring', sectionDefault: 'Theo dõi' },
  { id: 'attendance', labelKey: 'nav.attendance', labelDefault: 'Điểm danh', icon: ClipboardCheck },
  { id: 'tuition-view', labelKey: 'nav.tuition', labelDefault: 'Học phí', icon: DollarSign },
  { id: 'reviews', labelKey: 'nav.reviews', labelDefault: 'Nhận xét', icon: CreditCard, sectionKey: 'section.learning', sectionDefault: 'Học tập' },
  { id: 'homework', labelKey: 'nav.homework', labelDefault: 'Bài tập', icon: ListTodo },
  { id: 'media', labelKey: 'nav.media', labelDefault: 'Hình ảnh/Video', icon: Image },
  { id: 'notifications', labelKey: 'nav.notifications', labelDefault: 'Thông báo', icon: Bell },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

const STUDENT_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.learning', sectionDefault: 'Học tập' },
  { id: 'schedule', labelKey: 'nav.schedule', labelDefault: 'Lịch học', icon: CalendarDays },
  { id: 'attendance', labelKey: 'nav.attendance', labelDefault: 'Điểm danh', icon: ClipboardCheck },
  { id: 'materials', labelKey: 'nav.materials', labelDefault: 'Học liệu', icon: FileText },
  { id: 'homework', labelKey: 'nav.homework', labelDefault: 'Bài tập', icon: ListTodo },
  { id: 'reviews', labelKey: 'nav.reviews', labelDefault: 'Nhận xét', icon: CreditCard },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

const NAV_MAP: Record<string, NavItem[]> = {
  lms_super_admin: ADMIN_NAV,
  lms_admin: ADMIN_NAV,
  lms_counselor: COUNSELOR_NAV,
  lms_teacher: TEACHER_NAV,
  lms_accountant: ACCOUNTANT_NAV,
  lms_marketing: MARKETING_NAV,
  lms_parent: PARENT_NAV,
  lms_student: STUDENT_NAV,
}

type SidebarContentProps = {
  navItems: NavItem[]
  activeView: ActiveView
  currentRole: string
  roleColor: { bgColor: string; color: string }
  theme?: string
  setTheme: (theme: string) => void
  logout: () => void
  setSidebarOpen: (open: boolean) => void
}

function SidebarContent({
  navItems,
  activeView,
  currentRole,
  roleColor,
  theme,
  setTheme,
  logout,
  setSidebarOpen,
}: SidebarContentProps) {
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

function renderView(role: string, view: ActiveView) {
  // Admin / Super Admin
  if (role === 'lms_admin' || role === 'lms_super_admin') {
    switch (view) {
      case 'dashboard': return <AdminDashboard />
      case 'students': return <AdminStudents />
      case 'courses': return <AdminCourses />
      case 'classes': return <AdminClasses />
      case 'schedule': return <AdminSchedule />
      case 'tuition': return <AdminTuition />
      case 'attendance': return <AdminAttendance />
      case 'materials': return <AdminMaterials />
      case 'tasks': return <AdminTasks />
      case 'crm': return <AdminCRM />
      case 'cms': return <AdminCMS />
      case 'reports': return <AdminReports />
      case 'settings': return <AdminSettings />
      case 'homework': return <AdminHomework />
      case 'reviews': return <AdminReviews />
      case 'chat': return <ChatView />
    }
  }
  // Counselor
  if (role === 'lms_counselor') {
    switch (view) {
      case 'dashboard': return <CounselorDashboard />
      case 'crm': return <CounselorCRM />
      case 'students': return <AdminStudents />
      case 'chat': return <ChatView />
    }
  }
  // Teacher
  if (role === 'lms_teacher') {
    switch (view) {
      case 'dashboard': return <TeacherDashboard />
      case 'schedule': return <TeacherSchedule />
      case 'attendance': return <TeacherAttendance />
      case 'materials': return <AdminMaterials />
      case 'students-view': return <AdminStudents />
      case 'homework': return <AdminHomework />
      case 'reviews': return <AdminReviews />
      case 'chat': return <ChatView />
    }
  }
  // Accountant
  if (role === 'lms_accountant') {
    switch (view) {
      case 'dashboard': return <AccountantDashboard />
      case 'tuition': return <AccountantTuition />
      case 'payments': return <AccountantTuition />
      case 'reports-finance': return <AdminReports />
      case 'chat': return <ChatView />
    }
  }
  // Marketing
  if (role === 'lms_marketing') {
    switch (view) {
      case 'dashboard': return <MarketingDashboard />
      case 'cms': return <MarketingCMS />
      case 'banners': return <AdminSettings />
      case 'reports-marketing': return <AdminReports />
      case 'chat': return <ChatView />
    }
  }
  // Parent
  if (role === 'lms_parent') {
    switch (view) {
      case 'dashboard': return <ParentDashboard />
      case 'child-info': return <AdminStudents />
      case 'schedule': return <ParentSchedule />
      case 'attendance': return <TeacherAttendance />
      case 'tuition-view': return <AccountantTuition />
      case 'reviews': return <ParentReviews />
      case 'homework': return <ParentHomework />
      case 'media': return <ParentMedia />
      case 'notifications': return <div className="p-6"><h2 className="text-xl font-bold">Thông báo</h2><p className="text-muted-foreground">Chức năng đang phát triển</p></div>
      case 'chat': return <ChatView />
    }
  }
  // Student
  if (role === 'lms_student') {
    switch (view) {
      case 'dashboard': return <StudentDashboard />
      case 'schedule': return <StudentSchedule />
      case 'attendance': return <StudentAttendance />
      case 'materials': return <AdminMaterials />
      case 'homework': return <StudentHomework />
      case 'reviews': return <StudentReviews />
      case 'submissions': return <StudentHomework />
      case 'chat': return <ChatView />
    }
  }
  return <div className="p-6"><h2 className="text-xl font-bold">Trang không tồn tại</h2></div>
}

function AppContent() {
  const { isAuthenticated, authUser, currentRole, activeView, sidebarOpen, isHydrating, setActiveView, setCurrentRole, logout, toggleSidebar, setSidebarOpen } = useLMSStore()

  // Parse all LMS roles the user has
  const allLMSRoles = authUser?.roles ? parseAllLMSRoles(authUser.roles) : []
  const hasMultipleRoles = allLMSRoles.length > 1
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const hydrateRef = useRef(false)

  useEffect(() => {
    if (!hydrateRef.current) {
      hydrateRef.current = true
      const state = useLMSStore.getState()
      if (!state.isAuthenticated || !state.authUser) {
        // No auth state — try hydrating from server cookie
        state.hydrate()
      }
    }
  }, [])

  // Central auth gate: whenever auth is resolved as invalid (either initial
  // hydration returned 401, or a later API call fired `auth:expired` → logout),
  // redirect to /login. This effect reacts to state changes, so it also covers
  // the "session dies mid-dashboard" case — not just the mount-time check.
  useEffect(() => {
    if (!isHydrating && (!isAuthenticated || !authUser || !currentRole)) {
      router.replace('/login')
    }
  }, [isHydrating, isAuthenticated, authUser, currentRole, router])

  // Hash-based routing sync
  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash && isAuthenticated && authUser) {
        const [role, view] = hash.split('/')
        if (role && view) {
          // If hash has a different valid LMS role, switch to it
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

  useEffect(() => {
    if (isAuthenticated && currentRole && activeView) {
      const newHash = `#${currentRole}/${activeView}`
      if (window.location.hash !== newHash) {
        window.location.hash = newHash
      }
    }
  }, [activeView, currentRole, isAuthenticated])

  // Show loading spinner while checking auth from server
  if (isHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{t('auth.checking')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !authUser || !currentRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
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
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-65 lg:flex-col lg:fixed lg:inset-y-0 border-r bg-card overflow-hidden">
        <SidebarContent
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
        <SheetContent side="left" className="w-70 p-0">
          <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
          <SidebarContent
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
        <header className="sticky top-0 z-40 h-14 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 flex items-center px-4 gap-3">
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
                {getInitials(authUser.nickname || `${authUser.firstname} ${authUser.lastname}`)}
              </div>
              <span className="hidden sm:block text-sm font-medium max-w-30 truncate">{authUser.nickname || `${authUser.firstname} ${authUser.lastname}`}</span>
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

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </QueryClientProvider>
  )
}
