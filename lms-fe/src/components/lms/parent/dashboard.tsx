'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { GraduationCap, CalendarDays, ClipboardCheck, DollarSign, Clock } from 'lucide-react'
import { PageHeader } from '@/components/lms/page-header'
import { ErrorState } from '@/components/lms/error-state'
import { StatCard } from '@/components/lms/stat-card'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLMSStore } from '@/store/lms-store'
import { formatVND, getDashboard } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'

export default function ParentDashboard() {
  const { authUser } = useLMSStore()
  const { t } = useTranslation()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'PARENT', authUser?.id],
    queryFn: () => getDashboard('PARENT', authUser!.id),
    enabled: !!authUser?.id,
  })

  const stats = data || {}
  const child = (data?.child || data?.student || {}) as Record<string, any>
  const upcomingSessions = (data?.upcomingSessions || data?.sessions || []) as any[]
  const attendanceHistory = (data?.attendanceHistory || data?.attendance || []) as any[]
  const tuitionInfo = (data?.tuition || data?.tuitions || []) as any[]

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('common.name', 'Họ tên')}</p>
              <p className="font-medium">{child.name || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('parent.dashboard.studentCode', 'Mã học viên')}</p>
              <p className="font-medium">{child.code || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('parent.dashboard.currentClass', 'Lớp đang học')}</p>
              <p className="font-medium">{child.className || child.class?.name || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('parent.dashboard.course', 'Khóa học')}</p>
              <p className="font-medium">{child.courseName || child.course?.name || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title={t('parent.dashboard.attendanceRate', 'Tỷ lệ chuyên cần')}
          value={stats.attendanceRate != null ? `${stats.attendanceRate}%` : '—'}
          icon={<ClipboardCheck className="h-5 w-5" />}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          title={t('parent.dashboard.completedSessions', 'Số buổi đã học')}
          value={String(stats.completedSessions ?? '—')}
          icon={<CalendarDays className="h-5 w-5" />}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title={t('parent.dashboard.remainingTuition', 'Học phí còn thiếu')}
          value={stats.remainingTuition != null ? formatVND(Number(stats.remainingTuition)) : '—'}
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="text-red-600"
          iconBg="text-red-100"
        />
        <StatCard
          title={t('parent.dashboard.monthlyAttendance', 'Điểm danh tháng này')}
          value={String(stats.monthlyAttendance ?? '—')}
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
            {isLoading ? (
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
                      <p className="text-sm font-medium">{session.className || session.class?.name}</p>
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

        {/* Attendance History */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">{t('parent.dashboard.attendanceHistory', 'Lịch sử điểm danh')}</h3>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <span className="ml-2 text-sm text-muted-foreground">{t('common.loading', 'Đang tải...')}</span>
              </div>
            ) : attendanceHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('parent.dashboard.noAttendanceData', 'Chưa có dữ liệu điểm danh')}</p>
            ) : (
              <div className="space-y-2">
                {attendanceHistory.slice(0, 10).map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded border">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.session?.class?.name || item.className || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.session?.date ? new Date(item.session.date).toLocaleDateString('vi-VN') : ''}
                      </p>
                    </div>
                    <div>
                      {item.status === 'PRESENT' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Có mặt</Badge>}
                      {(item.status === 'ABSENT_EXCUSED' || item.status === 'ABSENT_UNEXCUSED') && <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Vắng mặt</Badge>}
                      {item.status === 'LATE' && <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Đi muộn</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tuition */}
      {tuitionInfo.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <h3 className="font-semibold">{t('parent.dashboard.tuition', 'Học phí')}</h3>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('parent.dashboard.class', 'Lớp')}</TableHead>
                    <TableHead className="text-right">{t('common.total', 'Tổng')}</TableHead>
                    <TableHead className="text-right">{t('parent.dashboard.paid', 'Đã thu')}</TableHead>
                    <TableHead className="text-right">{t('parent.dashboard.remaining', 'Còn thiếu')}</TableHead>
                    <TableHead>{t('common.status', 'Trạng thái')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tuitionInfo.map((t: any, idx: number) => (
                    <TableRow key={t.id || idx}>
                      <TableCell className="font-medium">{t.className || t.class?.name}</TableCell>
                      <TableCell className="text-right">{formatVND(t.totalAmount || 0)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatVND(t.paidAmount || 0)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatVND((t.totalAmount || 0) - (t.paidAmount || 0))}</TableCell>
                      <TableCell>
                        {t.status === 'PAID' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Đã thanh toán</Badge>}
                        {t.status === 'PARTIAL' && <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Còn thiếu</Badge>}
                        {t.status === 'UNPAID' && <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Chưa thanh toán</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
