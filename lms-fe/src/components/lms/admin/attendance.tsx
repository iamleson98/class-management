'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ClipboardCheck, Check, X, Clock, LogOut, RotateCcw, Save } from 'lucide-react'
import { getClasses, getSessions, getSessionAttendance, saveAttendance, getStudents } from '@/lib/api'
import { eq, and, in_ } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { ErrorState } from '@/components/lms/error-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/components/lms/shared/animations'
import { useTranslation } from '@/lib/i18n'

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Có mặt', icon: Check, className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200' },
  { value: 'EXCUSED_ABSENT', label: 'Vắng phép', icon: Clock, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' },
  { value: 'UNEXCUSED_ABSENT', label: 'Vắng không phép', icon: X, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
  { value: 'LATE', label: 'Đi muộn', icon: Clock, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' },
  { value: 'EARLY_LEAVE', label: 'Về sớm', icon: LogOut, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' },
  { value: 'MAKEUP', label: 'Học bù', icon: RotateCcw, className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200' },
]

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Có mặt',
  EXCUSED_ABSENT: 'Vắng phép',
  UNEXCUSED_ABSENT: 'Vắng không phép',
  LATE: 'Đi muộn',
  EARLY_LEAVE: 'Về sớm',
  MAKEUP: 'Học bù',
}

const STATUS_BADGE: Record<string, string> = {
  PRESENT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  EXCUSED_ABSENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  UNEXCUSED_ABSENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  LATE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  EARLY_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  MAKEUP: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
}

export default function AdminAttendance() {
  const { toast } = useToast()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<string, string>>({})

  const { data: classes = [], isLoading: classesLoading, isError: isClassesError, refetch: refetchClasses } = useQuery({
    queryKey: ['classes', 'active'],
    // Newly created classes default to OPEN — include both OPEN and ACTIVE so
    // fresh classes are selectable for attendance.
    queryFn: () => getClasses({ where_ands: and(in_('classes.status', ['OPEN', 'ACTIVE'])) }),
  })

  const { data: sessions = [], isLoading: isLoadingSessions, isError: isSessionsError } = useQuery({
    queryKey: ['sessions', selectedDate, selectedClassId],
    queryFn: () => getSessions({ where_ands: and(eq('lms_sessions.date', selectedDate), eq('lms_sessions.class_id', selectedClassId || undefined)) }),
    enabled: !!selectedDate,
  })

  const activeSession = sessions.find((s) => s.classId === selectedClassId) || sessions[0]

  // The attendance API returns flat records WITHOUT student objects — the
  // roster comes from the class enrollment (POST /lms/students with class_id).
  const { data: roster = [] } = useQuery({
    queryKey: ['class-roster', activeSession?.classId],
    queryFn: () => getStudents({ class_id: activeSession!.classId }),
    enabled: !!activeSession?.classId,
  })

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance', activeSession?.id],
    queryFn: () => activeSession ? getSessionAttendance(activeSession.id) : Promise.resolve([]),
    enabled: !!activeSession?.id,
  })
  // The backend returns a bare [Attendance] array.
  const attendanceRecords = (attendanceData || []) as Array<{ studentId: string; status: string }>

  // Roster rows joined with any saved attendance; the map key is the USER id.
  const students = useMemo(
    () => roster.map((s: any) => {
      const uid = s.userId ?? s.id
      const record = attendanceRecords.find((a) => a.studentId === uid)
      return { ...s, id: uid, savedStatus: record?.status }
    }),
    [roster, attendanceRecords],
  )

  const attendanceMap = useMemo(() => {
    const initial: Record<string, string> = {}
    // Default everyone to PRESENT so a first save records the full roster
    // (the POST is a full replace — omitting a student would delete their row).
    students.forEach((s: any) => { initial[s.id] = s.savedStatus || 'PRESENT' })
    attendanceRecords.forEach((a) => {
      if (a.studentId && a.status) initial[a.studentId] = a.status
    })

    return { ...initial, ...attendanceOverrides }
  }, [students, attendanceRecords, attendanceOverrides])

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!activeSession) return Promise.reject('No session')
      const records = Object.entries(attendanceMap).map(([studentId, status]) => ({ studentId, status }))
      return saveAttendance(activeSession.id, records as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      toast({ title: t('attendance.saveSuccess', 'Lưu điểm danh thành công') })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('attendance.saveFailed', 'Lưu điểm danh thất bại'), variant: 'destructive' }),
  })

  const handleMark = (studentId: string, status: string) => {
    setAttendanceOverrides((prev) => ({ ...prev, [studentId]: status }))
  }

  const markAll = (status: string) => {
    const newData: Record<string, string> = {}
    students.forEach((s: any) => {
      newData[s.id] = status
    })
    setAttendanceOverrides(newData)
  }

  if (classesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isClassesError) {
    return <ErrorState onRetry={() => refetchClasses()} />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <PageHeader
        title={t('attendance.title', 'Điểm danh')}
        description={t('attendance.description', 'Theo dõi và ghi nhận điểm danh học viên')}
        icon={ClipboardCheck}
        accentColor="sky"
        actions={
          selectedClassId && students.length > 0 ? (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? t('common.loading', 'Đang lưu...') : t('attendance.saveAttendance', 'Lưu điểm danh')}
            </Button>
          ) : null
        }
      />

      {/* Selectors */}
      <Card className="rounded-xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('attendance.selectClass', 'Chọn lớp')}</p>
            <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setAttendanceOverrides({}) }}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder={t('attendance.selectClassPlaceholder', 'Chọn lớp học')} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls: any) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name} ({cls.code || '-'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('common.date', 'Ngày')}</p>
            <DatePicker
              value={selectedDate}
              onChange={(v) => { setSelectedDate(v); setAttendanceOverrides({}) }}
              className="w-45"
            />
          </div>
          {students.length > 0 && (
            <div className="space-y-1 sm:ml-auto">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('attendance.markAll', 'Đánh dấu tất cả')}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => markAll('PRESENT')}>
                  <Check className="h-3 w-3 mr-1" />{t('attendance.present', 'Có mặt')}
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => markAll('UNEXCUSED_ABSENT')}>
                  <X className="h-3 w-3 mr-1" />{t('attendance.absent', 'Vắng')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Attendance Table */}
      {!selectedClassId ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t('attendance.selectClassTitle', 'Chọn lớp học')}
          description={t('attendance.selectClassDesc', 'Hãy chọn lớp học để bắt đầu điểm danh.')}
        />
      ) : isLoadingSessions ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
          <span className="ml-3 text-muted-foreground">{t('common.loading', 'Đang tải...')}</span>
        </div>
      ) : isSessionsError ? (
        <ErrorState onRetry={() => {}} />
      ) : attendanceLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t('attendance.noStudents', 'Chưa có học viên')}
          description={t('attendance.noStudentsDesc', 'Lớp học này chưa có học viên hoặc không có buổi học trong ngày đã chọn.')}
        />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="rounded-xl overflow-hidden border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="uppercase text-xs font-semibold w-12.5">{t('attendance.index', 'STT')}</TableHead>
                <TableHead className="uppercase text-xs font-semibold">{t('common.name', 'Họ tên')}</TableHead>
                <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('common.status', 'Trạng thái')}</TableHead>
                <TableHead className="uppercase text-xs font-semibold">{t('common.actions', 'Thao tác')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student: any, idx: number) => {
                const currentStatus = attendanceMap[student.id] || student.status || ''
                return (
                  <motion.tr key={student.id} variants={staggerItem} className="hover:bg-muted/30">
                    <TableCell className="text-sm text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{student.name || student.username}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {currentStatus ? (
                        <Badge className={cn('rounded-full text-xs', STATUS_BADGE[currentStatus] || 'bg-muted text-muted-foreground')}>
                          {STATUS_LABEL[currentStatus] || currentStatus}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('attendance.notMarked', 'Chưa điểm danh')}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {STATUS_OPTIONS.map((opt) => (
                          <Button
                            key={opt.value}
                            variant={currentStatus === opt.value ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                              'h-7 text-[10px] px-2 rounded-lg',
                              currentStatus === opt.value && opt.className
                            )}
                            onClick={() => handleMark(student.id, opt.value)}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </motion.tr>
                )
              })}
            </TableBody>
          </Table>
        </motion.div>
      )}
    </motion.div>
  )
}
