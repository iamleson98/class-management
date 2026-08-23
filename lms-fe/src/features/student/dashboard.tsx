'use client'

import { useQuery } from '@tanstack/react-query'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  GraduationCap, CalendarDays, Clock, MapPin,
  BookOpen, TrendingUp, FileText
} from 'lucide-react'
import { format, parseISO, isToday, isFuture } from 'date-fns'
import { useLMSStore } from '@/store/lms-store'
import { getDashboard, getSessions, getMaterials, getClasses } from '@/lib/api'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useTranslation } from '@/lib/i18n'

const CLASS_COLORS = [
  'border-l-sky-500',
  'border-l-orange-400',
  'border-l-sky-400',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-violet-500',
]

function StudentDashboardInner() {
  const { authUser } = useLMSStore()
  const { t } = useTranslation()

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'lms_student', authUser?.id],
    queryFn: () => getDashboard('lms_student', authUser!.id),
  })

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'student', authUser?.id, 'dashboard'],
    queryFn: () => getSessions(),
    enabled: !!authUser?.id,
  })

  const materialsQuery = useQuery({
    queryKey: ['materials', 'student', authUser?.id],
    queryFn: () => getMaterials(),
    enabled: !!authUser?.id,
  })
  const classesQuery = useQuery({
    queryKey: ['classes', 'student-dashboard', authUser?.id],
    queryFn: () => getClasses(),
    enabled: !!authUser?.id,
  })

  if (dashboardQuery.isLoading || sessionsQuery.isLoading || materialsQuery.isLoading) return <LoadingState />

  if (dashboardQuery.isError) {
    return <ErrorState onRetry={() => dashboardQuery.refetch()} />
  }
  if (sessionsQuery.isError) {
    return <ErrorState onRetry={() => sessionsQuery.refetch()} />
  }
  if (materialsQuery.isError) {
    return <ErrorState onRetry={() => materialsQuery.refetch()} />
  }

  const dashboard = dashboardQuery.data
  const sessions = sessionsQuery.data || []
  const materials = materialsQuery.data || []
  const stats = dashboard || {}

  // Student info
  const studentName = authUser?.nickname || `${authUser?.first_name || ''} ${authUser?.last_name || ''}`.trim() || t('student.dashboard.defaultName', 'Hoc vien')
  const initials = studentName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  // The dashboard endpoint returns counters only — there is no enrollments
  // join exposed. Derive "my classes" from the student's stored
  // vmg_class_code prop (set on the student record) matched against the
  // class list; when absent, fall back to showing all visible sessions.
  const myClassCode = (() => {
    try {
      const raw = (authUser?.props as Record<string, unknown> | undefined)?.student
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return ((parsed as Record<string, unknown>)?.vmg_class_code as string) ?? ''
    } catch {
      return ''
    }
  })()
  const myClassesList = myClassCode
    ? (classesQuery.data || []).filter((c: any) => c.code === myClassCode)
    : []
  const classIds = new Set(myClassesList.map((c: any) => c.id))
  const myClasses = myClassesList.length

  // My sessions
  const mySessions = classIds.size > 0
    ? sessions.filter((s: any) => classIds.has(s.classId))
    : sessions

  // Upcoming count from the backend-computed dashboard stat.
  const attendanceRate = Number((dashboard as any)?.attendanceRate ?? 0)

  // Today and upcoming
  const todaySessions = mySessions
    .filter(s => isToday(parseISO(s.date)))
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))

  const upcomingSessions = mySessions
    .filter(s => isFuture(parseISO(s.date)) || isToday(parseISO(s.date)))
    .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 6)

  // Recent materials — filtered to my classes' courses when known.
  const courseIds = new Set(myClassesList.map((c: any) => c.courseId))
  const myMaterials = (courseIds.size > 0
    ? materials.filter((m: any) => courseIds.has(m.courseId))
    : materials
  ).slice(0, 4)

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <Card className="overflow-hidden rounded-xl">
        <div className="bg-linear-to-r from-sky-400 via-sky-500 to-orange-400 px-6 py-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-3 border-white/30">
              <AvatarFallback className="text-xl bg-white/20 text-white font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-white">
              <h1 className="text-2xl font-bold truncate">{t('student.dashboard.greeting', 'Xin chao')}, {studentName.split(' ').pop()}!</h1>
              <p className="text-sky-100 text-sm mt-0.5">{authUser?.email}</p>
            </div>
          </div>
        </div>
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-4 gap-3">
            <a href="#student/schedule" className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-muted/80 transition-colors text-center group cursor-pointer no-underline">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 group-hover:scale-110 transition-transform">
                <GraduationCap className="h-5 w-5 text-sky-600" />
              </div>
              <span className="text-xl font-bold">{myClasses}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('student.dashboard.classes', 'Lop hoc')}</span>
            </a>
            <a href="#student/schedule" className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-muted/80 transition-colors text-center group cursor-pointer no-underline">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 group-hover:scale-110 transition-transform">
                <CalendarDays className="h-5 w-5 text-sky-600" />
              </div>
              <span className="text-xl font-bold">{upcomingSessions.length}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('student.dashboard.upcoming', 'Sap toi')}</span>
            </a>
            <a href="#student/attendance" className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-muted/80 transition-colors text-center group cursor-pointer no-underline">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-5 w-5 text-sky-600" />
              </div>
              <span className="text-xl font-bold">{attendanceRate}%</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('student.dashboard.attendance', 'Diem danh')}</span>
            </a>
            <a href="#student/materials" className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-muted/80 transition-colors text-center group cursor-pointer no-underline">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-xl font-bold">{myMaterials.length}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('student.dashboard.materials', 'Tai lieu')}</span>
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-600" />
              {t('student.dashboard.todaySchedule', 'Lich hom nay')}
              {todaySessions.length > 0 && (
                <Badge className="rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 text-xs">
                  {todaySessions.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaySessions.length === 0 ? (
              <div className="text-center py-10">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted p-3 mb-3">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{t('student.dashboard.noSessionsToday', 'Hom nay khong co buoi hoc.')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('student.dashboard.enjoyDayOff', 'Tan huong ngay nghi!')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySessions.map((session: any, i: number) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-4 p-4 rounded-xl border-l-4 border-l-sky-500 bg-sky-50/40 dark:bg-sky-950/10 hover:bg-sky-50/70 dark:hover:bg-sky-950/20 transition-all"
                  >
                    <div className="min-w-22.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t('common.time', 'Thoi gian')}</p>
                      <p className="text-sm font-mono font-bold text-sky-700 dark:text-sky-400">{session.startTime}</p>
                      <p className="text-xs font-mono text-muted-foreground">{session.endTime}</p>
                    </div>
                    <div className="h-10 w-px bg-border" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{session.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {session.class?.name} &middot; {session.teacher?.name}
                      </p>
                    </div>
                    {session.location && (
                      <Badge variant="secondary" className="rounded-full text-xs shrink-0">
                        <MapPin className="h-3 w-3 mr-1" />{session.location}
                      </Badge>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Materials */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-600" />
              {t('student.dashboard.recentMaterials', 'Tai lieu gan day')}
              {myMaterials.length > 0 && (
                <Badge variant="secondary" className="rounded-full text-xs bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400">
                  {myMaterials.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myMaterials.length === 0 ? (
              <div className="text-center py-10">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted p-3 mb-3">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{t('student.dashboard.noMaterials', 'Chua co tai lieu nao.')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('student.dashboard.materialsWillAppear', 'Tai lieu se hien thi o day.')}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {myMaterials.map((m: any) => (
                  <a
                    key={m.id}
                    href="#student/materials"
                    className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/30 transition-all cursor-pointer no-underline group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-sky-100 dark:bg-sky-950/30 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-sky-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate group-hover:text-sky-600 transition-colors">{m.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.course?.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {m.createdAt ? format(parseISO(m.createdAt), 'dd/MM/yyyy') : ''}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Sessions */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-sky-600" />
            {t('student.dashboard.upcomingSessions', 'Buoi hoc sap toi')}
            <Badge variant="secondary" className="rounded-full text-xs">{upcomingSessions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingSessions.length === 0 ? (
            <div className="text-center py-10">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted p-3 mb-3">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{t('student.dashboard.noUpcomingSessions', 'Khong co buoi hoc sap toi.')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingSessions.map((s: any) => (
                <div key={s.id} className="flex items-center gap-4 p-4 rounded-xl border-l-4 border-l-sky-500 hover:bg-muted/30 transition-all">
                  <div className="min-w-14 rounded-lg bg-sky-50 dark:bg-sky-950/20 p-2 text-center shrink-0">
                    <p className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">{format(parseISO(s.date), 'MMM')}</p>
                    <p className="text-lg font-bold text-sky-700 dark:text-sky-300 leading-tight">{format(parseISO(s.date), 'd')}</p>
                    <p className="text-[10px] text-muted-foreground">{s.startTime}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="truncate">{s.class?.name}</span>
                      <span>&middot;</span>
                      <span className="truncate">{s.teacher?.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="hidden sm:flex rounded-full text-xs">
                      {s.class?.course?.name}
                    </Badge>
                    {s.location && (
                      <Badge variant="outline" className="hidden lg:flex rounded-full text-xs">
                        <MapPin className="h-3 w-3 mr-1" />{s.location}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Enrolled Classes */}
      {myClasses > 0 && (
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-sky-600" />
              {t('student.dashboard.myClasses', 'Lop cua toi')}
              <Badge variant="secondary" className="rounded-full text-xs">{myClasses}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myClassesList.map((cls: any, idx: number) => (
                <div
                  key={cls.id || idx}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-xl border-l-4 border hover:transition-all group',
                    CLASS_COLORS[idx % CLASS_COLORS.length],
                  )}
                >
                  <div className="p-2.5 rounded-xl bg-muted/50 group-hover:bg-muted transition-colors">
                    <BookOpen className="h-5 w-5 text-sky-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{cls.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cls.code}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function StudentDashboard() {
  return <StudentDashboardInner />
}
