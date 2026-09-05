'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PaginationState } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import {
  BookOpen, Plus, Search, Eye, Trash2, Users, Upload, CheckCircle,
} from 'lucide-react'
import {
  getHomeworkPaginated, createHomework, deleteHomework,
  bulkAssignHomework, getHomeworkSubmissions, getClasses, getStudents,
  upsertHomeworkSubmission,
} from '@/lib/api'
import { uploadLmsFile } from '@/lib/file-upload'
import { eq, contains, and, or, paginate } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { DataTable } from '@/components/data-table'
import { createHomeworkColumns, type HomeworkRow } from './homework-columns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

// ── Schema ──────────────────────────────────────────────────────────
// Backend lms_models.Homework has no file_url/file_name — only file_id.
// courseName/teacherName are display-only convenience fields (phantom on the
// backend) and are stripped at the submit boundary in buildHomeworkPayload.
const homeworkSchema = z.object({
  title: z.string().min(1, 'Vui lòng nhập tiêu đề'),
  description: z.string().optional().default(''),
  classId: z.string().min(1, 'Vui lòng chọn lớp'),
  courseId: z.string().optional().default(''),
  courseName: z.string().optional().default(''),
  teacherId: z.string().optional().default(''),
  teacherName: z.string().optional().default(''),
  sessionId: z.string().optional().default(''),
  deadline: z.string().min(1, 'Vui lòng chọn hạn nộp'),
  fileId: z.string().optional().default(''),
})

type HomeworkFormValues = z.input<typeof homeworkSchema>

const bulkHomeworkSchema = homeworkSchema.extend({
  studentIds: z.array(z.string()).min(1, 'Vui lòng chọn ít nhất một học viên'),
})

type BulkHomeworkFormValues = z.input<typeof bulkHomeworkSchema>

// Strip display-only fields before sending to the backend. The backend
// lms_models.Homework only has: title, description, session_id, class_id,
// course_id, teacher_id, deadline, file_id. courseName/teacherName are
// frontend display conveniences and are silently dropped by the backend.
function buildHomeworkPayload(values: HomeworkFormValues) {
  const { courseName, teacherName, ...payload } = values
  return payload
}
function buildBulkHomeworkPayload(values: BulkHomeworkFormValues) {
  const { courseName, teacherName, ...payload } = values
  return payload
}

// const gradeSchema = z.object({
//   studentId: z.string(),
//   grade: z.string().optional().default(''),
//   feedback: z.string().optional().default(''),
// })

// type GradeFormValues = z.input<typeof gradeSchema>

// ── Status helpers ──────────────────────────────────────────────────
// Status helpers live in homework-columns.tsx (HOMEWORK_STATUS_MAP, getHomeworkStatus)

// ── Component ────────────────────────────────────────────────────────
export default function AdminHomework() {
  const { toast } = useToast()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // States
  const [search, setSearch] = useState('')
  const [filterClassId, setFilterClassId] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedHomework, setSelectedHomework] = useState<HomeworkRow | null>(null)
  const [gradeValues, setGradeValues] = useState<Record<string, { grade: string; feedback: string }>>({})
  const [fileName, setFileName] = useState('')
  const [bulkFileName, setBulkFileName] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  // Forms
  const form = useForm<HomeworkFormValues>({
    resolver: zodResolver(homeworkSchema),
    defaultValues: {
      title: '', description: '', classId: '', courseId: '', courseName: '',
      teacherId: '', teacherName: '', sessionId: '', deadline: '', fileId: '',
    },
  })

  const bulkForm = useForm<BulkHomeworkFormValues>({
    resolver: zodResolver(bulkHomeworkSchema),
    defaultValues: {
      title: '', description: '', classId: '', courseId: '', courseName: '',
      teacherId: '', teacherName: '', sessionId: '', deadline: '',
      fileId: '', studentIds: [],
    },
  })

  // Filters reset to page 0 directly in their change handlers.
  const onSearchChange = (value: string) => {
    setSearch(value)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }

  const onFilterClassChange = (value: string) => {
    setFilterClassId(value === '__all__' ? '' : value)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }

  // Build the typed SearchOpts body. HomeworkFilterOpts has NO top-level
  // search field, so text search is expressed as an ILIKE on homeworks.title
  // via contains(), and the class filter is an EQ on homeworks.class_id.
  const opts = useMemo(() => ({
    where_ands: and(eq('homeworks.class_id', filterClassId)),
    where_ors: or(contains('homeworks.title', search)),
    ...paginate(pagination.pageIndex, pagination.pageSize),
  }), [search, filterClassId, pagination.pageIndex, pagination.pageSize])

  // ── Queries ─────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['homework', opts],
    queryFn: () => getHomeworkPaginated(opts),
  })

  const { data: classes = [], isLoading: isLoadingClasses, isError: isClassesError, refetch: refetchClasses } = useQuery({
    queryKey: ['classes', 'all'],
    queryFn: () => getClasses(),
  })

  // const { data: selectedClassStudents = [] } = useQuery({
  //   queryKey: ['students', form.watch('classId')],
  //   queryFn: () => getStudents({ classId: form.watch('classId') }),
  //   enabled: !!form.watch('classId'),
  // })

  const { data: bulkClassStudents = [], isLoading: isLoadingBulkStudents, isError: isBulkStudentsError } = useQuery({
    queryKey: ['students', bulkForm.watch('classId')],
    queryFn: () => getStudents({ class_id: bulkForm.watch('classId') }),
    enabled: !!bulkForm.watch('classId'),
  })

  const { data: submissions = [], isLoading: submissionsLoading, isError: isSubmissionsError, refetch: refetchSubmissions } = useQuery({
    queryKey: ['homework-submissions', selectedHomework?.id],
    queryFn: () => selectedHomework ? getHomeworkSubmissions(selectedHomework.id) : Promise.resolve([]),
    enabled: !!selectedHomework?.id && detailDialogOpen,
  })

  // ── Auto-fill when class selected ──────────────────────────────
  const watchedClassId = form.watch('classId')
  const selectedClass = useMemo(
    () => classes.find((c: any) => c.id === watchedClassId),
    [classes, watchedClassId],
  )

  // ── Mutations ─────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: HomeworkFormValues) => createHomework(buildHomeworkPayload(data) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] })
      toast({ title: t('homework.assignSuccess', 'Giao bài tập thành công') })
      setCreateDialogOpen(false)
      form.reset()
      setFileName('')
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('homework.assignFailed', 'Giao bài tập thất bại'), variant: 'destructive' }),
  })

  const bulkCreateMutation = useMutation({
    mutationFn: (data: BulkHomeworkFormValues) => bulkAssignHomework(buildBulkHomeworkPayload(data) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] })
      toast({ title: t('homework.bulkAssignSuccess', 'Giao bài tập hàng loạt thành công') })
      setBulkDialogOpen(false)
      bulkForm.reset()
      setBulkFileName('')
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('homework.assignFailed', 'Giao bài tập thất bại'), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteHomework(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] })
      toast({ title: t('homework.deleteSuccess', 'Xóa bài tập thành công') })
      setDeleteDialogOpen(false)
      setSelectedHomework(null)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('homework.deleteFailed', 'Xóa bài tập thất bại'), variant: 'destructive' }),
  })

  const gradeMutation = useMutation({
    // The submissions table has NO grade column — only feedback is persisted.
    // The backend upsert REPLACES the whole row, so merge the feedback onto
    // the EXISTING submission (otherwise the student's file/description
    // would be wiped by the update).
    mutationFn: ({ homeworkId, submission, feedback }: { homeworkId: string; submission: any; feedback: string }) =>
      upsertHomeworkSubmission(homeworkId, {
        studentId: submission.studentId,
        title: submission.title ?? '',
        description: submission.description ?? '',
        fileId: submission.fileId ?? '',
        feedback,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['homework'] })
      toast({ title: t('homework.gradeSuccess', 'Chấm điểm thành công') })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('homework.gradeFailed', 'Chấm điểm thất bại'), variant: 'destructive' }),
  })

  // ── Handlers ────────────────────────────────────────────────────
  const openCreate = () => {
    form.reset({
      title: '', description: '', classId: '', courseId: '', courseName: '',
      teacherId: '', teacherName: '', sessionId: '', deadline: '', fileId: '',
    })
    setFileName('')
    setCreateDialogOpen(true)
  }

  const openBulkCreate = () => {
    bulkForm.reset({
      title: '', description: '', classId: '', courseId: '', courseName: '',
      teacherId: '', teacherName: '', sessionId: '', deadline: '',
      fileId: '', studentIds: [],
    })
    setBulkFileName('')
    setBulkDialogOpen(true)
  }

  const openDetail = (hw: HomeworkRow) => {
    setSelectedHomework(hw)
    setGradeValues({})
    setDetailDialogOpen(true)
  }

  const openDelete = (hw: HomeworkRow) => {
    setSelectedHomework(hw)
    setDeleteDialogOpen(true)
  }

  const columns = useMemo(
    () => createHomeworkColumns(t, { onView: openDetail, onDelete: openDelete }),
    [t, openDetail, openDelete]
  )

  const [uploadingFile, setUploadingFile] = useState(false)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isBulk: boolean) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Upload immediately via /api/v4/files; the returned FileInfo id fills the
    // hidden fileId field the backend requires.
    setUploadingFile(true)
    try {
      const uploaded = await uploadLmsFile(file)
      if (isBulk) {
        bulkForm.setValue('fileId', uploaded.fileId)
        setBulkFileName(uploaded.fileName)
      } else {
        form.setValue('fileId', uploaded.fileId)
        setFileName(uploaded.fileName)
      }
    } catch (err) {
      toast({ title: (err as Error)?.message || t('homework.uploadFailed', 'Tải lên thất bại'), variant: 'destructive' })
    } finally {
      setUploadingFile(false)
    }
  }

  const handleGradeChange = (studentId: string, field: 'grade' | 'feedback', value: string) => {
    setGradeValues((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }))
  }

  const handleGradeSubmit = (studentId: string) => {
    const submission = submissions.find((s: any) => s.studentId === studentId)
    if (!submission) return
    const gv = gradeValues[studentId] || { grade: '', feedback: '' }
    gradeMutation.mutate({
      homeworkId: selectedHomework?.id ?? '',
      submission,
      feedback: gv.feedback,
    })
  }

  const toggleBulkStudent = (studentId: string) => {
    const current = bulkForm.getValues('studentIds') || []
    const next = current.includes(studentId)
      ? current.filter((id: string) => id !== studentId)
      : [...current, studentId]
    bulkForm.setValue('studentIds', next)
  }

  const selectedBulkStudents = bulkForm.watch('studentIds') || []

  // ── Loading state ──────────────────────────────────────────────
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

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <PageHeader
        title={t('homework.title', 'Quản lý bài tập')}
        description={t('homework.description', 'Giao và theo dõi bài tập học viên')}
        icon={BookOpen}
        accentColor="sky"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={openBulkCreate} variant="outline" className="border-sky-200 text-sky-700 hover:bg-sky-50 rounded-lg">
              <Users className="h-4 w-4 mr-2" />
              {t('homework.bulkAssign', 'Giao cho nhiều học sinh')}
            </Button>
            <Button onClick={openCreate} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
              <Plus className="h-4 w-4 mr-2" />
              {t('homework.assign', 'Giao bài tập')}
            </Button>
          </div>
        }
      />

      {/* Data table (server-driven pagination + server-side search) */}
      <DataTable
        columns={columns}
        data={data?.items}
        paginationMode="server"
        paginationState={pagination}
        onPaginationChange={setPagination}
        rowCount={data?.totalCount ?? 0}
        isLoading={isLoading}
        onRowClick={(hw) => openDetail(hw)}
        toolbarActions={
          <>
            <div className="relative w-full sm:max-w-70">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-slot="homework-search"
                placeholder={t('homework.searchPlaceholder', 'Tìm kiếm bài tập...')}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('homework.className', 'Lớp học')}</p>
              <Select value={filterClassId || '__all__'} onValueChange={onFilterClassChange}>
                <SelectTrigger className="w-60">
                  {isLoadingClasses ? (
                    <SelectValue placeholder={t('common.loading', 'Đang tải...')} />
                  ) : (
                    <SelectValue placeholder={t('homework.allClasses', 'Tất cả lớp')} />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {isClassesError ? (
                    <SelectItem value="__all__" disabled>
                      <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                    </SelectItem>
                  ) : (
                    <>
                      <SelectItem value="__all__">{t('homework.allClasses', 'Tất cả lớp')}</SelectItem>
                      {classes.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </>
        }
        emptyState={
          <EmptyState
            icon={BookOpen}
            title={t('homework.noHomework', 'Chưa có bài tập')}
            description={t('homework.noHomeworkDesc', 'Giao bài tập đầu tiên cho học viên.')}
            actionLabel={t('homework.assign', 'Giao bài tập')}
            onAction={openCreate}
          />
        }
      />

      {/* ── Create Dialog ───────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('homework.assign', 'Giao bài tập')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <Form {...form} schema={homeworkSchema}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('homework.title', 'Tiêu đề')}</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('homework.titlePlaceholder', 'Tên bài tập')} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('homework.description', 'Mô tả')}</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ''} rows={3} placeholder={t('homework.descriptionPlaceholder', 'Mô tả bài tập...')} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('homework.className', 'Lớp')}</FormLabel>
                  <Select value={field.value || ''} onValueChange={(v) => {
                    field.onChange(v)
                    const cls = classes.find((c: any) => c.id === v)
                    if (cls) {
                      form.setValue('courseId', cls.courseId || cls.course?.id || '')
                      form.setValue('courseName', cls.course?.name || '')
                      form.setValue('teacherId', cls.teacherId || cls.teacher?.id || '')
                      form.setValue('teacherName', cls.teacher?.name || '')
                    }
                  }}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t('homework.selectClass', 'Chọn lớp')} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {classes.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {selectedClass && (
                <div className="grid grid-cols-2 gap-4 items-start">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">{t('homework.course', 'Khóa học')}</p>
                    <Input value={selectedClass.course?.name || '-'} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">{t('homework.teacher', 'Giáo viên')}</p>
                    <Input value={selectedClass.teacher?.name || '-'} disabled />
                  </div>
                </div>
              )}

              <FormField control={form.control} name="sessionId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('homework.sessionOptional', 'Buổi học (tùy chọn)')}</FormLabel>
                  <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t('homework.selectSession', 'Chọn buổi học')} /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t('homework.none', 'Không chọn')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="deadline" render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('homework.deadline', 'Hạn nộp')}</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="space-y-1.5">
                <FormLabel>{t('homework.attachmentOptional', 'File đính kèm (tùy chọn)')}</FormLabel>
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-muted-foreground/30 p-3 hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{fileName || t('homework.selectFile', 'Chọn file...')}</span>
                  <input type="file" className="hidden" onChange={(e) => handleFileChange(e, false)} />
                </label>
              </div>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateDialogOpen(false)}>{t('common.cancel', 'Hủy')}</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {createMutation.isPending ? t('common.loading', 'Đang lưu...') : t('homework.assign', 'Giao bài tập')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Assign Dialog ──────────────────────────────────── */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('homework.bulkAssign', 'Giao cho nhiều học sinh')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <Form {...bulkForm} schema={bulkHomeworkSchema}>
            <form onSubmit={bulkForm.handleSubmit((data) => bulkCreateMutation.mutate(data))} className="space-y-4">
              <FormField control={bulkForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('homework.title', 'Tiêu đề')}</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('homework.titlePlaceholder', 'Tên bài tập')} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={bulkForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('homework.description', 'Mô tả')}</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ''} rows={3} placeholder={t('homework.descriptionPlaceholder', 'Mô tả bài tập...')} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={bulkForm.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('homework.className', 'Lớp')}</FormLabel>
                  <Select value={field.value || ''} onValueChange={(v) => {
                    field.onChange(v)
                    bulkForm.setValue('studentIds', [])
                    const cls = classes.find((c: any) => c.id === v)
                    if (cls) {
                      bulkForm.setValue('courseId', cls.courseId || cls.course?.id || '')
                      bulkForm.setValue('courseName', cls.course?.name || '')
                      bulkForm.setValue('teacherId', cls.teacherId || cls.teacher?.id || '')
                      bulkForm.setValue('teacherName', cls.teacher?.name || '')
                    }
                  }}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t('homework.selectClass', 'Chọn lớp')} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {classes.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {bulkForm.watch('classId') && (
                <div className="grid grid-cols-2 gap-4 items-start">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">{t('homework.course', 'Khóa học')}</p>
                    <Input value={bulkForm.getValues('courseName') || '-'} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">{t('homework.teacher', 'Giáo viên')}</p>
                    <Input value={bulkForm.getValues('teacherName') || '-'} disabled />
                  </div>
                </div>
              )}

              <FormField control={bulkForm.control} name="deadline" render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('homework.deadline', 'Hạn nộp')}</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="space-y-1.5">
                <FormLabel>{t('homework.attachmentOptional', 'File đính kèm (tùy chọn)')}</FormLabel>
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-muted-foreground/30 p-3 hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{bulkFileName || t('homework.selectFile', 'Chọn file...')}</span>
                  <input type="file" className="hidden" onChange={(e) => handleFileChange(e, true)} />
                </label>
              </div>

              {/* Student list for bulk assign */}
              {bulkForm.watch('classId') && (
                isLoadingBulkStudents ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full" />
                  </div>
                ) : isBulkStudentsError ? (
                  <div className="py-8 text-center">
                    <ErrorState onRetry={() => queryClient.invalidateQueries({ queryKey: ['students', bulkForm.watch('classId')] })} />
                  </div>
                ) : bulkClassStudents.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel required>{t('homework.selectStudents', 'Chọn học sinh')}</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          const allIds = bulkClassStudents.map((s: any) => s.id)
                          bulkForm.setValue('studentIds', allIds, { shouldValidate: true })
                        }}
                      >
                        {t('homework.selectAll', 'Chọn tất cả')}
                      </Button>
                    </div>
                    <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                      {bulkClassStudents.map((student: any) => (
                        <label
                          key={student.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedBulkStudents.includes(student.id)}
                            onCheckedChange={() => toggleBulkStudent(student.id)}
                          />
                          <span className="text-sm">{student.name}</span>
                        </label>
                      ))}
                    </div>
                    {bulkForm.formState.errors.studentIds && (
                      <p className="text-xs text-destructive">{bulkForm.formState.errors.studentIds.message}</p>
                    )}
                  </div>
                ) : null
              )}

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setBulkDialogOpen(false)}>{t('common.cancel', 'Hủy')}</Button>
                <Button type="submit" disabled={bulkCreateMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {bulkCreateMutation.isPending ? t('common.loading', 'Đang lưu...') : t('homework.assign', 'Giao bài tập')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ───────────────────────────────────────── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedHomework?.title || t('homework.detail', 'Chi tiết bài tập')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>

          {selectedHomework && (
            <div className="space-y-4">
              {/* Homework info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{t('homework.className', 'Lớp')}</p>
                  <p className="text-sm font-medium">{selectedHomework.class?.name || selectedHomework.className || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{t('homework.teacher', 'Giáo viên')}</p>
                  <p className="text-sm font-medium">{selectedHomework.teacher?.name || selectedHomework.teacherName || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{t('homework.deadline', 'Hạn nộp')}</p>
                  <p className="text-sm font-medium">{selectedHomework.deadline ? new Date(selectedHomework.deadline).toLocaleDateString('vi-VN') : '-'}</p>
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground font-medium">{t('homework.description', 'Mô tả')}</p>
                  <p className="text-sm text-muted-foreground">{selectedHomework.description || t('homework.noDescription', 'Không có mô tả')}</p>
                </div>
                {selectedHomework.fileId && (
                  <div className="space-y-1 col-span-2 sm:col-span-3">
                    <p className="text-xs text-muted-foreground font-medium">{t('homework.attachment', 'File đính kèm')}</p>
                    <p className="text-sm text-sky-600 font-mono">{selectedHomework.fileId}</p>
                  </div>
                )}
              </div>

              {/* Submissions */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('homework.submissionsLabel', 'Bài nộp')} ({submissions.length})
                </h3>

                {submissionsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin h-6 w-6 border-4 border-sky-500 border-t-transparent rounded-full" />
                  </div>
                ) : isSubmissionsError ? (
                  <div className="py-10 text-center">
                    <ErrorState onRetry={() => refetchSubmissions()} />
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    {t('homework.noSubmissions', 'Chưa có bài nộp')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submissions.map((sub: any) => (
                      <div key={sub.id || sub.studentId} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{sub.student?.name || sub.studentName || '-'}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{t('homework.submitted', 'Nộp')}: {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString('vi-VN') : '-'}</span>
                              {sub.fileId && (
                                <a
                                  href={`/api/v4/files/${sub.fileId}/info`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sky-600 hover:underline font-mono inline-flex items-center gap-1"
                                >
                                  <Upload className="h-3 w-3" />
                                  {t('homework.file', 'File')}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Feedback controls — the submissions table has no
                            grade column; only feedback is persisted. */}
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end pt-2 border-t">
                          <div className="space-y-1 flex-1 w-full">
                            <label className="text-xs text-muted-foreground">{t('homework.feedback', 'Nhận xét')}</label>
                            <Textarea
                              placeholder={t('homework.feedbackPlaceholder', 'Nhận xét...')}
                              rows={2}
                              value={gradeValues[sub.studentId]?.feedback ?? sub.feedback ?? ''}
                              onChange={(e) => handleGradeChange(sub.studentId, 'feedback', e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white h-8 shrink-0"
                            disabled={gradeMutation.isPending}
                            onClick={() => handleGradeSubmit(sub.studentId)}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            {t('homework.gradeBtn', 'Chấm điểm')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>{t('common.close', 'Đóng')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ───────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('homework.deleteTitle', 'Xóa bài tập')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('homework.confirmDelete', 'Bạn có chắc muốn xóa bài tập')} &quot;{selectedHomework?.title}&quot;? {t('common.cannotUndo', 'Hành động này không thể hoàn tác.')}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Hủy')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => selectedHomework && deleteMutation.mutate(selectedHomework.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('common.loading', 'Đang xóa...') : t('common.delete', 'Xóa')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
