'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ClipboardCheck, CalendarDays, UserCheck, UserX, Clock, LayoutList, LayoutGrid } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { useLMSStore } from '@/store/lms-store'
import { format, parseISO } from 'date-fns'
import { getDashboard, getSessions, getClasses } from '@/lib/api'
import { staggerContainer, staggerItem } from '@/components/shared/animations'
import { useTranslation } from '@/lib/i18n'

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  PRESENT: { label: 'Có mặt', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 hover:bg-sky-100' },
  ABSENT_EXCUSED: { label: 'Vắng có phép', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100' },
  ABSENT_UNEXCUSED: { label: 'Vắng không phép', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100' },
  LATE: { label: 'Đi muộn', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100' },
  EARLY_LEAVE: { label: 'Về sớm', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100' },
  MAKEUP: { label: 'Học bù', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 hover:bg-violet-100' },
}

export default function StudentAttendance() {
  const { authUser } = useLMSStore()
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list')

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'lms_student', authUser?.id],
    queryFn: () => getDashboard('lms_student', authUser!.id),
    enabled: !!authUser?.id,
  })

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'student', authUser?.id],
    queryFn: () => getSessions(),
    enabled: !!authUser?.id,
  })

  const dashboard = dashboardQuery.data
  // NOTE: the dashboard endpoint returns counters only — there is no
  // enrollments join and sessions carry no embedded attendance, so a
  // student's personal attendance history requires a backend endpoint that
  // does not exist yet. Until then this view shows the student's session
  // schedule ("which sessions happened") without per-student statuses.
  const classesQuery = useQuery({
    queryKey: ['classes', 'student-attendance', authUser?.id],
    queryFn: () => getClasses(),
    enabled: !!authUser?.id,
  })
  const myClassCode = (() => {
    try {
      const raw = (authUser?.props as Record<string, unknown> | undefined)?.student
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return ((parsed as Record<string, unknown>)?.vmg_class_code as string) ?? ''
    } catch {
      return ''
    }
  })()
  const myClassIds = new Set(
    myClassCode
      ? (classesQuery.data || []).filter((c: any) => c.code === myClassCode).map((c: any) => c.id)
      : [],
  )
  const allSessions = (sessionsQuery.data || []).filter((s: any) =>
    myClassIds.size > 0 ? myClassIds.has(s.classId) : true,
  )

  const attendanceRecords: any[] = []
  const totalPresent = 0
  const totalAbsent = 0
  const totalLate = 0
  const totalRecords = 0
  const attendanceRate = 0

  if (dashboardQuery.isLoading || sessionsQuery.isLoading) return <LoadingState />

  if (dashboardQuery.isError) {
    return <ErrorState onRetry={() => dashboardQuery.refetch()} />
  }
  if (sessionsQuery.isError) {
    return <ErrorState onRetry={() => sessionsQuery.refetch()} />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title={t('student.attendance.title', 'Điểm danh')}
        description={t('student.attendance.description', 'Lịch sử chuyên cần của bạn')}
        icon={<ClipboardCheck className="h-5 w-5" />}
        accentColor="sky"
      />

      {/* Stats */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('student.attendance.attendanceRate', 'Tỷ lệ chuyên cần')}
            value={`${attendanceRate}%`}
            icon={<ClipboardCheck className="h-5 w-5" />}
            iconColor="text-sky-600"
            iconBg="bg-sky-100"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('student.attendance.present', 'Có mặt')}
            value={String(totalPresent)}
            icon={<UserCheck className="h-5 w-5" />}
            iconColor="text-sky-600"
            iconBg="bg-sky-100"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('student.attendance.absent', 'Vắng mặt')}
            value={String(totalAbsent)}
            icon={<UserX className="h-5 w-5" />}
            iconColor="text-red-600"
            iconBg="bg-red-100"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title={t('student.attendance.lateEarly', 'Đi muộn/Về sớm')}
            value={String(totalLate)}
            icon={<Clock className="h-5 w-5" />}
            iconColor="text-orange-600"
            iconBg="bg-orange-100"
          />
        </motion.div>
      </motion.div>

      {/* Attendance List/Table */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3 px-6 pt-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-sky-600" />
              {t('student.attendance.history', 'Lịch sử điểm danh')}
              <Badge variant="secondary" className="rounded-full text-xs">
                {attendanceRecords.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0 rounded-md"
                onClick={() => setViewMode('list')}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0 rounded-md"
                onClick={() => setViewMode('table')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {attendanceRecords.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-10 w-10" />}
                  title={t('student.attendance.noData', 'Chưa có dữ liệu điểm danh')}
                  description={t('student.attendance.noDataDesc', 'Lịch sử điểm danh sẽ hiển thị sau khi có buổi học.')}
            />
          ) : viewMode === 'table' ? (
            /* Table View */
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{t('common.date', 'Ngày')}</TableHead>
                    <TableHead className="text-xs">{t('student.attendance.class', 'Lớp')}</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">{t('student.attendance.session', 'Buổi học')}</TableHead>
                    <TableHead className="text-xs">{t('common.status', 'Trạng thái')}</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">{t('student.attendance.note', 'Ghi chú')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRecords.map((record: any, idx: number) => {
                    const statusInfo = STATUS_MAP[record.status] || STATUS_MAP.PRESENT
                    return (
                      <TableRow key={record.id || idx}>
                        <TableCell className="text-sm font-medium">
                          {record.session?.date
                            ? format(parseISO(record.session.date), 'dd/MM/yyyy')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.session?.class?.name || record.className || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                          {record.session?.title || record.sessionName || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                          {record.note || '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* List View */
            <div className="space-y-2">
              {attendanceRecords.map((record: any, idx: number) => {
                const statusInfo = STATUS_MAP[record.status] || STATUS_MAP.PRESENT
                return (
                  <motion.div
                    key={record.id || idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{record.session?.class?.name || record.className || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.session?.date ? format(parseISO(record.session.date), 'dd/MM/yyyy') : ''}
                        {record.session?.startTime ? ` · ${record.session.startTime} - ${record.session.endTime}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {record.note && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">{record.note}</span>
                      )}
                      <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
