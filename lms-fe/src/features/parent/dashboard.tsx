'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { GraduationCap, CalendarDays, ClipboardCheck, DollarSign, Clock } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/data-table'
import { createParentTuitionColumns } from './dashboard-columns'
import { useLMSStore } from '@/store/lms-store'
import { formatVND, getDashboard, getTuitions, getSessions, getClasses } from '@/lib/api'
import { in_, and } from '@/lib/query'
import { useParentChildren } from '@/lib/parent'
import { useTranslation } from '@/lib/i18n'

/**
 * Parent overview — composed client-side from role-permitted endpoints:
 *   - getDashboard('lms_parent')  → backend-computed children/session counts
 *   - students (parent_id = me)   → the children themselves
 *   - tuitions (student_id IN children) → balances table
 *   - classes referenced by those tuitions + sessions → upcoming schedule
 */
export default function ParentDashboard() {
  const { authUser } = useLMSStore()
  const { t } = useTranslation()

  const { data, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'lms_parent', authUser?.id],
    queryFn: () => getDashboard('lms_parent', authUser!.id),
    enabled: !!authUser?.id,
  })

  const childrenQuery = useParentChildren(authUser?.id)
  const children = childrenQuery.data || []
  const childIds = children.map((c) => c.id)

  const tuitionsQuery = useQuery({
    queryKey: ['parent', 'tuitions', childIds.join(',')],
    queryFn: () => getTuitions({ where_ands: and(in_('tuitions.student_id', childIds)) }),
    enabled: childIds.length > 0,
  })
  const classesQuery = useQuery({ queryKey: ['parent', 'classes'], queryFn: () => getClasses() })
  const sessionsQuery = useQuery({
    queryKey: ['parent', 'sessions'],
    queryFn: () => getSessions(),
    enabled: childIds.length > 0,
  })

  const classes = classesQuery.data || []
  const classById = new Map(classes.map((c: any) => [c.id, c]))
  const tuitionColumns = useMemo(
    () => createParentTuitionColumns(t, (tu) => classById.get(tu.classId)?.name || '—'),
    [t, classes]
  )

  const isLoading = childrenQuery.isLoading || tuitionsQuery.isLoading || sessionsQuery.isLoading
  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  const stats = data || {}
  const tuitions = tuitionsQuery.data || []

  // Children's classes are derived from their tuitions (a tuition exists only
  // for an enrolled class) — the honest link available via the current API.
  const childClassIds = new Set(tuitions.map((tu: any) => tu.classId))
  const todayStr = new Date().toISOString().slice(0, 10)
  const upcomingSessions = ((sessionsQuery.data || []) as any[])
    .filter((s) => childClassIds.has(s.classId) && (s.date || '') >= todayStr)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(0, 5)

  const remainingTuition = tuitions.reduce((sum: number, tu: any) => sum + Number(tu.remainingAmount ?? 0), 0)
  const primaryChild = children[0]

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title={t('parent.dashboard.title', 'Thông tin phụ huynh')}
        description={t('parent.dashboard.description', 'Theo dõi tình hình học tập của con')}
        icon={<GraduationCap className="h-5 w-5" />}
        accentColor="amber"
      />

      {/* Child Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <h3 className="font-semibold">{t('parent.dashboard.studentInfo', 'Thông tin học viên')}</h3>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : children.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('parent.dashboard.noChildren', 'Chưa có học viên nào được liên kết với tài khoản này')}
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('common.name', 'Họ tên')}</p>
                <p className="font-medium">{primaryChild?.name || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('parent.dashboard.studentCode', 'Mã học viên')}</p>
                <p className="font-medium">{primaryChild?.code || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('parent.dashboard.currentClass', 'Lớp đang học')}</p>
                <p className="font-medium">{classById.get([...childClassIds][0])?.name || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('parent.dashboard.children', 'Số học viên')}</p>
                <p className="font-medium">{children.length}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title={t('parent.dashboard.totalChildren', 'Số học viên')}
          value={String(stats.totalChildren ?? children.length)}
          icon={<ClipboardCheck className="h-5 w-5" />}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          title={t('parent.dashboard.upcomingSessions', 'Buổi học sắp tới')}
          value={String(stats.totalUpcomingSessions ?? upcomingSessions.length)}
          icon={<CalendarDays className="h-5 w-5" />}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title={t('parent.dashboard.remainingTuition', 'Học phí còn thiếu')}
          value={tuitions.length ? formatVND(remainingTuition) : '—'}
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="text-red-600"
          iconBg="bg-red-100"
        />
        <StatCard
          title={t('parent.dashboard.tuitionCount', 'Học phí đang theo dõi')}
          value={String(tuitions.length)}
          icon={<Clock className="h-5 w-5" />}
          iconColor="text-orange-600"
          iconBg="bg-orange-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Sessions */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">{t('parent.dashboard.upcomingSessions', 'Buổi học sắp tới')}</h3>
          </CardHeader>
          <CardContent>
            {sessionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <span className="ml-2 text-sm text-muted-foreground">{t('common.loading', 'Đang tải...')}</span>
              </div>
            ) : upcomingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('parent.dashboard.noUpcomingSessions', 'Không có buổi học sắp tới')}</p>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map((session: any, idx: number) => (
                  <div key={session.id || idx} className="flex items-center justify-between p-2 rounded border">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{classById.get(session.classId)?.name || session.title || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.date ? new Date(session.date).toLocaleDateString('vi-VN') : ''}
                        {' '}{session.startTime} - {session.endTime}
                      </p>
                    </div>
                    <Badge variant="outline">{session.room || '—'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tuition */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">{t('parent.dashboard.tuition', 'Học phí')}</h3>
          </CardHeader>
          <CardContent>
            {tuitionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <span className="ml-2 text-sm text-muted-foreground">{t('common.loading', 'Đang tải...')}</span>
              </div>
            ) : tuitions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('parent.dashboard.noTuition', 'Chưa có thông tin học phí')}</p>
            ) : (
              <DataTable
                columns={tuitionColumns}
                data={tuitions}
                paginationMode="client"
                initialPageSize={8}
                showViewOptions={false}
                tableClassName="rounded-md"
                emptyState={
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t('parent.dashboard.noTuition', 'Chưa có thông tin học phí')}
                  </p>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
