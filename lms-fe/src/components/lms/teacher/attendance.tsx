'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/lms/page-header'
import { useLMSStore } from '@/store/lms-store'
import { getSessions, getSessionAttendance, saveAttendance } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ErrorState } from '@/components/lms/error-state'

const ATTENDANCE_OPTIONS = [
  { value: 'PRESENT', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'ABSENT_EXCUSED', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'ABSENT_UNEXCUSED', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'LATE', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'EARLY_LEAVE', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'MAKEUP', color: 'bg-blue-100 text-blue-700 border-blue-200' },
]

const ATTENDANCE_LABEL_KEYS: Record<string, [string, string]> = {
  PRESENT: ['teacher.attendance.present', 'Có mặt'],
  ABSENT_EXCUSED: ['teacher.attendance.absentExcused', 'Nghi phép'],
  ABSENT_UNEXCUSED: ['teacher.attendance.absentUnexcused', 'Nghi không phép'],
  LATE: ['teacher.attendance.late', 'Đi muộn'],
  EARLY_LEAVE: ['teacher.attendance.earlyLeave', 'Về sớm'],
  MAKEUP: ['teacher.attendance.makeup', 'Học bù'],
}

export default function TeacherAttendance() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { authUser } = useLMSStore()
  const [selectedSession, setSelectedSession] = useState('')
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({})

  const { data: sessions, isLoading: isLoadingSessions, isError: isSessionsError, refetch: refetchSessions } = useQuery({ queryKey: ['sessions'], queryFn: () => getSessions() })
  const mySessions = (sessions || []).filter((s: any) => s.teacherId === authUser?.id)

  const { data: attendanceData, isLoading, isError: isAttendanceError, refetch: refetchAttendance } = useQuery({
    queryKey: ['session-attendance', selectedSession],
    queryFn: () => getSessionAttendance(selectedSession),
    enabled: !!selectedSession,
  })

  // Initialize attendance map when data loads
  const students = (attendanceData as any)?.students || []
  const existing = (attendanceData as any)?.attendance || []

  useEffect(() => {
    if (!selectedSession || !students.length) return
    if (existing.length > 0) {
      const map: Record<string, string> = {}
      existing.forEach((a: any) => { map[a.studentId] = a.status })
      setAttendanceMap(map)
    } else {
      const map: Record<string, string> = {}
      students.forEach((s: any) => { map[s.id] = 'PRESENT' })
      setAttendanceMap(map)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession, students.length, existing.length])

  const saveMutation = useMutation({
    mutationFn: (data: any[]) => saveAttendance(selectedSession, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['session-attendance'] }); toast({ title: t('teacher.attendance.saved', 'Đã lưu điểm danh') }) },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('common.error', 'Lỗi'), variant: 'destructive' }),
  })

  const handleSave = () => {
    const data = Object.entries(attendanceMap).map(([studentId, status]) => ({ studentId, status }))
    saveMutation.mutate(data)
  }

  const setAttendance = (studentId: string, status: string) => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }))
  }

  const selectedSessionData = mySessions.find((s: any) => s.id === selectedSession)

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader title={t('teacher.attendance.title', 'Điểm danh')} description={t('teacher.attendance.description', 'Đánh giá chuyên cần học viên')} icon={ClipboardCheck} accentColor="teal" />

      {/* Session selector */}
      <Card className="rounded-xl border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium shrink-0">{t('teacher.attendance.selectSession', 'Chọn buổi học')}:</Label>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder={t('teacher.attendance.selectSessionPlaceholder', 'Chọn buổi học...')} /></SelectTrigger>
              <SelectContent>
                {isLoadingSessions ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">{t('common.loading', 'Đang tải...')}</div>
                ) : isSessionsError ? (
                  <div className="p-2 text-center text-sm text-destructive">{t('common.error', 'Lỗi')}</div>
                ) : (
                  [...mySessions].sort((a: any, b: any) => b.date.localeCompare(a.date)).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.date} ({s.startTime}-{s.endTime}) - {s.className || s.classId}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Attendance grid */}
      {selectedSession && (
        <Card className="rounded-xl border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">
            {selectedSessionData?.date} | {selectedSessionData?.startTime}-{selectedSessionData?.endTime}
            <span className="ml-2 text-xs text-muted-foreground">{students.length} {t('teacher.attendance.students', 'học viên')}</span>
          </CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><div className="h-6 w-6 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
            ) : isAttendanceError ? (
              <ErrorState onRetry={() => refetchAttendance()} />
            ) : (
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <div className="w-40 shrink-0" />
                  {ATTENDANCE_OPTIONS.map(opt => (
                    <div key={opt.value} className="flex-1 text-center">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', opt.color)}>{t(...ATTENDANCE_LABEL_KEYS[opt.value])}</span>
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {students.map((student: any) => (
                  <div key={student.id} className="flex items-center gap-2">
                    <div className="w-40 shrink-0 text-sm font-medium truncate">{student.name}</div>
                    {ATTENDANCE_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex-1 flex justify-center">
                        <button
                          onClick={() => setAttendance(student.id, opt.value)}
                          className={cn(
                            'w-8 h-8 rounded-lg border text-xs font-medium transition-all',
                            attendanceMap[student.id] === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-current scale-105' : 'border-transparent bg-transparent hover:bg-muted/50'
                          )}
                        >
                          {t(...ATTENDANCE_LABEL_KEYS[opt.value])[0]}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700 rounded-lg" disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />{saveMutation.isPending ? t('common.loading', 'Đang lưu...') : t('teacher.attendance.saveAttendance', 'Lưu điểm danh')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
