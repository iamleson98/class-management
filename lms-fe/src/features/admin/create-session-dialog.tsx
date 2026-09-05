'use client'

/**
 * Create Session dialog — date/time, class + teacher (full roster), room,
 * title, and the repeat control:
 *   - none                → single session (e.g. a makeup lesson, học bù)
 *   - weekly until class end (classes.end_date) or a chosen date
 * The server expands the series, checks the teacher's schedule and answers
 * 409 with the conflicting sessions — rendered by TeacherConflictBanner with
 * a force-retry after review.
 */

import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Plus } from 'lucide-react'

import { createSessionSchema, type ClassListItem } from '@/lib/schemas'
import {
  getUsers,
  getUserDisplayName,
  SessionConflictError,
  type SessionConflictItem,
  type SessionSubmitPayload,
} from '@/lib/api'
import {
  repeatRangeLabel,
  resolveRepeatUntil,
  weeklyOccurrenceCount,
  type RepeatMode,
} from '@/lib/schedule-utils'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { Button } from '@/components/ui/button'
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
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'
import { TeacherConflictBanner, formatConflictDate } from './session-conflicts'

export function CreateSessionDialog({
  open,
  onClose,
  classes,
  isLoadingClasses,
  isClassesError,
  submit,
  isPending,
}: {
  open: boolean
  onClose: () => void
  classes: ClassListItem[]
  isLoadingClasses?: boolean
  isClassesError?: boolean
  submit: (data: SessionSubmitPayload) => Promise<unknown>
  isPending: boolean
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
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

  // Full teacher roster: the teacher dropdown used to render ONLY the class
  // teacher relation — which the backend never serializes — leaving the
  // required select with zero options. Any teacher is now selectable, with
  // the class's teacher auto-picked.
  const { data: teachersData, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['users-teachers'],
    queryFn: () => getUsers({ role: 'lms_teacher', staffOnly: true }),
  })
  const teachers = teachersData?.items ?? []

  // ── Repeat + conflict state ──
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none')
  const [customUntil, setCustomUntil] = useState('')
  const [conflicts, setConflicts] = useState<SessionConflictItem[]>([])
  const lastPayloadRef = useRef<SessionSubmitPayload | null>(null)

  // Reset transient controls whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setConflicts([])
      setRepeatMode('none')
      setCustomUntil('')
      lastPayloadRef.current = null
    }
  }, [open])

  const watchedDate = useWatch({ control: form.control, name: 'date' })
  const watchedClassId = useWatch({ control: form.control, name: 'classId' })
  const watchedTeacherId = useWatch({ control: form.control, name: 'teacherId' })
  const selectedClass = classes.find(c => c.id === watchedClassId)
  const classEndDate = selectedClass?.endDate ?? null

  // Auto-fill teacher when class changes
  const prevClassIdRef = useRef<string | undefined>(watchedClassId)
  useEffect(() => {
    if (watchedClassId === prevClassIdRef.current) return
    prevClassIdRef.current = watchedClassId

    if (watchedClassId) {
      const cls = classes.find(c => c.id === watchedClassId)
      if (cls?.teacherId) {
        form.setValue('teacherId', cls.teacherId)
        setConflicts([])
      }
      if (cls?.course?.name) {
        form.setValue('title', cls.course.name)
      }
    }
  }, [watchedClassId, classes, form])

  const repeatUntil = resolveRepeatUntil(repeatMode, classEndDate, customUntil, watchedDate ?? '')
  const repeatCount = repeatUntil ? weeklyOccurrenceCount(watchedDate ?? '', repeatUntil) : 1
  const repeatIncomplete = repeatMode !== 'none' && !repeatUntil

  const attempt = async (payload: SessionSubmitPayload, force = false) => {
    lastPayloadRef.current = payload
    try {
      await submit(force ? { ...payload, force: true } : payload)
      // Parent invalidates, toasts and closes the dialog on success.
    } catch (err) {
      if (err instanceof SessionConflictError) {
        setConflicts(err.conflicts)
      } else {
        toast({
          title: (err as Error)?.message || t('schedule.createFail', 'Tạo buổi học thất bại'),
          variant: 'destructive',
        })
      }
    }
  }

  const handleSubmit = (data: CreateSessionFormValues) => {
    setConflicts([])
    const parsed = createSessionSchema.parse(data)
    const payload: SessionSubmitPayload = {
      ...parsed,
      repeatUntil: repeatMode === 'none' ? '' : repeatUntil,
    }
    void attempt(payload)
  }

  const retryWithForce = () => {
    if (lastPayloadRef.current) void attempt(lastPayloadRef.current, true)
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
              onChange={(v) => { form.setValue('date', v, { shouldValidate: true }); setConflicts([]) }}
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
                onChange={(v) => { form.setValue('startTime', v, { shouldValidate: true }); setConflicts([]) }}
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
                onChange={(v) => { form.setValue('endTime', v, { shouldValidate: true }); setConflicts([]) }}
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
                        <span className="text-muted-foreground text-xs">({c.code})</span>
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
            <Select value={watchedTeacherId || ''} onValueChange={(v) => { form.setValue('teacherId', v, { shouldValidate: true }); setConflicts([]) }}>
              <SelectTrigger aria-invalid={!!form.formState.errors.teacherId || undefined}>
                <SelectValue placeholder={isLoadingTeachers ? t('common.loading', 'Đang tải...') : t('schedule.selectTeacherPlaceholder', 'Chọn giáo viên')} />
              </SelectTrigger>
              <SelectContent>
                {teachers.length === 0 && !isLoadingTeachers && (
                  <SelectItem value="__none" disabled>
                    <span className="text-muted-foreground">{t('schedule.noTeachers', 'Chưa có giáo viên nào')}</span>
                  </SelectItem>
                )}
                {teachers.map(tc => (
                  <SelectItem key={tc.id} value={tc.id}>{getUserDisplayName(tc)}</SelectItem>
                ))}
                {/* Keep the auto-filled class teacher selectable even when it is
                    not in the active roster (e.g. deactivated account). */}
                {watchedTeacherId && !teachers.some(tc => tc.id === watchedTeacherId) && (
                  <SelectItem value={watchedTeacherId}>
                    {t('schedule.classTeacher', 'Giáo viên của lớp')}
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

          {/* Lặp lại */}
          <div className="space-y-1.5">
            <Label>{t('schedule.repeat', 'Lặp lại')}</Label>
            <Select value={repeatMode} onValueChange={(v) => setRepeatMode(v as RepeatMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('schedule.repeatNone', 'Không lặp lại (buổi học đơn)')}</SelectItem>
                <SelectItem value="weekly_until_class_end">
                  {classEndDate
                    ? t('schedule.repeatUntilClassEnd', `Hàng tuần đến hết thời gian lớp (${formatConflictDate(classEndDate)})`)
                    : t('schedule.repeatUntilClassEndNoDate', 'Hàng tuần đến hết thời gian lớp (lớp chưa có ngày kết thúc)')}
                </SelectItem>
                <SelectItem value="weekly_until_date">{t('schedule.repeatUntilDate', 'Hàng tuần đến ngày...')}</SelectItem>
              </SelectContent>
            </Select>
            {repeatMode === 'weekly_until_date' && (
              <DatePicker
                value={customUntil}
                onChange={(v) => setCustomUntil(v)}
                placeholder={t('schedule.repeatUntilPlaceholder', 'Chọn ngày kết thúc lặp lại')}
              />
            )}
            {repeatUntil && (
              <p className="text-xs text-muted-foreground">
                {t('schedule.repeatPreview', `Sẽ tạo ${repeatCount} buổi học`)} ({repeatRangeLabel(watchedDate ?? '', repeatUntil)})
              </p>
            )}
            {repeatIncomplete && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {repeatMode === 'weekly_until_class_end'
                  ? t('schedule.repeatNeedsClassEnd', 'Lớp chưa có ngày kết thúc — thêm trong "Sửa lớp học" hoặc chọn "đến ngày...".')
                  : t('schedule.repeatNeedsDate', 'Vui lòng chọn ngày kết thúc lặp lại (từ ngày học trở đi).')}
              </p>
            )}
          </div>

          {/* Trùng lịch giáo viên (409) */}
          <TeacherConflictBanner
            conflicts={conflicts}
            onForce={retryWithForce}
            onDismiss={() => setConflicts([])}
            actionLabel={t('schedule.conflictCreateAnyway', 'Vẫn tạo buổi học')}
            isPending={isPending}
          />

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel', 'Hủy')}
            </Button>
            <Button type="submit" disabled={isPending || repeatIncomplete} className="bg-sky-600 hover:bg-sky-700 text-white">
              {isPending ? t('common.loading', 'Đang tạo...') : t('schedule.createSession', 'Tạo buổi học')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
