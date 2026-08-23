'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  getHours,
  getMinutes,
  differenceInMinutes,
  parseISO,
} from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  MapPin,
  Users,
  BookOpen,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { getSessions, getClasses, createSession, updateSession, deleteSession } from '@/lib/api'
import { createSessionSchema, updateSessionSchema, type CreateSessionInput, type UpdateSessionInput, type SessionListItem, type ClassListItem } from '@/lib/schemas'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useTranslation } from '@/lib/i18n'

// ─── Constants ─────────────────────────────────────────────────────────

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const DAY_NAMES_FULL = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']

const COURSE_COLORS = [
  { bg: 'bg-sky-100 dark:bg-sky-900/30', border: 'border-l-sky-500', text: 'text-sky-700 dark:text-sky-400', dot: 'bg-sky-500' },
  { bg: 'bg-teal-100 dark:bg-teal-900/30', border: 'border-l-teal-500', text: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-500' },
  { bg: 'bg-violet-100 dark:bg-violet-900/30', border: 'border-l-violet-500', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-l-amber-500', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-l-rose-500', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
  { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-l-blue-500', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
]

const STATUS_CONFIG: Record<string, { label: string; variant: 'outline' | 'default' | 'destructive' }> = {
  SCHEDULED: { label: 'Sắp tới', variant: 'outline' },
  COMPLETED: { label: 'Hoàn thành', variant: 'default' },
  CANCELLED: { label: 'Đã hủy', variant: 'destructive' },
}

const WEEK_START_HOUR = 7
const WEEK_END_HOUR = 21
const TIME_SLOTS = Array.from({ length: (WEEK_END_HOUR - WEEK_START_HOUR) * 2 }, (_, i) => {
  const h = WEEK_START_HOUR + Math.floor(i / 2)
  const m = i % 2 === 0 ? 0 : 30
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const SLOT_HEIGHT = 24 // px per 30-min slot

// ─── Helpers ──────────────────────────────────────────────────────────

function getSessionColor(courseId: string, colorMap: Record<string, number>) {
  const idx = colorMap[courseId] ?? 0
  return COURSE_COLORS[idx % COURSE_COLORS.length]
}

function getWeekStartTimePosition(timeStr: string): number {
  const d = parseISO(`2024-01-01T${timeStr}:00`)
  const minsFromStart = (getHours(d) - WEEK_START_HOUR) * 60 + getMinutes(d)
  return (minsFromStart / 30) * SLOT_HEIGHT
}

function getWeekBlockHeight(startStr: string, endStr: string): number {
  const diff = differenceInMinutes(parseISO(`2024-01-01T${endStr}:00`), parseISO(`2024-01-01T${startStr}:00`))
  return (diff / 30) * SLOT_HEIGHT
}

// ─── Component ─────────────────────────────────────────────────────────

export default function AdminSchedule() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [createOpen, setCreateOpen] = useState(false)
  const [editSession, setEditSession] = useState<SessionListItem | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const monthStr = format(currentMonth, 'yyyy-MM')

  // ─── Queries ─────────────────────────────────────────────────────────

  const { data: sessions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['sessions', monthStr],
    // The sessions table has no `month` column — fetch all and filter to the
    // current month client-side.
    queryFn: () => getSessions(),
    select: (all) => all.filter((s) => (s.date || '').startsWith(monthStr)),
  })

  const { data: classes = [], isLoading: isLoadingClasses, isError: isClassesError } = useQuery({
    queryKey: ['classes-select'],
    queryFn: () => getClasses(),
  })

  // ─── Mutations ───────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: CreateSessionInput) => createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setCreateOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSessionInput }) => updateSession(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setEditSession(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setEditSession(null)
    },
  })

  // ─── Derived data ────────────────────────────────────────────────────

  const courseColorMap = useMemo(() => {
    const courseIds = [...new Set(sessions.map(s => s.class?.courseId).filter(Boolean) as string[])]
    const map: Record<string, number> = {}
    courseIds.forEach((id) => { map[id] = map[id] ?? 0; map[id]++ })
    return map
  }, [sessions])

  const monthSessionsMap = useMemo(() => {
    const map: Record<string, SessionListItem[]> = {}
    sessions.forEach(s => {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    })
    Object.values(map).forEach(arr => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)))
    return map
  }, [sessions])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = (() => {
    const end = endOfMonth(currentMonth)
    const weekEnd = addDays(startOfWeek(end, { weekStartsOn: 1 }), 6)
    return weekEnd > end ? weekEnd : end
  })()
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Stats
  const totalSessions = sessions.length
  const completedSessions = sessions.filter(s => s.status === 'COMPLETED').length
  const upcomingSessions = sessions.filter(s => s.status === 'SCHEDULED').length

  // ─── Handlers ────────────────────────────────────────────────────────

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1))
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1))
  const handleToday = () => setCurrentMonth(new Date())

  const handleDayClick = useCallback((day: Date) => {
    setSelectedDate(day)
  }, [])

  const handleSessionClick = useCallback((e: React.MouseEvent, session: SessionListItem) => {
    e.stopPropagation()
    setEditSession(session)
  }, [])

  // ─── Loading ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <PageHeader
          title={t('schedule.title', 'Thời khóa biểu')}
          description={t('schedule.description', 'Quản lý lịch học và buổi dạy')}
          icon={CalendarDays}
          accentColor="sky"
          actions={
            <div className="flex items-center gap-3">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'week')}>
                <TabsList>
                  <TabsTrigger value="month">{t('schedule.month', 'Tháng')}</TabsTrigger>
                  <TabsTrigger value="week" className="hidden lg:inline-flex">{t('schedule.week', 'Tuần')}</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button onClick={() => setCreateOpen(true)} className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5">
                <Plus className="h-4 w-4" />
                {t('schedule.createSession', 'Tạo buổi học')}
              </Button>
            </div>
          }
        />

        {/* ── Stats Bar ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { icon: CalendarDays, label: t('schedule.totalSessions', 'Tổng buổi học'), value: totalSessions, accent: 'sky' },
            { icon: CheckCircle, label: t('schedule.completed', 'Hoàn thành'), value: completedSessions, accent: 'sky' },
            { icon: Clock, label: t('schedule.upcoming', 'Sắp tới'), value: upcomingSessions, accent: 'sky' },
          ].map((stat) => (
            <Card key={stat.label} className="border-sky-100 dark:border-sky-900/40">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 shrink-0">
                  <stat.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold text-foreground leading-tight">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* ── Month Navigation ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-45 text-center capitalize">
              {t('schedule.monthLabel', 'Tháng')} {format(currentMonth, 'M/yyyy', { locale: vi })}
            </h2>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleToday} className="ml-1 text-sky-600">
              {t('schedule.today', 'Hôm nay')}
            </Button>
          </div>
        </div>

        {/* ── Main Content Area ─────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode === 'month' ? `month-${monthStr}` : `week-${monthStr}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
          >
            {viewMode === 'month' ? (
              <MonthView
                currentMonth={currentMonth}
                calendarDays={calendarDays}
                monthSessionsMap={monthSessionsMap}
                courseColorMap={courseColorMap}
                onDayClick={handleDayClick}
                onSessionClick={handleSessionClick}
              />
            ) : (
              <WeekView
                weekDays={weekDays}
                sessions={sessions}
                courseColorMap={courseColorMap}
                onSessionClick={handleSessionClick}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Empty State ──────────────────────────────────────────────── */}
        {sessions.length === 0 && !isLoading && (
          <EmptyState
            icon={CalendarDays}
            title={t('schedule.noSessions', 'Không có buổi học')}
            description={t('schedule.noSessionsDesc', 'Chưa có buổi học được lên lịch trong tháng này.')}
          />
        )}

        {/* ── Day Detail Sheet ──────────────────────────────────────────── */}
        {selectedDate && (
          <DayDetailSheet
            date={selectedDate}
            sessions={monthSessionsMap[format(selectedDate, 'yyyy-MM-dd')] ?? []}
            courseColorMap={courseColorMap}
            onClose={() => setSelectedDate(null)}
            onSessionClick={handleSessionClick}
          />
        )}

        {/* ── Create Session Dialog ─────────────────────────────────────── */}
        <CreateSessionDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          classes={classes}
          isLoadingClasses={isLoadingClasses}
          isClassesError={isClassesError}
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />

        {/* ── Edit Session Dialog ───────────────────────────────────────── */}
        {editSession && (
          <EditSessionDialog
            session={editSession}
            classes={classes}
            isLoadingClasses={isLoadingClasses}
            isClassesError={isClassesError}
            onClose={() => setEditSession(null)}
            onSubmit={(data) => updateMutation.mutate({ id: editSession.id, data })}
            onDelete={() => deleteMutation.mutate(editSession.id)}
            isPending={updateMutation.isPending}
            isDeleting={deleteMutation.isPending}
          />
        )}
      </motion.div>
    </TooltipProvider>
  )
}

// ─── Month View ────────────────────────────────────────────────────────

function MonthView({
  currentMonth,
  calendarDays,
  monthSessionsMap,
  courseColorMap,
  onDayClick,
  onSessionClick,
}: {
  currentMonth: Date
  calendarDays: Date[]
  monthSessionsMap: Record<string, SessionListItem[]>
  courseColorMap: Record<string, number>
  onDayClick: (day: Date) => void
  onSessionClick: (e: React.MouseEvent, session: SessionListItem) => void
}) {
  const { t } = useTranslation()
  const MAX_VISIBLE = 2

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={cn(
              'text-center text-xs font-semibold text-muted-foreground py-2',
              i >= 5 && 'text-rose-500/70'
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border">
        {calendarDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const daySessions = monthSessionsMap[dateStr] ?? []
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isTodayDate = isToday(day)
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const dayOfWeek = (day.getDay() + 6) % 7 // 0=Mon ... 6=Sun

          return (
            <div
              key={dateStr}
              onClick={() => onDayClick(day)}
              className={cn(
                'min-h-25 lg:min-h-30 p-1.5 bg-background cursor-pointer transition-colors hover:bg-muted/40 relative',
                !isCurrentMonth && 'opacity-30',
                isWeekend && isCurrentMonth && 'bg-muted/20',
                isTodayDate && 'ring-2 ring-inset ring-sky-500 bg-sky-50/50 dark:bg-sky-950/20'
              )}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-sm font-medium inline-flex items-center justify-center h-6 w-6 rounded-full',
                    isTodayDate && 'bg-sky-500 text-white',
                    !isCurrentMonth && 'text-muted-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {isTodayDate && (
                  <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                    {t('schedule.today', 'Hôm nay')}
                  </span>
                )}
              </div>

              {/* Session cards - Desktop */}
              <div className="hidden lg:flex flex-col gap-0.5">
                {daySessions.slice(0, MAX_VISIBLE).map((session) => {
                  const color = getSessionColor(session.class?.courseId ?? '', courseColorMap)
                  return (
                    <Tooltip key={session.id}>
                      <TooltipTrigger asChild>
                        <div
                          onClick={(e) => onSessionClick(e, session)}
                          className={cn(
                            'px-1.5 py-1 rounded text-xs border-l-2 cursor-pointer transition-colors hover:opacity-80 truncate',
                            color.bg,
                            color.border,
                            color.text
                          )}
                        >
                          <span className="font-mono text-[10px] opacity-80">{session.startTime}</span>
                          {' '}
                          <span className="font-medium truncate">{session.class?.name ?? session.title ?? ''}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-60">
                        <p className="font-semibold">{session.title || session.class?.course?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.class?.name} &middot; {session.startTime} - {session.endTime}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.teacher?.name}
                        </p>
                        {session.room && (
                          <p className="text-xs text-muted-foreground">
                            <MapPin className="inline h-3 w-3 mr-0.5" />{session.room}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
                {daySessions.length > MAX_VISIBLE && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{daySessions.length - MAX_VISIBLE} {t('schedule.more', 'hơn')}
                  </span>
                )}
              </div>

              {/* Session dots - Mobile */}
              <div className="flex lg:hidden flex-wrap gap-1 mt-0.5">
                {daySessions.slice(0, 4).map((session) => {
                  const color = getSessionColor(session.class?.courseId ?? '', courseColorMap)
                  return (
                    <span
                      key={session.id}
                      className={cn('h-1.5 w-1.5 rounded-full', color.dot)}
                    />
                  )
                })}
                {daySessions.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{daySessions.length - 4}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Week View ───────────────────────────────────────────────────────────

function WeekView({
  weekDays,
  sessions,
  courseColorMap,
  onSessionClick,
}: {
  weekDays: Date[]
  sessions: SessionListItem[]
  courseColorMap: Record<string, number>
  onSessionClick: (e: React.MouseEvent, session: SessionListItem) => void
}) {
  const { t } = useTranslation()
  const totalHeight = (WEEK_END_HOUR - WEEK_START_HOUR) * 2 * SLOT_HEIGHT

  const sessionsByDay = useMemo(() => {
    const map: Record<string, SessionListItem[]> = {}
    weekDays.forEach(d => { map[format(d, 'yyyy-MM-dd')] = [] })
    sessions.forEach(s => {
      if (map[s.date]) map[s.date].push(s)
    })
    Object.values(map).forEach(arr => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)))
    return map
  }, [sessions, weekDays])

  return (
    <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
      <div className="min-w-200">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
          <div className="border-r p-2 text-center text-xs text-muted-foreground">
            {t('schedule.hour', 'Giờ')}
          </div>
          {weekDays.map((day, i) => {
            const isTodayDate = isToday(day)
            return (
              <div
                key={i}
                className={cn(
                  'border-r last:border-r-0 text-center py-2',
                  isTodayDate && 'bg-sky-500/10'
                )}
              >
                <p className={cn(
                  'text-[10px] font-semibold uppercase',
                  i >= 5 ? 'text-rose-500/70' : 'text-muted-foreground'
                )}>
                  {DAY_LABELS[i]}
                </p>
                <p className={cn(
                  'text-lg font-bold leading-tight',
                  isTodayDate ? 'text-sky-600' : 'text-foreground'
                )}>
                  {format(day, 'd')}
                </p>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ height: totalHeight }}>
          {/* Time labels column */}
          <div className="border-r relative">
            {TIME_SLOTS.map((t) => (
              <div
                key={t}
                className="absolute right-2 text-[10px] text-muted-foreground font-mono -translate-y-1/2"
                style={{ top: TIME_SLOTS.indexOf(t) * SLOT_HEIGHT + SLOT_HEIGHT / 2 }}
              >
                {t}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, colIdx) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const daySessions = sessionsByDay[dateStr] ?? []
            const isTodayDate = isToday(day)

            return (
              <div
                key={colIdx}
                className={cn(
                  'border-r last:border-r-0 relative',
                  isTodayDate && 'bg-sky-500/5'
                )}
              >
                {/* Horizontal grid lines */}
                {TIME_SLOTS.map((t) => (
                  <div
                    key={t}
                    className="absolute left-0 right-0 border-t border-border/40"
                    style={{ top: TIME_SLOTS.indexOf(t) * SLOT_HEIGHT }}
                  />
                ))}

                {/* Session blocks */}
                {daySessions.map((session) => {
                  const color = getSessionColor(session.class?.courseId ?? '', courseColorMap)
                  const top = getWeekStartTimePosition(session.startTime)
                  const height = Math.max(getWeekBlockHeight(session.startTime, session.endTime), SLOT_HEIGHT)
                  return (
                    <Tooltip key={session.id}>
                      <TooltipTrigger asChild>
                        <div
                          onClick={(e) => onSessionClick(e, session)}
                          className={cn(
                            'absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 text-xs cursor-pointer transition-opacity hover:opacity-80 overflow-hidden border-l-2',
                            color.bg,
                            color.border,
                            color.text
                          )}
                          style={{ top, height }}
                        >
                          <p className="font-semibold truncate text-[11px] leading-tight">
                            {session.class?.name ?? session.title ?? ''}
                          </p>
                          {height > 36 && (
                            <>
                              <p className="text-[10px] opacity-80 truncate">{session.teacher?.name}</p>
                              <p className="text-[10px] opacity-80 truncate">{session.startTime} - {session.endTime}</p>
                            </>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-55">
                        <p className="font-semibold">{session.title || session.class?.course?.name}</p>
                        <p className="text-xs">{session.class?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.startTime} - {session.endTime}
                        </p>
                        <p className="text-xs text-muted-foreground">{session.teacher?.name}</p>
                        {session.room && (
                          <p className="text-xs text-muted-foreground">{session.room}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Day Detail Sheet ───────────────────────────────────────────────────

function DayDetailSheet({
  date,
  sessions,
  courseColorMap,
  onClose,
  onSessionClick,
}: {
  date: Date
  sessions: SessionListItem[]
  courseColorMap: Record<string, number>
  onClose: () => void
  onSessionClick: (e: React.MouseEvent, session: SessionListItem) => void
}) {
  const { t } = useTranslation()
  const dayOfWeekIdx = (date.getDay() + 6) % 7

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-sky-600" />
            <span className="capitalize">
              {DAY_NAMES_FULL[dayOfWeekIdx]}, {format(date, 'd')} {t('schedule.monthWord', 'tháng')} {format(date, 'M')}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('schedule.noSessionsToday', 'Không có buổi học trong ngày này.')}
            </p>
          ) : (
            <AnimatePresence>
              {sessions.map((session, i) => {
                const color = getSessionColor(session.class?.courseId ?? '', courseColorMap)
                const statusCfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.SCHEDULED
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                    onClick={(e) => onSessionClick(e, session)}
                    className={cn(
                      'p-3.5 rounded-xl border border-border/60 cursor-pointer transition-colors hover:bg-muted/40',
                      'border-l-4',
                      color.border
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {session.title || session.class?.course?.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {session.class?.name} &middot; {session.class?.course?.name}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.startTime} - {session.endTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {session.teacher?.name}
                          </span>
                        </div>
                        {session.room && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.room}
                          </p>
                        )}
                      </div>
                      <Badge variant={statusCfg.variant} className="shrink-0 text-[10px]">
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Create Session Dialog ──────────────────────────────────────────────

function CreateSessionDialog({
  open,
  onClose,
  classes,
  isLoadingClasses,
  isClassesError,
  onSubmit,
  isPending,
}: {
  open: boolean
  onClose: () => void
  classes: ClassListItem[]
  isLoadingClasses?: boolean
  isClassesError?: boolean
  onSubmit: (data: CreateSessionInput) => void
  isPending: boolean
}) {
  const { t } = useTranslation()
  type CreateSessionFormValues = z.input<typeof createSessionSchema>

  const form = useForm<CreateSessionFormValues>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: {
      title: '',
      date: '',
      startTime: '08:00',
      endTime: '09:30',
      room: '',
      classId: '',
      teacherId: '',
    },
  })

  const watchedDate = useWatch({ control: form.control, name: 'date' })
  const watchedClassId = useWatch({ control: form.control, name: 'classId' })
  const watchedTeacherId = useWatch({ control: form.control, name: 'teacherId' })
  const selectedClassId = watchedClassId
  const selectedClass = classes.find(c => c.id === selectedClassId)

  // Auto-fill teacher when class changes
  const prevClassIdRef = useRef<string | undefined>(watchedClassId)
  useEffect(() => {
    if (watchedClassId === prevClassIdRef.current) return
    prevClassIdRef.current = watchedClassId

    if (watchedClassId) {
      const cls = classes.find(c => c.id === watchedClassId)
      if (cls?.teacherId) {
        form.setValue('teacherId', cls.teacherId)
      }
      if (cls?.course?.name) {
        form.setValue('title', cls.course.name)
      }
    }
  }, [watchedClassId, classes, form])

  const handleSubmit = (data: CreateSessionFormValues) => {
    onSubmit(createSessionSchema.parse(data))
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-sky-600" />
            {t('schedule.createSessionTitle', 'Tạo buổi học mới')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-2">
          {/* Ngày học */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.date} className="data-[error=true]:text-destructive">{t('schedule.sessionDate', 'Ngày học')} <span className="text-destructive">*</span></Label>
            <DatePicker
              value={watchedDate}
              onChange={(v) => form.setValue('date', v, { shouldValidate: true })}
              invalid={!!form.formState.errors.date}
            />
            {form.formState.errors.date && (
              <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
            )}
          </div>

          {/* Thời gian */}
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <Label data-error={!!form.formState.errors.startTime} className="data-[error=true]:text-destructive">{t('schedule.startTime', 'Giờ bắt đầu')} <span className="text-destructive">*</span></Label>
              <TimePicker
                value={form.watch('startTime') ?? ''}
                onChange={(v) => form.setValue('startTime', v, { shouldValidate: true })}
                invalid={!!form.formState.errors.startTime}
              />
              {form.formState.errors.startTime && (
                <p className="text-xs text-destructive">{form.formState.errors.startTime.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label data-error={!!form.formState.errors.endTime} className="data-[error=true]:text-destructive">{t('schedule.endTime', 'Giờ kết thúc')} <span className="text-destructive">*</span></Label>
              <TimePicker
                value={form.watch('endTime') ?? ''}
                onChange={(v) => form.setValue('endTime', v, { shouldValidate: true })}
                invalid={!!form.formState.errors.endTime}
              />
              {form.formState.errors.endTime && (
                <p className="text-xs text-destructive">{form.formState.errors.endTime.message}</p>
              )}
            </div>
          </div>

          {/* Lớp học */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.classId} className="data-[error=true]:text-destructive">{t('schedule.className', 'Lớp học')} <span className="text-destructive">*</span></Label>
            <Select value={watchedClassId || ''} onValueChange={(v) => form.setValue('classId', v, { shouldValidate: true })}>
              <SelectTrigger aria-invalid={!!form.formState.errors.classId || undefined}>
                {isLoadingClasses ? (
                  <SelectValue placeholder={t('common.loading', 'Đang tải...')} />
                ) : (
                  <SelectValue placeholder={t('schedule.selectClassPlaceholder', 'Chọn lớp học')} />
                )}
              </SelectTrigger>
              <SelectContent>
                {isClassesError ? (
                  <SelectItem value="__error" disabled>
                    <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                  </SelectItem>
                ) : (
                  classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-3 w-3 text-muted-foreground" />
                        {c.name}
                        <span className="text-muted-foreground text-xs">({c.course?.name})</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {form.formState.errors.classId && (
              <p className="text-xs text-destructive">{form.formState.errors.classId.message}</p>
            )}
          </div>

          {/* Giáo viên */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.teacherId} className="data-[error=true]:text-destructive">{t('schedule.teacher', 'Giáo viên')} <span className="text-destructive">*</span></Label>
            <Select value={watchedTeacherId || ''} onValueChange={(v) => form.setValue('teacherId', v, { shouldValidate: true })}>
              <SelectTrigger aria-invalid={!!form.formState.errors.teacherId || undefined}>
                <SelectValue placeholder={t('schedule.selectTeacherPlaceholder', 'Chọn giáo viên')} />
              </SelectTrigger>
              <SelectContent>
                {selectedClass?.teacher && (
                  <SelectItem value={selectedClass.teacher.id}>
                    {selectedClass.teacher.name}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {form.formState.errors.teacherId && (
              <p className="text-xs text-destructive">{form.formState.errors.teacherId.message}</p>
            )}
          </div>

          {/* Phòng học */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.room} className="data-[error=true]:text-destructive">{t('schedule.room', 'Phòng học')}</Label>
            <Input placeholder={t('schedule.roomPlaceholder', 'Nhập phòng học (tùy chọn)')} aria-invalid={!!form.formState.errors.room || undefined} {...form.register('room')} />
          </div>

          {/* Tiêu đề */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.title} className="data-[error=true]:text-destructive">{t('schedule.sessionTitle', 'Tiêu đề')}</Label>
            <Input placeholder={t('schedule.sessionTitlePlaceholder', 'Tên buổi học (mặc định: tên khóa học)')} aria-invalid={!!form.formState.errors.title || undefined} {...form.register('title')} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel', 'Hủy')}
            </Button>
            <Button type="submit" disabled={isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
              {isPending ? t('common.loading', 'Đang tạo...') : t('schedule.createSession', 'Tạo buổi học')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Session Dialog ───────────────────────────────────────────────

function EditSessionDialog({
  session,
  classes,
  isLoadingClasses,
  isClassesError,
  onClose,
  onSubmit,
  onDelete,
  isPending,
  isDeleting,
}: {
  session: SessionListItem
  classes: ClassListItem[]
  isLoadingClasses?: boolean
  isClassesError?: boolean
  onClose: () => void
  onSubmit: (data: UpdateSessionInput) => void
  onDelete: () => void
  isPending: boolean
  isDeleting: boolean
}) {
  const { t } = useTranslation()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useForm<UpdateSessionInput>({
    resolver: zodResolver(updateSessionSchema),
    defaultValues: {
      title: session.title ?? '',
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      room: session.room ?? '',
      classId: session.classId,
      teacherId: session.teacherId,
      status: session.status as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED',
    },
  })

  const watchedDate = useWatch({ control: form.control, name: 'date' })
  const watchedStatus = useWatch({ control: form.control, name: 'status' })
  const watchedClassId = useWatch({ control: form.control, name: 'classId' })
  const watchedTeacherId = useWatch({ control: form.control, name: 'teacherId' })

  const selectedClass = classes.find(c => c.id === watchedClassId)

  const handleSubmit = (data: UpdateSessionInput) => {
    onSubmit(data)
  }

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete()
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  return (
    <Dialog open={!!session} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-sky-600" />
            {t('schedule.editSession', 'Chỉnh sửa buổi học')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-2">
          {/* Ngày học */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.date} className="data-[error=true]:text-destructive">{t('schedule.sessionDate', 'Ngày học')}</Label>
            <DatePicker
              value={watchedDate}
              onChange={(v) => form.setValue('date', v)}
              invalid={!!form.formState.errors.date}
            />
            {form.formState.errors.date && (
              <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
            )}
          </div>

          {/* Thời gian */}
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <Label data-error={!!form.formState.errors.startTime} className="data-[error=true]:text-destructive">{t('schedule.startTime', 'Giờ bắt đầu')}</Label>
              <TimePicker
                value={form.watch('startTime') ?? ''}
                onChange={(v) => form.setValue('startTime', v, { shouldValidate: true })}
                invalid={!!form.formState.errors.startTime}
              />
              {form.formState.errors.startTime && (
                <p className="text-xs text-destructive">{form.formState.errors.startTime.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label data-error={!!form.formState.errors.endTime} className="data-[error=true]:text-destructive">{t('schedule.endTime', 'Giờ kết thúc')}</Label>
              <TimePicker
                value={form.watch('endTime') ?? ''}
                onChange={(v) => form.setValue('endTime', v, { shouldValidate: true })}
                invalid={!!form.formState.errors.endTime}
              />
              {form.formState.errors.endTime && (
                <p className="text-xs text-destructive">{form.formState.errors.endTime.message}</p>
              )}
            </div>
          </div>

          {/* Trạng thái */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.status} className="data-[error=true]:text-destructive">{t('common.status', 'Trạng thái')}</Label>
            <Select
              value={watchedStatus || 'SCHEDULED'}
              onValueChange={(v) => form.setValue('status', v as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED')}
            >
              <SelectTrigger aria-invalid={!!form.formState.errors.status || undefined}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SCHEDULED">{t('schedule.statusScheduled', 'Sắp tới')}</SelectItem>
                <SelectItem value="COMPLETED">{t('schedule.statusCompleted', 'Hoàn thành')}</SelectItem>
                <SelectItem value="CANCELLED">{t('schedule.statusCancelled', 'Đã hủy')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lớp học */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.classId} className="data-[error=true]:text-destructive">{t('schedule.className', 'Lớp học')}</Label>
            <Select value={watchedClassId || ''} onValueChange={(v) => form.setValue('classId', v)}>
              <SelectTrigger aria-invalid={!!form.formState.errors.classId || undefined}>
                {isLoadingClasses ? (
                  <SelectValue placeholder={t('common.loading', 'Đang tải...')} />
                ) : (
                  <SelectValue placeholder={t('schedule.selectClassPlaceholder', 'Chọn lớp học')} />
                )}
              </SelectTrigger>
              <SelectContent>
                {isClassesError ? (
                  <SelectItem value="__error" disabled>
                    <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                  </SelectItem>
                ) : (
                  classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-3 w-3 text-muted-foreground" />
                        {c.name}
                        <span className="text-muted-foreground text-xs">({c.course?.name})</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Giáo viên */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.teacherId} className="data-[error=true]:text-destructive">{t('schedule.teacher', 'Giáo viên')}</Label>
            <Select value={watchedTeacherId || ''} onValueChange={(v) => form.setValue('teacherId', v)}>
              <SelectTrigger aria-invalid={!!form.formState.errors.teacherId || undefined}>
                <SelectValue placeholder={t('schedule.selectTeacherPlaceholder', 'Chọn giáo viên')} />
              </SelectTrigger>
              <SelectContent>
                {selectedClass?.teacher && (
                  <SelectItem value={selectedClass.teacher.id}>
                    {selectedClass.teacher.name}
                  </SelectItem>
                )}
                {/* Also show the original teacher if different class */}
                {!selectedClass?.teacher && session.teacher && (
                  <SelectItem value={session.teacher.id}>
                    {session.teacher.name}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Phòng học */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.room} className="data-[error=true]:text-destructive">{t('schedule.room', 'Phòng học')}</Label>
            <Input placeholder={t('schedule.roomPlaceholderEdit', 'Nhập phòng học')} aria-invalid={!!form.formState.errors.room || undefined} {...form.register('room')} />
          </div>

          {/* Tiêu đề */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.title} className="data-[error=true]:text-destructive">{t('schedule.sessionTitle', 'Tiêu đề')}</Label>
            <Input placeholder={t('schedule.sessionTitlePlaceholderEdit', 'Tên buổi học')} aria-invalid={!!form.formState.errors.title || undefined} {...form.register('title')} />
          </div>

          <DialogFooter className="pt-2 flex-row gap-2 justify-between sm:justify-end">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="gap-1.5 mr-auto"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmDelete ? t('common.confirm', 'Xác nhận xóa?') : t('common.delete', 'Xóa')}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel', 'Hủy')}
              </Button>
              <Button type="submit" disabled={isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                {isPending ? t('common.loading', 'Đang lưu...') : t('common.update', 'Lưu thay đổi')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
