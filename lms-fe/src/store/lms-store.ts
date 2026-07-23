import { create } from 'zustand'
import { getMe, logout as apiLogout } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import type { UserRole } from '@/lib/schemas'
import type { ApiUser } from '@/lib/schemas'

// ─── Role helpers ─────────────────────────────────────────────────

/** Priority order: super admin wins over admin, admin wins over teacher, etc. */
const ROLE_PRIORITY: UserRole[] = [
  'lms_super_admin', 'lms_admin', 'lms_counselor', 'lms_teacher',
  'lms_accountant', 'lms_marketing', 'lms_parent', 'lms_student',
]

const ALL_LMS_ROLES = new Set<UserRole>(ROLE_PRIORITY)

/**
 * Parse the space-separated `roles` string from model.User.Roles
 * and extract the primary LMS role (highest priority).
 * Example: "system_admin system_user lms_admin" → "lms_admin"
 * Fallback: if user has system_admin but no LMS role, treat as lms_super_admin
 */
function parsePrimaryRole(rolesStr: string): UserRole | null {
  const allRoles = rolesStr.split(/\s+/).filter(Boolean)
  for (const target of ROLE_PRIORITY) {
    if (allRoles.includes(target)) return target
  }
  // Fallback: system_admin without an explicit LMS role defaults to lms_super_admin
  if (allRoles.includes('system_admin')) return 'lms_super_admin'
  return null
}

/**
 * Extract all LMS roles from the space-separated roles string, in priority order.
 * Example: "system_admin system_user lms_teacher lms_admin" → ["lms_admin", "lms_teacher"]
 */
export function parseAllLMSRoles(rolesStr: string): UserRole[] {
  const allRoles = rolesStr.split(/\s+/).filter(Boolean)
  return ROLE_PRIORITY.filter((r) => allRoles.includes(r))
}

type AdminView =
  | 'dashboard'
  | 'students'
  | 'courses'
  | 'classes'
  | 'schedule'
  | 'tuition'
  | 'attendance'
  | 'materials'
  | 'tasks'
  | 'crm'
  | 'cms'
  | 'banners'
  | 'reports'
  | 'settings'
  | 'homework'
  | 'reviews'

type CounselorView = 'dashboard' | 'crm' | 'students'
type TeacherView = 'dashboard' | 'schedule' | 'attendance' | 'materials' | 'submissions' | 'students-view' | 'homework' | 'reviews'
type AccountantView = 'dashboard' | 'tuition' | 'payments' | 'reports-finance'
type MarketingView = 'dashboard' | 'cms' | 'banners' | 'reports-marketing'
type ParentView = 'dashboard' | 'child-info' | 'schedule' | 'attendance' | 'tuition-view' | 'notifications' | 'reviews' | 'homework' | 'media'
type StudentView = 'dashboard' | 'schedule' | 'attendance' | 'materials' | 'submissions' | 'homework' | 'reviews'

export type ActiveView =
  | AdminView
  | CounselorView
  | TeacherView
  | AccountantView
  | MarketingView
  | ParentView
  | StudentView

interface LMSState {
  isAuthenticated: boolean
  authUser: ApiUser | null
  currentRole: UserRole | null
  activeView: ActiveView | null
  selectedDate: string
  sidebarOpen: boolean
  selectedItemId: string | null
  showDetail: boolean
  isHydrating: boolean

  login: (user: ApiUser) => void
  logout: () => Promise<void>
  hydrate: () => Promise<boolean>
  setCurrentRole: (role: UserRole) => void
  setActiveView: (view: ActiveView) => void
  setSelectedDate: (date: string) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSelectedItemId: (id: string | null) => void
  setShowDetail: (show: boolean) => void
}

const ROLE_VIEWS: Record<UserRole, ActiveView> = {
  lms_super_admin: 'dashboard',
  lms_admin: 'dashboard',
  lms_counselor: 'dashboard',
  lms_teacher: 'dashboard',
  lms_accountant: 'dashboard',
  lms_marketing: 'dashboard',
  lms_parent: 'dashboard',
  lms_student: 'dashboard',
}

const ROLE_COLORS: Record<UserRole, { color: string; bgColor: string; avatarBg: string; label: string }> = {
  lms_super_admin: { color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950/30', avatarBg: 'bg-red-500', label: 'Super Admin' },
  lms_admin: { color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-50 dark:bg-sky-950/30', avatarBg: 'bg-sky-500', label: 'Quản lý' },
  lms_counselor: { color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-50 dark:bg-violet-950/30', avatarBg: 'bg-violet-500', label: 'Tư vấn' },
  lms_teacher: { color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-50 dark:bg-sky-950/30', avatarBg: 'bg-sky-500', label: 'Giáo viên' },
  lms_accountant: { color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30', avatarBg: 'bg-blue-500', label: 'Kế toán' },
  lms_marketing: { color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-50 dark:bg-rose-950/30', avatarBg: 'bg-rose-500', label: 'Marketing' },
  lms_parent: { color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950/30', avatarBg: 'bg-amber-500', label: 'Phụ huynh' },
  lms_student: { color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-50 dark:bg-sky-950/30', avatarBg: 'bg-sky-500', label: 'Học viên' },
}

export { ROLE_COLORS }

// Only persist UI state to localStorage (NOT auth state)
interface UIPersistState {
  sidebarOpen: boolean
  selectedDate: string
}

function loadUIState(): UIPersistState {
  if (typeof window === 'undefined') {
    return { sidebarOpen: false, selectedDate: new Date().toISOString().split('T')[0] }
  }
  try {
    const stored = localStorage.getItem('vmg-ui')
    if (stored) return JSON.parse(stored)
  } catch {}
  return { sidebarOpen: false, selectedDate: new Date().toISOString().split('T')[0] }
}

export const useLMSStore = create<LMSState>((set) => ({
  isAuthenticated: false,
  authUser: null,
  currentRole: null,
  activeView: null,
  selectedDate: loadUIState().selectedDate,
  sidebarOpen: loadUIState().sidebarOpen,
  selectedItemId: null,
  showDetail: false,
  isHydrating: true,

  login: (user) => {
    const role = parsePrimaryRole(user.roles)
    const state = {
      isAuthenticated: true,
      authUser: user,
      currentRole: role,
      activeView: role ? ROLE_VIEWS[role] : 'dashboard',
      sidebarOpen: false,
      selectedItemId: null,
      showDetail: false,
      isHydrating: false,
    }
    set(state)
    // Persist auth to sessionStorage so it survives hard navigation (e.g. router.push across layouts)
    try { sessionStorage.setItem('vmg-auth', JSON.stringify({ user, ts: Date.now() })) } catch {}
  },

  logout: async () => {
    // Clear server-side session cookies
    try {
      await apiLogout()
    } catch {
      // Ignore errors — still clear local state
    }
    queryClient.clear()
    set({
      isAuthenticated: false,
      authUser: null,
      currentRole: null,
      activeView: null,
      sidebarOpen: false,
      selectedItemId: null,
      showDetail: false,
      isHydrating: false,
    })
    try { sessionStorage.removeItem('vmg-auth') } catch {}
  },

  hydrate: async () => {
    set({ isHydrating: true })
    // First check sessionStorage for a fresh login (survives hard navigation)
    try {
      const stored = sessionStorage.getItem('vmg-auth')
      if (stored) {
        const { user, ts } = JSON.parse(stored)
        // Use cached auth if less than 5 minutes old
        if (user && ts && (Date.now() - ts) < 5 * 60 * 1000) {
          const role = parsePrimaryRole(user.roles)
          set({
            isAuthenticated: true,
            authUser: user,
            currentRole: role,
            activeView: role ? ROLE_VIEWS[role] : 'dashboard',
            isHydrating: false,
          })
          return true
        }
        // Expired — remove it
        sessionStorage.removeItem('vmg-auth')
      }
    } catch { /* ignore */ }

    // Fall back to server-side session check
    try {
      const user = await queryClient.fetchQuery({ queryKey: ['me'], queryFn: getMe })
      const role = parsePrimaryRole(user.roles)
      set({
        isAuthenticated: true,
        authUser: user,
        currentRole: role,
        activeView: role ? ROLE_VIEWS[role] : 'dashboard',
        isHydrating: false,
      })
      return true
    } catch {
      set({
        isAuthenticated: false,
        authUser: null,
        currentRole: null,
        activeView: null,
        isHydrating: false,
      })
      return false
    }
  },

  setActiveView: (view) => set({ activeView: view, selectedItemId: null, showDetail: false }),
  setCurrentRole: (role) => set({
    currentRole: role,
    activeView: ROLE_VIEWS[role] || 'dashboard',
    selectedItemId: null,
    showDetail: false,
  }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSelectedItemId: (id) => set({ selectedItemId: id }),
  setShowDetail: (show) => set({ showDetail: show }),
}))

// Listen for auth expiry events dispatched by api.ts
if (typeof window !== 'undefined') {
  window.addEventListener('auth:expired', () => {
    useLMSStore.getState().logout()
  })
}

// Persist only UI state (sidebar, selectedDate) — NOT auth
if (typeof window !== 'undefined') {
  useLMSStore.subscribe((state) => {
    try {
      localStorage.setItem(
        'vmg-ui',
        JSON.stringify({
          sidebarOpen: state.sidebarOpen,
          selectedDate: state.selectedDate,
        })
      )
    } catch {}
  })
}
