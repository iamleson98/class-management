'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  format, startOfMonth, endOfMonth, startOfWeek, addDays,
  addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, User, Users } from 'lucide-react'
import { getSessions, getStudents } from '@/lib/api'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { ErrorState } from '@/components/lms/error-state'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const COURSE_COLORS = [
  { bg: 'bg-sky-100 dark:bg-sky-900/30', border: 'border-l-sky-500', text: 'text-sky-700 dark:text-sky-400', dot: 'bg-sky-500' },
  { bg: 'bg-teal-100 dark:bg-teal-900/30', border: 'border-l-teal-500', text: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-500' },
  { bg: 'bg-violet-100 dark:bg-violet-900/30', border: 'border-l-violet-500', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-l-amber-500', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-l-rose-500', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
  { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-l-blue-500', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
]

const MAX_MINI_CARDS = 3

function getCourseColorIndex(courseId: string): number {
  let hash = 0
  for (let i = 0; i < courseId.length; i++) {
    hash = courseId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % COURSE_COLORS.length
}

function statusBadge(status: string) {
  if (status === 'COMPLETED') return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px]">Hoàn thành</Badge>
  if (status === 'CANCELLED') return <Badge variant="destructive" className="text-[10px]">Đã hủy</Badge>
  return <Badge variant="outline" className="text-[10px]">Sắp tới</Badge>
}

export default function ParentSchedule() {
  const { t } = useTranslation()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')

  const monthStr = format(currentDate, 'yyyy-MM')

  // Fetch all students to find children of this parent
  const { data: allStudents = [], isLoading: loadingStudents, isError: isErrorStudents, refetch: refetchStudents } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => getStudents(),
  })

  // Find children: students whose parentId matches a parent record linked to this user.
  // Since we don't have a getParents API, we filter students by checking if they have a parentId
  // and match by finding parent user records. For simplicity, we show all students with parentId set
  // and let the parent select. A production app would have a dedicated parent-child API.
  const children = useMemo(() => {
    if (!allStudents.length) return []
    // Filter students that have a parentId (indicating they are linked to a parent)
    return allStudents.filter((s: any) => s.parentId)
  }, [allStudents])

  // Auto-select first child if not selected and children are available
  const effectiveStudentId = selectedStudentId || (children.length > 0 ? children[0].id : '')

  const { data: sessions = [], isLoading: loadingSessions, isError: isErrorSessions, refetch: refetchSessions } = useQuery({
    queryKey: ['parent-sessions', monthStr, effectiveStudentId],
    // The sessions table has no `student_id` or `month` column, so we fetch all
    // and filter to the current month client-side.
    queryFn: () => getSessions(),
    enabled: !!effectiveStudentId,
    select: (all) => all.filter((s) => (s.date || '').startsWith(monthStr)),
  })

  // Calendar grid
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 13)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  // Group sessions by date string
  const sessionsByDate = useMemo(() => {
    const map: Record<string, any[]> = {}
    sessions.forEach((s: any) => {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    })
    Object.values(map).forEach((arr) => arr.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime)))
    return map
  }, [sessions])

  // Stats
  const totalSessions = sessions.length
  const completedSessions = sessions.filter((s: any) => s.status === 'COMPLETED').length
  const upcomingSessions = sessions.filter((s: any) => s.status === 'SCHEDULED').length

  const monthLabel = currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })

  const [direction, setDirection] = useState(0)
  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  }

  const handlePrev = () => { setDirection(-1); setCurrentDate((d) => subMonths(d, 1)) }
  const handleNext = () => { setDirection(1); setCurrentDate((d) => addMonths(d, 1)) }

  const selectedChild = children.find((c: any) => c.id === effectiveStudentId)

  if (isErrorSessions) {
    return <ErrorState onRetry={() => refetchSessions()} />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <PageHeader title={t('parent.schedule.title', 'Thời khóa biểu')} description={t('parent.schedule.description', 'Lịch học của con')} icon={CalendarDays} accentColor="amber" />

      {/* Child selector */}
      <Card className="rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-amber-500" />
            <label className="text-sm font-medium whitespace-nowrap">{t('parent.schedule.student', 'Học sinh')}:</label>
            {loadingStudents ? (
              <Skeleton className="h-9 w-48" />
            ) : isErrorStudents ? (
              <p className="text-sm text-red-500">{t('common.loadError', 'Lỗi tải dữ liệu')} <button className="underline" onClick={() => refetchStudents()}>{t('common.retry', 'Thử lại')}</button></p>
            ) : children.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('parent.schedule.noStudentFound', 'Không tìm thấy học sinh')}</p>
            ) : (
              <Select value={effectiveStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder={t('parent.schedule.selectStudent', 'Chọn học sinh để xem lịch')} />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child: any) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name}{child.code ? ` (${child.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-xl border-amber-100 dark:border-amber-900/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalSessions}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t('parent.schedule.totalSessions', 'Tổng buổi')}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-100 dark:border-amber-900/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{completedSessions}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t('parent.schedule.completed', 'Hoàn thành')}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-100 dark:border-amber-900/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{upcomingSessions}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t('parent.schedule.upcoming', 'Sắp tới')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      {effectiveStudentId ? (
        <Card className="rounded-xl overflow-hidden">
          <CardContent className="p-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="icon" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">{monthLabel}</span>
                {selectedChild && (
                  <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
                    {selectedChild.name}
                  </Badge>
                )}
              </div>
              <Button variant="outline" size="icon" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day names header */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map((name, idx) => (
                <div
                  key={name}
                  className={cn(
                    'text-center text-xs font-semibold py-2',
                    idx >= 5 && 'text-muted-foreground',
                  )}
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={monthStr + effectiveStudentId}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="grid grid-cols-7 gap-1"
              >
                {days.map((day) => {
                  const dayStr = format(day, 'yyyy-MM-dd')
                  const daySessions = sessionsByDate[dayStr] || []
                  const inMonth = isSameMonth(day, currentDate)
                  const isTodayDate = isToday(day)
                  const dayOfWeek = day.getDay()
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

                  return (
                    <TooltipProvider key={dayStr} delayDuration={100}>
                      <div
                        className={cn(
                          'min-h-22.5 md:min-h-27.5 p-1 rounded-lg border transition-colors relative',
                          inMonth ? 'bg-background' : 'bg-muted/30',
                          isWeekend && inMonth && 'bg-muted/20',
                          isTodayDate && 'ring-2 ring-amber-500/40 border-amber-500/30',
                          !isTodayDate && 'border-border/50',
                        )}
                      >
                        {/* Day number */}
                        <div className="flex items-center justify-between mb-0.5 px-1">
                          <span
                            className={cn(
                              'text-xs font-medium',
                              !inMonth && 'text-muted-foreground/40',
                              inMonth && isWeekend && 'text-muted-foreground',
                              isTodayDate && 'text-amber-700 dark:text-amber-400 font-bold',
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          {isTodayDate && (
                            <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                              {t('parent.schedule.today', 'Hôm nay')}
                            </span>
                          )}
                        </div>

                        {/* Session mini-cards (desktop) */}
                        <div className="hidden md:block space-y-0.5">
                          {daySessions.slice(0, MAX_MINI_CARDS).map((session: any) => {
                            const colorIdx = getCourseColorIndex(session.class?.courseId || session.classId || '')
                            const color = COURSE_COLORS[colorIdx]
                            const cls = session.class
                            const teacher = session.teacher

                            return (
                              <Tooltip key={session.id}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      'text-[10px] px-1.5 py-0.5 rounded border-l-2 truncate cursor-default hover:brightness-95 transition-all',
                                      color.bg, color.border,
                                    )}
                                  >
                                    <span className="font-mono">{session.startTime}</span>{' '}
                                    <span className="font-medium">{cls?.name || ''}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-60 p-3">
                                  <div className="space-y-1.5">
                                    <p className="font-semibold text-sm">{cls?.name || ''}</p>
                                    {cls?.course && (
                                      <p className="text-xs text-muted-foreground">{cls.course.name}</p>
                                    )}
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      <span>{session.startTime} - {session.endTime}</span>
                                    </div>
                                    {teacher && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        <span>{t('parent.schedule.teacherAbbr', 'GV')}: {teacher.name}</span>
                                      </div>
                                    )}
                                    {session.room && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        <span>{t('parent.schedule.room', 'Phòng')} {session.room}</span>
                                      </div>
                                    )}
                                    <div className="pt-0.5">{statusBadge(session.status)}</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )
                          })}
                          {daySessions.length > MAX_MINI_CARDS && (
                            <div className="text-[10px] text-muted-foreground px-1.5 font-medium">
                              +{daySessions.length - MAX_MINI_CARDS} {t('parent.schedule.more', 'hơn')}
                            </div>
                          )}
                        </div>

                        {/* Mobile: show dots */}
                        <div className="md:hidden flex gap-0.5 flex-wrap px-1">
                          {daySessions.slice(0, 5).map((session: any) => {
                            const colorIdx = getCourseColorIndex(session.class?.courseId || session.classId || '')
                            return (
                              <div
                                key={session.id}
                                className={cn('w-1.5 h-1.5 rounded-full', COURSE_COLORS[colorIdx].dot)}
                              />
                            )
                          })}
                          {daySessions.length > 5 && (
                            <span className="text-[9px] text-muted-foreground leading-none mt-px">+{daySessions.length - 5}</span>
                          )}
                        </div>
                      </div>
                    </TooltipProvider>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">{t('parent.schedule.selectStudentToView', 'Chọn học sinh để xem lịch')}</p>
            <p className="text-sm text-muted-foreground/60 mt-1">{t('parent.schedule.selectStudentFromList', 'Vui lòng chọn học sinh từ danh sách ở trên')}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state when selected but no sessions */}
      {sessions.length === 0 && !loadingSessions && effectiveStudentId && (
        <EmptyState
          icon={CalendarDays}
          title={t('parent.schedule.noSessions', 'Không có buổi học')}
          description={t('parent.schedule.noSessionsDesc', 'Chưa có buổi học nào được lên lịch trong tháng này.')}
        />
      )}
    </motion.div>
  )
}
