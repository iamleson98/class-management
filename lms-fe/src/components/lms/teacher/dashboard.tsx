'use client'

import { useQuery } from '@tanstack/react-query'
import { GraduationCap, CalendarDays, Users, ClipboardCheck, BookOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/lms/page-header'
import { StatCard } from '@/components/lms/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/lms/error-state'
import { LoadingState } from '@/components/lms/loading-state'
import { useLMSStore } from '@/store/lms-store'
import { getDashboard, getSessions, getClasses } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'


export default function TeacherDashboard() {
  const { t } = useTranslation()
  const { authUser } = useLMSStore()
  const statsQuery = useQuery({
    queryKey: ['dashboard', authUser?.id],
    queryFn: () => getDashboard('lms_teacher', authUser!.id),
  })
  const sessionsQuery = useQuery({ queryKey: ['sessions'], queryFn: () => getSessions() })
  const classesQuery = useQuery({
    queryKey: ['classes'], queryFn: () => getClasses({
      where_ands: [{
        column: 'classes.teacher_id',
        operator: '=',
        value: authUser?.id
      }]
    })
  })

  if (statsQuery.isLoading || sessionsQuery.isLoading || classesQuery.isLoading) {
    return <LoadingState />
  }
  if (statsQuery.isError) {
    return <ErrorState onRetry={() => statsQuery.refetch()} />
  }

  const data = statsQuery.data || {}

  const mySessions = (sessionsQuery.data || [])
    .filter((s: any) => s.teacherId === authUser?.id && s.date >= new Date().toISOString().slice(0, 10))
    .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
  const myClasses = (classesQuery.data || []).filter((c: any) => c.teacherId === authUser?.id)

  const getClassName = (classId: string) => (classesQuery.data || []).find((c: any) => c.id === classId)?.name || ''

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader title={t('teacher.dashboard.title', 'Tổng quan')} description={t('teacher.dashboard.greeting', 'Xin chào, {name}', { name: authUser?.nickname || `${authUser?.first_name || ''} ${authUser?.last_name || ''}`.trim() })} icon={GraduationCap} accentColor="sky" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t('teacher.dashboard.myClasses', 'Lớp phụ trách')} value={data.totalClasses ?? 0} icon={GraduationCap} iconColor="text-sky-600" iconBg="bg-sky-100 dark:bg-sky-950/40" />
        {/* <StatCard title={t('teacher.dashboard.todaySessions', 'Buổi hôm nay')} value={data.todaySessions ?? 0} icon={CalendarDays} iconColor="text-blue-600" iconBg="bg-blue-100 dark:bg-blue-950/40" /> */}
        {/* <StatCard title={t('teacher.dashboard.totalStudents', 'Tổng học viên')} value={data.totalStudents ?? 0} icon={Users} iconColor="text-violet-600" iconBg="bg-violet-100 dark:bg-violet-950/40" /> */}
        {/* <StatCard title={t('teacher.dashboard.attendanceRate', 'Tỷ lệ chuyên cần')} value={`${data.attendanceRate ?? 0}%`} icon={ClipboardCheck} iconColor="text-amber-600" iconBg="bg-amber-100 dark:bg-amber-950/40" /> */}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('teacher.dashboard.upcomingSessions', 'Buổi học sắp tới')}</CardTitle>
          </CardHeader>
          <CardContent>
            {mySessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('teacher.dashboard.noUpcomingSessions', 'Không có buổi học sắp tới')}</p>
            ) : (
              <div className="space-y-2">
                {mySessions.slice(0, 5).map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-4 w-4 text-sky-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{getClassName(s.classId)}</div>
                      <div className="text-xs text-muted-foreground">{s.date} · {s.startTime}-{s.endTime}</div>
                    </div>
                    <Badge variant={s.status === 'COMPLETED' ? 'default' : 'outline'} className="text-[10px] shrink-0">
                      {s.status === 'COMPLETED' ? t('teacher.dashboard.completed', 'Xong') : t('teacher.dashboard.upcoming', 'Sắp tới')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('teacher.dashboard.currentClasses', 'Lớp đang dạy')}</CardTitle>
          </CardHeader>
          <CardContent>
            {myClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('teacher.dashboard.noClasses', 'Chưa được phân công lớp')}</p>
            ) : (
              <div className="space-y-2">
                {myClasses.map((cls: any) => (
                  <div key={cls.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4 text-sky-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{cls.name}</div>
                      <div className="text-xs text-muted-foreground">{cls.room || '-'}</div>
                    </div>
                    <Badge variant={cls.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">
                      {cls.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
