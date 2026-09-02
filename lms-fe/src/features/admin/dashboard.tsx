'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format, isToday, parseISO } from 'date-fns'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, CalendarDays,
  Clock, DollarSign, TrendingUp, UserPlus, Plus, School, Contact,
  ArrowRight, Zap, CreditCard, Target,
} from 'lucide-react'
import { formatVND, getDashboard, getSessions, getReport, getTuitions } from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/data-table'
import { createSessionColumns } from './dashboard-columns'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/components/shared/animations'
import { useTranslation } from '@/lib/i18n'

const QUICK_ACTIONS = [
  { id: 'students', label: 'students.addStudent', icon: UserPlus, color: 'bg-sky-50 dark:bg-sky-950/30 text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-950/50' },
  { id: 'courses', label: 'courses.addCourse', icon: Plus, color: 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-950/50' },
  { id: 'classes', label: 'classes.createClass', icon: School, color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-950/50' },
  { id: 'crm', label: 'crm.manage', icon: Contact, color: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50' },
]

export default function AdminDashboard() {
  const { t } = useTranslation()

  const currentMonth = format(new Date(), 'yyyy-MM')

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'lms_admin'],
    queryFn: () => getDashboard('lms_admin'),
  })

  // Stats the backend dashboard doesn't compute are aggregated from the
  // report + tuition endpoints (both permitted for lms_admin).
  const revenueReportQuery = useQuery({
    queryKey: ['dashboard', 'lms_admin', 'report-revenue'],
    queryFn: () => getReport('revenue'),
  })
  const attendanceReportQuery = useQuery({
    queryKey: ['dashboard', 'lms_admin', 'report-attendance'],
    queryFn: () => getReport('attendance'),
  })
  const tuitionsQuery = useQuery({
    queryKey: ['dashboard', 'lms_admin', 'tuitions'],
    queryFn: () => getTuitions({ limit: 1000 }),
  })

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'admin-recent', currentMonth],
    // The sessions table has no `month` column, so we fetch all and filter
    // by current month client-side.
    queryFn: () => getSessions(),
  })

  const sessionColumns = useMemo(() => createSessionColumns(t), [t])

  if (dashboardQuery.isLoading || sessionsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (dashboardQuery.isError || sessionsQuery.isError) {
    return <ErrorState onRetry={() => { dashboardQuery.refetch(); sessionsQuery.refetch() }} />
  }

  const dashboard = dashboardQuery.data || {}
  const stats = dashboard
  // Derived stats (real data from permitted endpoints).
  const revenue = Number((revenueReportQuery.data as any)?.totalRevenue ?? 0)
  const totalDebt = (tuitionsQuery.data || []).reduce(
    (sum: number, tu: any) => sum + Number(tu.remainingAmount ?? 0), 0,
  )
  const present = Number((attendanceReportQuery.data as any)?.present ?? 0)
  const absent = Number((attendanceReportQuery.data as any)?.absent ?? 0)
  const attendanceRate = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0
  const sessions = (sessionsQuery.data || []).filter((s: any) => (s.date || '').startsWith(currentMonth))

  const todaySessions = sessions
    .filter((s: any) => isToday(parseISO(s.date)))
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))

  const recentSessions = sessions
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
    .slice(0, 8)

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <PageHeader
        title={t('dashboard.title', 'Bảng điều khiển')}
        description={t('dashboard.description', 'Tổng quan hệ thống quản lý trung tâm')}
        icon={LayoutDashboard}
        accentColor="sky"
      />

      {/* Stats Grid */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('dashboard.totalStudents', 'Tổng học viên')}
            value={stats.totalStudents ?? 0}
            icon={GraduationCap}
            iconColor="text-sky-600 dark:text-sky-400"
            iconBg="bg-sky-50 dark:bg-sky-950/30"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('dashboard.newLeadsThisMonth', 'Leads mới tháng')}
            value={stats.totalNewLeadsThisMonth ?? 0}
            icon={Target}
            iconColor="text-blue-600 dark:text-blue-400"
            iconBg="bg-blue-50 dark:bg-blue-950/30"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('dashboard.totalClasses', 'Tổng lớp học')}
            value={stats.totalClasses ?? 0}
            icon={CalendarDays}
            iconColor="text-amber-600 dark:text-amber-400"
            iconBg="bg-amber-50 dark:bg-amber-950/30"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('dashboard.totalLeads', 'Tổng Leads')}
            value={stats.totalLeads ?? 0}
            icon={Users}
            iconColor="text-violet-600 dark:text-violet-400"
            iconBg="bg-violet-50 dark:bg-violet-950/30"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('dashboard.totalRevenue', 'Tổng doanh thu')}
            value={formatVND(revenue)}
            icon={DollarSign}
            iconColor="text-sky-600 dark:text-sky-400"
            iconBg="bg-sky-50 dark:bg-sky-950/30"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('dashboard.totalDebt', 'Tổng công nợ')}
            value={formatVND(totalDebt)}
            icon={CreditCard}
            iconColor="text-rose-600 dark:text-rose-400"
            iconBg="bg-rose-50 dark:bg-rose-950/30"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('dashboard.attendanceRate', 'Tỷ lệ điểm danh')}
            value={`${attendanceRate}%`}
            icon={TrendingUp}
            iconColor="text-teal-600 dark:text-teal-400"
            iconBg="bg-teal-50 dark:bg-teal-950/30"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('dashboard.totalCourses', 'Tổng khóa học')}
            value={stats.totalCourses ?? 0}
            icon={BookOpen}
            iconColor="text-cyan-600 dark:text-cyan-400"
            iconBg="bg-cyan-50 dark:bg-cyan-950/30"
          />
        </motion.div>
      </motion.div>

      {/* Quick Actions */}
      <Card className="rounded-2xl border">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            {t('dashboard.quickActions', 'Thao tác nhanh')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {QUICK_ACTIONS.map((action, i) => {
              const Icon = action.icon
              return (
                <motion.a
                  key={action.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
                  href={`#admin/${action.id}`}
                  className="shrink-0 flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border/60 hover:border-sky-200/60 dark:hover:border-sky-800/40 transition-all duration-200 group min-w-40 cursor-pointer no-underline"
                >
                  <div className={cn('p-2.5 rounded-xl transition-all duration-200 group-hover:scale-110', action.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-nowrap">{t(action.label)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </motion.a>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Sessions */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-600" />
              {t('dashboard.todaySessions', 'Buổi học hôm nay')}
              {todaySessions.length > 0 && (
                <Badge className="rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 text-xs px-2.5">
                  {todaySessions.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {todaySessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted p-4 mb-3">
                  <CalendarDays className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{t('dashboard.noSessionsToday', 'Không có buổi học hôm nay.')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySessions.map((session: any, idx: number) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.25 }}
                    className="flex items-center gap-4 p-4 rounded-xl border-l-4 border-l-sky-500 bg-sky-50/40 dark:bg-sky-950/10"
                  >
                    <div className="min-w-22.5">
                      <p className="text-sm font-mono font-bold text-sky-700 dark:text-sky-400">
                        {session.startTime}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">{session.endTime}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{session.title}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <span className="truncate">{session.class?.name}</span>
                        <span>&middot;</span>
                        <span className="truncate">{session.teacher?.name}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity placeholder */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-600" />
              {t('dashboard.recentActivity', 'Hoạt động gần đây')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {recentSessions.length === 0 ? (
              <EmptyState
                icon={Clock}
                title={t('dashboard.noActivity', 'Chưa có hoạt động')}
                description={t('dashboard.noActivityDesc', 'Hệ thống sẽ hiển thị hoạt động gần đây tại đây.')}
              />
            ) : (
              <div className="space-y-2">
                {recentSessions.slice(0, 5).map((session: any, i: number) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 rounded-lg shrink-0 bg-sky-50 dark:bg-sky-950/30 text-sky-600">
                      <CalendarDays className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{session.title}</p>
                      <p className="text-xs text-muted-foreground">{session.class?.name} &middot; {session.teacher?.name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 font-mono">
                      {format(parseISO(session.date), 'dd/MM')}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions Table */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-base font-semibold">{t('dashboard.recentSessions', 'Buổi học gần đây')}</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {recentSessions.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={t('dashboard.noSessions', 'Chưa có buổi học')}
              description={t('dashboard.noSessionsDesc', 'Tạo buổi học đầu tiên để bắt đầu.')}
            />
          ) : (
            <DataTable
              columns={sessionColumns}
              data={recentSessions}
              paginationMode="client"
              initialPageSize={10}
              searchColumnId="title"
              searchPlaceholder={t('dashboard.searchSessions', 'Tìm buổi học...')}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
