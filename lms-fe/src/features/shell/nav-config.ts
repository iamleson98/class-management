/**
 * Navigation configuration for the dashboard shell.
 *
 * One nav list per LMS role; NAV_MAP keys match UserRole. Icons are lucide
 * components referenced by the sidebar renderer.
 */

import {
  LayoutDashboard, Users, GraduationCap, BookOpen, School, CalendarDays,
  ClipboardCheck, ChevronRight, Menu, Sun, Moon, BarChart3, Bell, LogOut,
  Phone, FileText, DollarSign, ListTodo, Image, Settings, CreditCard,
  Newspaper, MessageSquare,
} from 'lucide-react'
import type { ActiveView } from '@/store/lms-store'

export interface NavItem {
  id: ActiveView
  labelKey: string
  labelDefault: string
  icon: React.ComponentType<{ className?: string }>
  sectionKey?: string
  sectionDefault?: string
}

export const ADMIN_NAV: NavItem[] = [
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

export const COUNSELOR_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.overview', sectionDefault: 'Tổng quan' },
  { id: 'crm', labelKey: 'nav.crm', labelDefault: 'CRM Tuyển sinh', icon: Phone, sectionKey: 'section.admissions', sectionDefault: 'Tuyển sinh' },
  { id: 'students', labelKey: 'nav.students', labelDefault: 'Học viên', icon: Users },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

export const TEACHER_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.overview', sectionDefault: 'Tổng quan' },
  { id: 'schedule', labelKey: 'nav.schedule', labelDefault: 'Thời khóa biểu', icon: CalendarDays, sectionKey: 'section.teaching', sectionDefault: 'Giảng dạy' },
  { id: 'attendance', labelKey: 'nav.attendance', labelDefault: 'Điểm danh', icon: ClipboardCheck },
  { id: 'materials', labelKey: 'nav.materials', labelDefault: 'Học liệu', icon: FileText },
  { id: 'homework', labelKey: 'nav.homework', labelDefault: 'Bài tập', icon: ListTodo },
  { id: 'reviews', labelKey: 'nav.reviews', labelDefault: 'Nhận xét', icon: CreditCard },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

export const ACCOUNTANT_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.overview', sectionDefault: 'Tổng quan' },
  { id: 'tuition', labelKey: 'nav.tuition', labelDefault: 'Học phí', icon: DollarSign, sectionKey: 'section.finance', sectionDefault: 'Tài chính' },
  { id: 'payments', labelKey: 'nav.payments', labelDefault: 'Thanh toán', icon: CreditCard },
  { id: 'reports-finance', labelKey: 'nav.reports', labelDefault: 'Báo cáo', icon: BarChart3 },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

export const MARKETING_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.overview', sectionDefault: 'Tổng quan' },
  { id: 'cms', labelKey: 'nav.cms', labelDefault: 'Tin tức', icon: Newspaper, sectionKey: 'section.content', sectionDefault: 'Nội dung' },
  { id: 'banners', labelKey: 'nav.banners', labelDefault: 'Banner', icon: Image },
  { id: 'reports-marketing', labelKey: 'nav.reports', labelDefault: 'Báo cáo', icon: BarChart3 },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

export const PARENT_NAV: NavItem[] = [
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

export const STUDENT_NAV: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', labelDefault: 'Tổng quan', icon: LayoutDashboard, sectionKey: 'section.learning', sectionDefault: 'Học tập' },
  { id: 'schedule', labelKey: 'nav.schedule', labelDefault: 'Lịch học', icon: CalendarDays },
  { id: 'attendance', labelKey: 'nav.attendance', labelDefault: 'Điểm danh', icon: ClipboardCheck },
  { id: 'materials', labelKey: 'nav.materials', labelDefault: 'Học liệu', icon: FileText },
  { id: 'homework', labelKey: 'nav.homework', labelDefault: 'Bài tập', icon: ListTodo },
  { id: 'reviews', labelKey: 'nav.reviews', labelDefault: 'Nhận xét', icon: CreditCard },
  { id: 'chat', labelKey: 'nav.chat', labelDefault: 'Trò chuyện', icon: MessageSquare, sectionKey: 'section.communication', sectionDefault: 'Giao tiếp' },
]

export const NAV_MAP: Record<string, NavItem[]> = {
  lms_super_admin: ADMIN_NAV,
  lms_admin: ADMIN_NAV,
  lms_counselor: COUNSELOR_NAV,
  lms_teacher: TEACHER_NAV,
  lms_accountant: ACCOUNTANT_NAV,
  lms_marketing: MARKETING_NAV,
  lms_parent: PARENT_NAV,
  lms_student: STUDENT_NAV,
}

// Re-export the icons the header uses (kept here so shell files import once).
export { ChevronRight, Menu, Sun, Moon, LogOut, GraduationCap }
