'use client'

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BookOpen, Plus, Search, Eye, Trash2, Users, Upload,
  CheckCircle, Clock, AlertTriangle,
} from 'lucide-react'
import {
  getHomeworkPaginated, createHomework, deleteHomework,
  bulkAssignHomework, getHomeworkSubmissions, getClasses, getStudents,
} from '@/lib/api'
import { gradeHomework } from '@/lib/api'
import { eq, contains, and, or, paginate } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { ErrorState } from '@/components/lms/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
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
import { PaginationControls, usePagination, derivePageInfo } from '@/components/lms/shared/pagination'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/components/lms/shared/animations'
import { useTranslation } from '@/lib/i18n'

// ── Schema ──────────────────────────────────────────────────────────
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
  fileUrl: z.string().optional().default(''),
  fileName: z.string().optional().default(''),
})

type HomeworkFormValues = z.input<typeof homeworkSchema>

const bulkHomeworkSchema = homeworkSchema.extend({
  studentIds: z.array(z.string()).min(1, 'Vui lòng chọn ít nhất một học viên'),
})

type BulkHomeworkFormValues = z.input<typeof bulkHomeworkSchema>

// const gradeSchema = z.object({
//   studentId: z.string(),
//   grade: z.string().optional().default(''),
//   feedback: z.string().optional().default(''),
// })

// type GradeFormValues = z.input<typeof gradeSchema>

// ── Status helpers ──────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  PENDING: { label: 'Chờ nộp', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', icon: Clock },
  GRADED: { label: 'Đã chấm', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: CheckCircle },
  OVERDUE: { label: 'Quá hạn', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
}

function getHomeworkStatus(deadline: string, submissionsCount: number, totalStudents: number): string {
  const now = new Date()
  const dl = new Date(deadline)
  if (now > dl && submissionsCount < totalStudents) return 'OVERDUE'
  if (submissionsCount > 0) return 'GRADED'
  return 'PENDING'
}

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
  const [selectedHomework, setSelectedHomework] = useState<any>(null)
  const [gradeValues, setGradeValues] = useState<Record<string, { grade: string; feedback: string }>>({})
  const [fileName, setFileName] = useState('')
  const [bulkFileName, setBulkFileName] = useState('')
  const pagination = usePagination(10)

  // Forms
  const form = useForm<HomeworkFormValues>({
    resolver: zodResolver(homeworkSchema),
    defaultValues: {
      title: '', description: '', classId: '', courseId: '', courseName: '',
      teacherId: '', teacherName: '', sessionId: '', deadline: '', fileUrl: '', fileName: '',
    },
  })

  const bulkForm = useForm<BulkHomeworkFormValues>({
    resolver: zodResolver(bulkHomeworkSchema),
    defaultValues: {
      title: '', description: '', classId: '', courseId: '', courseName: '',
      teacherId: '', teacherName: '', sessionId: '', deadline: '',
      fileUrl: '', fileName: '', studentIds: [],
    },
  })

  // Reset to first page whenever filters change so the user doesn't land on
  // an empty page after narrowing the result set.
  useEffect(() => { pagination.setPageIndex(0) }, [search, filterClassId])

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

  const homeworkList = data?.items ?? []
  const pageInfo = derivePageInfo(data?.totalCount ?? 0, pagination.pageIndex, pagination.pageSize, homeworkList.length)

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
    mutationFn: (data: HomeworkFormValues) => createHomework(data as any),
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
    mutationFn: (data: BulkHomeworkFormValues) => bulkAssignHomework(data as any),
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
    mutationFn: ({ homeworkId, studentId, grade, feedback }: { homeworkId: string; studentId: string; grade: string; feedback: string }) =>
      gradeHomework(homeworkId, { studentId, grade, feedback }),
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
      teacherId: '', teacherName: '', sessionId: '', deadline: '', fileUrl: '', fileName: '',
    })
    setFileName('')
    setCreateDialogOpen(true)
  }

  const openBulkCreate = () => {
    bulkForm.reset({
      title: '', description: '', classId: '', courseId: '', courseName: '',
      teacherId: '', teacherName: '', sessionId: '', deadline: '',
      fileUrl: '', fileName: '', studentIds: [],
    })
    setBulkFileName('')
    setBulkDialogOpen(true)
  }

  const openDetail = (hw: any) => {
    setSelectedHomework(hw)
    setGradeValues({})
    setDetailDialogOpen(true)
  }

  const openDelete = (hw: any) => {
    setSelectedHomework(hw)
    setDeleteDialogOpen(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isBulk: boolean) => {
    const file = e.target.files?.[0]
    if (file) {
      if (isBulk) {
        bulkForm.setValue('fileName', file.name)
        setBulkFileName(file.name)
      } else {
        form.setValue('fileName', file.name)
        setFileName(file.name)
      }
    }
  }

  const handleGradeChange = (studentId: string, field: 'grade' | 'feedback', value: string) => {
    setGradeValues((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }))
  }

  const handleGradeSubmit = (studentId: string) => {
    const gv = gradeValues[studentId] || { grade: '', feedback: '' }
    gradeMutation.mutate({
      homeworkId: selectedHomework.id,
      studentId,
      grade: gv.grade,
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

      {/* Filters */}
      <Card className="rounded-xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('homework.searchPlaceholder', 'Tìm kiếm bài tập...')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); pagination.reset() }}
              className="pl-9"
            />
          </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('homework.className', 'Lớp học')}</p>
                <Select value={filterClassId || '__all__'} onValueChange={(v) => { setFilterClassId(v === '__all__' ? '' : v); pagination.reset() }}>
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
        </div>
      </Card>

      {/* Table */}
      {homeworkList.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t('homework.noHomework', 'Chưa có bài tập')}
          description={t('homework.noHomeworkDesc', 'Giao bài tập đầu tiên cho học viên.')}
          actionLabel={t('homework.assign', 'Giao bài tập')}
          onAction={openCreate}
        />
      ) : (
        <>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="rounded-xl overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="uppercase text-xs font-semibold">{t('homework.title', 'Tiêu đề')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('homework.className', 'Lớp')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('homework.teacher', 'Giáo viên')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('homework.deadline', 'Hạn nộp')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold text-center">{t('homework.submissions', 'Bài nộp')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold text-center">{t('common.status', 'Trạng thái')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold w-24">{t('common.actions', 'Thao tác')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {homeworkList.map((hw: any) => {
                  const status = getHomeworkStatus(hw.deadline, hw.submissionsCount || 0, hw.totalStudents || 0)
                  const statusInfo = STATUS_MAP[status] || STATUS_MAP.PENDING
                  const StatusIcon = statusInfo.icon
                  return (
                    <motion.tr
                      key={hw.id}
                      variants={staggerItem}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => openDetail(hw)}
                    >
                      <TableCell className="font-medium text-sm">{hw.title}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {hw.class?.name || hw.className || '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {hw.teacher?.name || hw.teacherName || '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {hw.deadline ? new Date(hw.deadline).toLocaleDateString('vi-VN') : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium">{hw.submissionsCount || 0}</span>
                        <span className="text-xs text-muted-foreground">/{hw.totalStudents || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn('rounded-full text-xs gap-1', statusInfo.className)}>
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.view', 'Xem')} onClick={() => openDetail(hw)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" title={t('common.delete', 'Xóa')} onClick={() => openDelete(hw)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  )
                })}
              </TableBody>
            </Table>
          </motion.div>
          <PaginationControls
            {...pageInfo}
            onPageIndexChange={pagination.setPageIndex}
            onPageSizeChange={pagination.setPageSize}
          />
        </>
      )}

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
                      <FormLabel>{t('homework.selectStudents', 'Chọn học sinh')}</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          const allIds = bulkClassStudents.map((s: any) => s.id)
                          bulkForm.setValue('studentIds', allIds)
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
                      <p className="text-xs text-red-500">{bulkForm.formState.errors.studentIds.message}</p>
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
                {selectedHomework.fileName && (
                  <div className="space-y-1 col-span-2 sm:col-span-3">
                    <p className="text-xs text-muted-foreground font-medium">{t('homework.attachment', 'File đính kèm')}</p>
                    <p className="text-sm text-sky-600">{selectedHomework.fileName}</p>
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
                              <span>{t('homework.submitted', 'Nộp')}: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('vi-VN') : '-'}</span>
                              {sub.fileName && (
                                <span className="text-sky-600">{t('homework.file', 'File')}: {sub.fileName}</span>
                              )}
                            </div>
                          </div>
                          {sub.grade && (
                            <Badge className="rounded-full text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                              {sub.grade}
                            </Badge>
                          )}
                        </div>

                        {/* Grade controls */}
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end pt-2 border-t">
                          <div className="space-y-1 w-full sm:w-32">
                            <label className="text-xs text-muted-foreground">{t('homework.grade', 'Điểm')}</label>
                            <Input
                              placeholder={t('homework.gradePlaceholder', 'VD: 8.5')}
                              value={gradeValues[sub.studentId]?.grade ?? sub.grade ?? ''}
                              onChange={(e) => handleGradeChange(sub.studentId, 'grade', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1 flex-1">
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
