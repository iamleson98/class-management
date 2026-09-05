'use client'

/**
 * Edit Session dialog — date/time/status/class/teacher/room/title with the
 * full teacher roster and the teacher-schedule conflict flow: a 409 from the
 * update renders the conflicting sessions inline with a force-retry
 * ("Lưu vẫn") after review.
 */

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, BookOpen, Trash2 } from 'lucide-react'

import { updateSessionSchema, type ClassListItem, type UpdateSessionInput, type SessionListItem } from '@/lib/schemas'
import { getUsers, getUserDisplayName, SessionConflictError, type SessionConflictItem } from '@/lib/api'
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
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'
import { TeacherConflictBanner } from './session-conflicts'

export function EditSessionDialog({
  session,
  classes,
  isLoadingClasses,
  isClassesError,
  onClose,
  submit,
  onDelete,
  isPending,
  isDeleting,
}: {
  session: SessionListItem
  classes: ClassListItem[]
  isLoadingClasses?: boolean
  isClassesError?: boolean
  onClose: () => void
  submit: (data: UpdateSessionInput & { force?: boolean }) => Promise<unknown>
  onDelete: () => void
  isPending: boolean
  isDeleting: boolean
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [conflicts, setConflicts] = useState<SessionConflictItem[]>([])
  const [lastPayload, setLastPayload] = useState<(UpdateSessionInput & { force?: boolean }) | null>(null)

  // Full teacher roster (the old dropdown rendered only the class-teacher
  // relation the backend never sends — an empty required select).
  const { data: teachersData, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['users-teachers'],
    queryFn: () => getUsers({ role: 'lms_teacher', staffOnly: true }),
  })
  const teachers = teachersData?.items ?? []

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

  const attempt = async (data: UpdateSessionInput & { force?: boolean }, force = false) => {
    setLastPayload(data)
    try {
      await submit(force ? { ...data, force: true } : data)
      // Parent invalidates, toasts and closes the dialog on success.
    } catch (err) {
      if (err instanceof SessionConflictError) {
        setConflicts(err.conflicts)
      } else {
        toast({
          title: (err as Error)?.message || t('schedule.updateFail', 'Cập nhật buổi học thất bại'),
          variant: 'destructive',
        })
      }
    }
  }

  const handleSubmit = (data: UpdateSessionInput) => {
    setConflicts([])
    void attempt(data)
  }

  const retryWithForce = () => {
    if (lastPayload) void attempt(lastPayload, true)
  }

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete()
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  const clearConflicts = () => setConflicts([])

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
              onChange={(v) => { form.setValue('date', v, { shouldValidate: true }); clearConflicts() }}
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
                onChange={(v) => { form.setValue('startTime', v, { shouldValidate: true }); clearConflicts() }}
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
                onChange={(v) => { form.setValue('endTime', v, { shouldValidate: true }); clearConflicts() }}
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
          </div>

          {/* Giáo viên */}
          <div className="space-y-1.5">
            <Label data-error={!!form.formState.errors.teacherId} className="data-[error=true]:text-destructive">{t('schedule.teacher', 'Giáo viên')}</Label>
            <Select value={watchedTeacherId || ''} onValueChange={(v) => { form.setValue('teacherId', v, { shouldValidate: true }); clearConflicts() }}>
              <SelectTrigger aria-invalid={!!form.formState.errors.teacherId || undefined}>
                <SelectValue placeholder={isLoadingTeachers ? t('common.loading', 'Đang tải...') : t('schedule.selectTeacherPlaceholder', 'Chọn giáo viên')} />
              </SelectTrigger>
              <SelectContent>
                {teachers.map(tc => (
                  <SelectItem key={tc.id} value={tc.id}>{getUserDisplayName(tc)}</SelectItem>
                ))}
                {/* The session's own teacher stays selectable even if absent from
                    the active roster (deactivated, role changed). */}
                {watchedTeacherId && !teachers.some(tc => tc.id === watchedTeacherId) && (
                  <SelectItem value={watchedTeacherId}>
                    {t('schedule.currentTeacher', 'Giáo viên hiện tại')}
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

          {/* Trùng lịch giáo viên (409) */}
          <TeacherConflictBanner
            conflicts={conflicts}
            onForce={retryWithForce}
            onDismiss={clearConflicts}
            actionLabel={t('schedule.conflictSaveAnyway', 'Vẫn lưu thay đổi')}
            isPending={isPending}
          />

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
