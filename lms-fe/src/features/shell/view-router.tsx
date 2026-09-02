/**
 * View router — maps (role, view) to a lazily-loaded feature screen.
 *
 * All screens are dynamic imports so each route only loads its own chunk;
 * LoadingView renders while the chunk streams in.
 */

'use client'

import dynamic from 'next/dynamic'

function LoadingView() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 border-3 border-primary/25 border-t-primary rounded-full animate-spin" />
    </div>
  )
}

const load = (loader: () => Promise<{ default: React.ComponentType<any> }>) =>
  dynamic(loader, { loading: () => <LoadingView /> })

// Admin
const AdminDashboard = load(() => import('@/features/admin/dashboard'))
const AdminStudents = load(() => import('@/features/admin/students'))
const AdminCourses = load(() => import('@/features/admin/courses'))
const AdminClasses = load(() => import('@/features/admin/classes'))
const AdminSchedule = load(() => import('@/features/admin/schedule'))
const AdminTuition = load(() => import('@/features/admin/tuition'))
const AdminAttendance = load(() => import('@/features/admin/attendance'))
const AdminMaterials = load(() => import('@/features/admin/materials'))
const AdminTasks = load(() => import('@/features/admin/tasks'))
const AdminCRM = load(() => import('@/features/admin/crm'))
const AdminCMS = load(() => import('@/features/admin/cms'))
const AdminReports = load(() => import('@/features/admin/reports'))
const AdminSettings = load(() => import('@/features/admin/settings'))
const AdminHomework = load(() => import('@/features/admin/homework'))
const AdminReviews = load(() => import('@/features/admin/reviews'))

// Counselor
const CounselorDashboard = load(() => import('@/features/counselor/dashboard'))
const CounselorCRM = load(() => import('@/features/counselor/crm'))

// Teacher
const TeacherDashboard = load(() => import('@/features/teacher/dashboard'))
const TeacherSchedule = load(() => import('@/features/teacher/schedule'))
const TeacherAttendance = load(() => import('@/features/teacher/attendance'))

// Accountant
const AccountantDashboard = load(() => import('@/features/accountant/dashboard'))
const AccountantTuition = load(() => import('@/features/accountant/tuition'))

// Marketing
const MarketingDashboard = load(() => import('@/features/marketing/dashboard'))
const MarketingCMS = load(() => import('@/features/marketing/cms'))

// Parent
const ParentDashboard = load(() => import('@/features/parent/dashboard'))
const ParentSchedule = load(() => import('@/features/parent/schedule'))
const ParentReviews = load(() => import('@/features/parent/reviews'))
const ParentHomework = load(() => import('@/features/parent/homework'))
const ParentMedia = load(() => import('@/features/parent/media'))

// Student
const StudentDashboard = load(() => import('@/features/student/dashboard'))
const StudentSchedule = load(() => import('@/features/student/schedule'))
const StudentReviews = load(() => import('@/features/student/reviews'))
const StudentHomework = load(() => import('@/features/student/homework'))
const StudentAttendance = load(() => import('@/features/student/attendance'))

// Chat (shared across staff/parent/student roles)
const ChatView = load(() => import('@/features/chat/chat-view'))

// Account management (shared by every role)
const AccountView = load(() => import('@/features/account/account-view'))

function NotFoundView() {
  return <div className="p-6"><h2 className="text-xl font-bold">Trang không tồn tại</h2></div>
}

function ComingSoonView({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-muted-foreground">Chức năng đang phát triển</p>
    </div>
  )
}

/** Render the screen for a (role, view) pair. */
export function renderView(role: string, view: string) {
  switch (role) {
    case 'lms_admin':
    case 'lms_super_admin': {
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
        case 'account': return <AccountView />
        default: return <NotFoundView />
      }
    }
    case 'lms_counselor': {
      switch (view) {
        case 'dashboard': return <CounselorDashboard />
        case 'crm': return <CounselorCRM />
        case 'students': return <AdminStudents />
        case 'chat': return <ChatView />
        case 'account': return <AccountView />
        default: return <NotFoundView />
      }
    }
    case 'lms_teacher': {
      switch (view) {
        case 'dashboard': return <TeacherDashboard />
        case 'schedule': return <TeacherSchedule />
        case 'attendance': return <TeacherAttendance />
        case 'materials': return <AdminMaterials />
        case 'students-view': return <AdminStudents />
        case 'homework': return <AdminHomework />
        case 'reviews': return <AdminReviews />
        case 'chat': return <ChatView />
        case 'account': return <AccountView />
        default: return <NotFoundView />
      }
    }
    case 'lms_accountant': {
      switch (view) {
        case 'dashboard': return <AccountantDashboard />
        case 'tuition':
        case 'payments': return <AccountantTuition />
        case 'reports-finance': return <AdminReports />
        case 'chat': return <ChatView />
        case 'account': return <AccountView />
        default: return <NotFoundView />
      }
    }
    case 'lms_marketing': {
      switch (view) {
        case 'dashboard': return <MarketingDashboard />
        case 'cms': return <MarketingCMS />
        // Marketing only manages banners — the branch/employee sections
        // require permissions marketing lacks (banners-only mode skips
        // those queries).
        case 'banners': return <AdminSettings mode="banners" />
        case 'reports-marketing': return <AdminReports />
        case 'chat': return <ChatView />
        case 'account': return <AccountView />
        default: return <NotFoundView />
      }
    }
    case 'lms_parent': {
      switch (view) {
        case 'dashboard': return <ParentDashboard />
        case 'child-info': return <AdminStudents />
        case 'schedule': return <ParentSchedule />
        case 'attendance': return <TeacherAttendance />
        case 'tuition-view': return <AccountantTuition />
        case 'reviews': return <ParentReviews />
        case 'homework': return <ParentHomework />
        case 'media': return <ParentMedia />
        case 'notifications': return <ComingSoonView title="Thông báo" />
        case 'chat': return <ChatView />
        case 'account': return <AccountView />
        default: return <NotFoundView />
      }
    }
    case 'lms_student': {
      switch (view) {
        case 'dashboard': return <StudentDashboard />
        case 'schedule': return <StudentSchedule />
        case 'attendance': return <StudentAttendance />
        case 'materials': return <AdminMaterials />
        case 'homework':
        case 'submissions': return <StudentHomework />
        case 'reviews': return <StudentReviews />
        case 'chat': return <ChatView />
        case 'account': return <AccountView />
        default: return <NotFoundView />
      }
    }
    default:
      return <NotFoundView />
  }
}
