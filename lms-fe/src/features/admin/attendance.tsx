'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ClipboardCheck, Check, X, Clock, LogOut, RotateCcw, Save } from 'lucide-react'
import { getClasses, getSessions, getSessionAttendance, saveAttendance, getStudents } from '@/lib/api'
import { eq, and, in_ } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { DataTable } from '@/components/data-table'
import { createAttendanceColumns, type AttendanceRow } from './attendance-columns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n'

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Có mặt', icon: Check, className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200' },
  { value: 'EXCUSED_ABSENT', label: 'Vắng phép', icon: Clock, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' },
  { value: 'UNEXCUSED_ABSENT', label: 'Vắng không phép', icon: X, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
  { value: 'LATE', label: 'Đi muộn', icon: Clock, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' },
  { value: 'EARLY_LEAVE', label: 'Về sớm', icon: LogOut, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' },
  { value: 'MAKEUP', label: 'Học bù', icon: RotateCcw, className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200' },
]

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
    () =>
      roster.map((s: any) => {
        const uid = s.userId ?? s.id
        const record = attendanceRecords.find((a) => a.studentId === uid)
        return {
          ...s,
          id: uid,
          savedStatus: record?.status,
        } as AttendanceRow
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
    students.forEach((s: AttendanceRow) => {
      newData[s.id] = status
    })
    setAttendanceOverrides(newData)
  }

  // Rows for the data table: roster with each student's resolved status.
  const rows = useMemo(
    () =>
      students.map((s) => ({
        ...s,
        currentStatus: attendanceMap[s.id] || (s.status as string | undefined) || '',
      })),
    [students, attendanceMap]
  )

  const columns = useMemo(
    () => createAttendanceColumns(t, handleMark),
    [t, handleMark]
  )

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
        <DataTable
          columns={columns}
          data={rows}
          searchColumnId="name"
          searchPlaceholder={t('attendance.searchStudent', 'Tìm học viên...')}
          initialPageSize={20}
          emptyState={
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <ClipboardCheck className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">{t('attendance.noStudents', 'Lớp học này chưa có học viên hoặc không có buổi học trong ngày đã chọn.')}</p>
            </div>
          }
        />
      )}
    </motion.div>
  )
}
