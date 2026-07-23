'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { School, Plus, Pencil, Trash2, UserPlus, Users, Eye, Camera, ClipboardList, Calendar, Play } from 'lucide-react'
import { createClassSchema, updateClassSchema, type CreateClassInput, type UpdateClassInput } from '@/lib/schemas'
import { getClasses, createClass, updateClass, deleteClass, enrollStudents, getCourses, getStudents, getUsers, getClassDetail, getClassMedia, createClassMedia, deleteClassMedia, getSessions, getSessionAttendance } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { ErrorState } from '@/components/lms/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { PaginationControls, usePagination, paginate } from '@/components/lms/shared/pagination'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/components/lms/shared/animations'
import { useTranslation } from '@/lib/i18n'

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Chờ mở', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  ACTIVE: { label: 'Đang học', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  PAUSED: { label: 'Tạm dừng', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  COMPLETED: { label: 'Hoàn thành', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  CLOSED: { label: 'Đã đóng', className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
}

type ClassFormValues = z.input<typeof createClassSchema>

const EMPTY_CLASS: ClassFormValues = {
  code: '', name: '', courseId: '', teacherId: '', room: '', maxSize: 15, status: 'OPEN', startDate: '', branchId: '',
}

// ── Class Media Tab Component ──────────────────────────
function ClassMediaTab({ media, classId, onDelete, isAuthenticated }: {
  media: any[]
  classId: string
  onDelete: (id: string) => void
  isAuthenticated: boolean
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedMedia, setSelectedMedia] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadUrl, setUploadUrl] = useState('')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadType, setUploadType] = useState<'PHOTO' | 'VIDEO'>('PHOTO')

  const uploadMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createClassMedia(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-media'] })
      setUploadUrl('')
      setUploadTitle('')
      toast({ title: t('classes.uploadSuccess', 'Tải lên thành công') })
    },
    onError: () => toast({ title: t('classes.uploadFail', 'Tải lên thất bại'), variant: 'destructive' }),
  })

  function handleUpload() {
    if (!uploadUrl) return
    uploadMutation.mutate({
      classId,
      title: uploadTitle || undefined,
      fileUrl: uploadUrl,
      fileType: uploadType,
    })
  }

  return (
    <div className="space-y-4">
      {/* Upload form */}
      {isAuthenticated && (
        <Card className="rounded-xl p-4">
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('classes.uploadNewMedia', 'Tải lên hình ảnh/video mới')}</p>
            <div className="flex gap-2">
              <Input
                placeholder={t('classes.uploadUrlPlaceholder', 'Dán URL hình ảnh hoặc video...')}
                value={uploadUrl}
                onChange={(e) => setUploadUrl(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder={t('classes.uploadTitlePlaceholder', 'Tiêu đề (tuỳ chọn)')}
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="w-40"
              />
              <Select value={uploadType} onValueChange={(v) => setUploadType(v as 'PHOTO' | 'VIDEO')}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHOTO">{t('classes.photo', 'Ảnh')}</SelectItem>
                  <SelectItem value="VIDEO">{t('classes.video', 'Video')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleUpload}
                disabled={!uploadUrl || uploadMutation.isPending}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                <Camera className="h-4 w-4 mr-1.5" />
                {t('classes.upload', 'Tải lên')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Gallery */}
      {media.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Camera className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">{t('classes.noMedia', 'Chưa có hình ảnh/video nào')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {media.map((item: any, idx: number) => (
            <motion.div
              key={item.id || idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => { setSelectedMedia(item); setDialogOpen(true) }}
              className="cursor-pointer group relative"
            >
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative aspect-video bg-muted">
                  {item.fileType === 'VIDEO' ? (
                    <>
                      <video src={item.fileUrl} className="w-full h-full object-cover" preload="metadata" muted />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="p-2 rounded-full bg-white/90">
                          <Play className="h-5 w-5 text-sky-600 fill-sky-600" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img src={item.fileUrl} alt={item.title || 'Class photo'} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-2 flex items-center justify-between">
                  {item.title && <p className="text-xs font-medium truncate">{item.title}</p>}
                  {isAuthenticated && onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-red-400 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              {selectedMedia?.title || (selectedMedia?.fileType === 'VIDEO' ? t('classes.video', 'Video') : t('classes.photo', 'Hình ảnh'))}
            </DialogTitle>
          </DialogHeader>
          <div className="w-full">
            {selectedMedia?.fileType === 'VIDEO' ? (
              <video src={selectedMedia.fileUrl} controls className="w-full rounded-lg" />
            ) : (
              <img src={selectedMedia?.fileUrl} alt={selectedMedia?.title || 'Preview'} className="w-full rounded-lg" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AdminClasses() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTab, setDetailTab] = useState('students')
  const [viewingClassId, setViewingClassId] = useState<string | null>(null)
  const [editingClass, setEditingClass] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [enrollingClassId, setEnrollingClassId] = useState<string | null>(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const pagination = usePagination(10)

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(createClassSchema),
    defaultValues: EMPTY_CLASS,
  })

  const { data: classes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['classes', statusFilter],
    queryFn: () => getClasses({ status: statusFilter !== 'all' ? statusFilter : undefined }),
  })

  const { data: courses = [], isLoading: isLoadingCourses, isError: isCoursesError } = useQuery({
    queryKey: ['courses-select'],
    queryFn: () => getCourses(),
  })

  const { data: teachers = [], isLoading: isLoadingTeachers, isError: isTeachersError } = useQuery({
    queryKey: ['users-teachers'],
    queryFn: () => getUsers('TEACHER'),
  })

  const { data: students = [], isLoading: isLoadingStudents, isError: isStudentsError } = useQuery({
    queryKey: ['students-enroll'],
    queryFn: () => getStudents(),
    enabled: enrollOpen,
  })

  // Class detail view queries
  const { data: classDetail, isLoading: detailLoading, isError: isDetailError, refetch: refetchDetail } = useQuery({
    queryKey: ['class-detail', viewingClassId],
    queryFn: () => getClassDetail(viewingClassId!),
    enabled: !!viewingClassId && detailOpen,
  })

  const { data: classSessions = [], isLoading: isLoadingSessions, isError: isSessionsError } = useQuery({
    queryKey: ['class-sessions', viewingClassId],
    queryFn: () => getSessions({ classId: viewingClassId! }),
    enabled: !!viewingClassId && detailOpen,
  })

  const { data: classMedia = [], isLoading: isLoadingMedia, isError: isMediaError } = useQuery({
    queryKey: ['class-media', viewingClassId],
    queryFn: () => getClassMedia({ classId: viewingClassId! }),
    enabled: !!viewingClassId && detailOpen,
  })

  const mediaDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteClassMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-media'] })
      toast({ title: t('classes.deleteMediaSuccess', 'Xóa media thành công') })
    },
    onError: () => toast({ title: t('common.deleteFail', 'Xóa thất bại'), variant: 'destructive' }),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateClassInput) => createClass(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast({ title: t('classes.createSuccess', 'Thêm lớp thành công') })
      closeDialog()
    },
    onError: () => toast({ title: t('classes.createFail', 'Thêm lớp thất bại'), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClassInput }) => updateClass(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast({ title: t('classes.updateSuccess', 'Cập nhật lớp thành công') })
      closeDialog()
    },
    onError: () => toast({ title: t('common.updateFail', 'Cập nhật thất bại'), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast({ title: t('classes.deleteSuccess', 'Xóa lớp thành công') })
      setDeleteOpen(false)
      setDeletingId(null)
    },
    onError: () => toast({ title: t('common.deleteFail', 'Xóa thất bại'), variant: 'destructive' }),
  })

  const enrollMutation = useMutation({
    mutationFn: ({ classId, studentIds }: { classId: string; studentIds: string[] }) => enrollStudents(classId, studentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast({ title: t('classes.enrollSuccess', 'Ghi danh thành công') })
      setEnrollOpen(false)
      setSelectedStudentIds([])
    },
    onError: () => toast({ title: t('classes.enrollFail', 'Ghi danh thất bại'), variant: 'destructive' }),
  })

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingClass(null)
    form.reset(EMPTY_CLASS)
  }

  const filtered = useMemo(() => classes, [classes])
  const paginated = paginate(filtered, pagination.pageIndex, pagination.pageSize)

  const openCreate = () => {
    setEditingClass(null)
    form.reset(EMPTY_CLASS)
    setDialogOpen(true)
  }

  const openEdit = (cls: any) => {
    setEditingClass(cls)
    form.reset({
      code: cls.code || '', name: cls.name || '', courseId: cls.courseId || '',
      teacherId: cls.teacherId || '', room: cls.room || '', maxSize: cls.maxSize || 15,
      status: cls.status || 'OPEN', startDate: cls.startDate || '', branchId: cls.branchId || '',
    })
    setDialogOpen(true)
  }

  const openEnroll = (cls: any) => {
    setEnrollingClassId(cls.id)
    setSelectedStudentIds([])
    setEnrollOpen(true)
  }

  const openDetail = (cls: any) => {
    setViewingClassId(cls.id)
    setDetailTab('students')
    setDetailOpen(true)
  }

  const onSubmit = (values: ClassFormValues) => {
    if (editingClass) {
      updateMutation.mutate({ id: editingClass.id, data: updateClassSchema.parse(values) })
    } else {
      createMutation.mutate(createClassSchema.parse(values))
    }
  }

  const handleEnroll = () => {
    if (!enrollingClassId || selectedStudentIds.length === 0) return
    enrollMutation.mutate({ classId: enrollingClassId, studentIds: selectedStudentIds })
  }

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
        title={t('classes.title', 'Quản lý lớp học')}
        description={t('classes.description', 'Quản lý lớp học và ghi danh học viên')}
        icon={School}
        accentColor="sky"
        actions={
          <Button onClick={openCreate} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('classes.createClass', 'Tạo lớp')}
          </Button>
        }
      />

      {/* Filter */}
      <Card className="rounded-xl p-4">
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); pagination.reset() }}>
            <SelectTrigger className="w-45">
              <SelectValue placeholder={t('common.status', 'Trạng thái')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.allStatuses', 'Tất cả trạng thái')}</SelectItem>
              {Object.entries(STATUS_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      {paginated.data.length === 0 ? (
        <EmptyState
          icon={School}
          title={t('classes.emptyTitle', 'Chưa có lớp học')}
          description={t('classes.emptyDescription', 'Tạo lớp học đầu tiên để bắt đầu.')}
          actionLabel={t('classes.createClass', 'Tạo lớp')}
          onAction={openCreate}
        />
      ) : (
        <>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="rounded-xl overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="uppercase text-xs font-semibold">{t('classes.classCode', 'Mã lớp')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">{t('common.name', 'Tên')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('classes.course', 'Khóa học')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('classes.teacher', 'Giáo viên')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('classes.room', 'Phòng')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden sm:table-cell">{t('classes.classSize', 'Sĩ số')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">{t('common.status', 'Trạng thái')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold w-30">{t('common.actions', 'Thao tác')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.data.map((cls: any) => {
                  const status = STATUS_MAP[cls.status] || STATUS_MAP.OPEN
                  const enrolled = cls._count?.studentEnrollments || cls.enrollments?.length || cls.studentCount || 0
                  return (
                    <motion.tr key={cls.id} variants={staggerItem} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{cls.code || cls.id.slice(0, 8)}</TableCell>
                      <TableCell className="font-medium text-sm">{cls.name}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{cls.course?.name || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{cls.teacher?.name || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{cls.room || '-'}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className={cn(enrolled >= (cls.maxSize || 15) && 'text-amber-600 font-medium')}>
                            {enrolled}/{cls.maxSize || 15}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('rounded-full text-xs', status.className)}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-sky-500" onClick={() => openDetail(cls)} title={t('common.details', 'Chi tiết')}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEnroll(cls)} title={t('classes.enroll', 'Ghi danh')}>
                            <UserPlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cls)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => { setDeletingId(cls.id); setDeleteOpen(true) }}>
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
          <PaginationControls {...paginated} onPageIndexChange={pagination.setPageIndex} onPageSizeChange={pagination.setPageSize} />
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingClass ? t('classes.editClass', 'Chỉnh sửa lớp') : t('classes.createNewClass', 'Tạo lớp mới')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <Form {...form} schema={editingClass ? updateClassSchema : createClassSchema}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('classes.classCode', 'Mã lớp')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="OPW1-A" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="room"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('classes.roomField', 'Phòng học')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="P.101" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('classes.className', 'Tên lớp')}</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} placeholder="OPW1-A Sáng T3-T5" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="courseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('classes.course', 'Khóa học')}</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl>
                          {isLoadingCourses ? (
                            <SelectTrigger disabled><SelectValue placeholder={t('common.loading', 'Đang tải...')} /></SelectTrigger>
                          ) : (
                            <SelectTrigger><SelectValue placeholder={t('classes.selectCourse', 'Chọn khóa học')} /></SelectTrigger>
                          )}
                        </FormControl>
                        <SelectContent>
                          {isCoursesError ? (
                            <SelectItem value="__error" disabled>
                              <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                            </SelectItem>
                          ) : (
                            courses.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teacherId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('classes.teacher', 'Giáo viên')}</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl>
                          {isLoadingTeachers ? (
                            <SelectTrigger disabled><SelectValue placeholder={t('common.loading', 'Đang tải...')} /></SelectTrigger>
                          ) : (
                            <SelectTrigger><SelectValue placeholder={t('classes.selectTeacher', 'Chọn giáo viên')} /></SelectTrigger>
                          )}
                        </FormControl>
                        <SelectContent>
                          {isTeachersError ? (
                            <SelectItem value="__error" disabled>
                              <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                            </SelectItem>
                          ) : (
                            teachers.map((t: any) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="maxSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('classes.maxSize', 'Sĩ số tối đa')}</FormLabel>
                      <FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.status', 'Trạng thái')}</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.entries(STATUS_MAP).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{val.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <input type="hidden" {...form.register('startDate')} />
              <input type="hidden" {...form.register('branchId')} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={closeDialog}>{t('common.cancel', 'Hủy')}</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {createMutation.isPending || updateMutation.isPending ? t('common.saving', 'Đang lưu...') : editingClass ? t('common.update', 'Cập nhật') : t('classes.createClass', 'Tạo lớp')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Enroll Students Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('classes.enrollStudents', 'Ghi danh học viên')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-3">{t('classes.selectStudentsToEnroll', 'Chọn học viên cần ghi danh vào lớp:')}</p>
            <ScrollArea className="h-75 border rounded-lg p-2">
              {isLoadingStudents ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full" />
                </div>
              ) : isStudentsError ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-destructive">{t('common.loadFailed', 'Tải thất bại')}</p>
                </div>
              ) : (
              <div className="space-y-1">
                {students.map((student: any) => (
                  <label key={student.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={selectedStudentIds.includes(student.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedStudentIds([...selectedStudentIds, student.id])
                        } else {
                          setSelectedStudentIds(selectedStudentIds.filter((id: string) => id !== student.id))
                        }
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.email || student.phone || ''}</p>
                    </div>
                  </label>
                ))}
              </div>
              )}
            </ScrollArea>
            {selectedStudentIds.length > 0 && (
              <p className="text-sm text-sky-600 mt-2 font-medium">{t('classes.selectedCount', 'Đã chọn {count} học viên', { count: selectedStudentIds.length })}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>{t('common.cancel', 'Hủy')}</Button>
            <Button onClick={handleEnroll} disabled={enrollMutation.isPending || selectedStudentIds.length === 0} className="bg-sky-600 hover:bg-sky-700 text-white">
              {enrollMutation.isPending ? t('classes.enrolling', 'Đang ghi danh...') : t('classes.enroll', 'Ghi danh')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Class Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <School className="h-5 w-5 text-sky-500" />
              {classDetail?.code || ''} — {classDetail?.name || ''}
            </DialogTitle>
            <DialogDescription>
              {classDetail?.course?.name || t('classes.noCourse', 'Không có khóa học')} · {classDetail?.teacher?.name || t('classes.noTeacherAssigned', 'Chưa phân công')} · {classDetail?.room || '-'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
            </div>
          ) : isDetailError ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <ErrorState onRetry={() => refetchDetail()} />
            </div>
          ) : (
            <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1 min-h-0 flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="students" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" /> {t('classes.students', 'Học viên')}
                </TabsTrigger>
                <TabsTrigger value="attendance" className="gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> {t('classes.attendance', 'Điểm danh')}
                </TabsTrigger>
                <TabsTrigger value="media" className="gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> Media
                </TabsTrigger>
              </TabsList>

              {/* Tab: Student List */}
              <TabsContent value="students" className="flex-1 min-h-0 mt-4">
                {classDetail?.studentEnrollments?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Users className="h-10 w-10 mb-2 opacity-40" />
                    <p className="text-sm">{t('classes.noEnrolledStudents', 'Chưa có học viên ghi danh')}</p>
                  </div>
                ) : (
                  <ScrollArea className="h-100">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="text-xs font-semibold">#</TableHead>
                          <TableHead className="text-xs font-semibold">{t('common.name', 'Họ tên')}</TableHead>
                          <TableHead className="text-xs font-semibold hidden md:table-cell">{t('common.phone', 'SĐT')}</TableHead>
                          <TableHead className="text-xs font-semibold hidden md:table-cell">{t('classes.parent', 'Phụ huynh')}</TableHead>
                          <TableHead className="text-xs font-semibold hidden lg:table-cell">{t('classes.vmgClassCode', 'Mã lớp VMG')}</TableHead>
                          <TableHead className="text-xs font-semibold">{t('common.status', 'Trạng thái')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classDetail?.studentEnrollments?.map((enrollment: any, idx: number) => {
                          const s = enrollment.student
                          const user = s?.user
                          return (
                            <TableRow key={enrollment.id || idx}>
                              <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="font-medium text-sm">{user?.name || s?.code || '-'}</TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{user?.phone || s?.phone || '-'}</TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s?.parentName || '-'}</TableCell>
                              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground font-mono">{s?.vmgClassCode || '-'}</TableCell>
                              <TableCell>
                                <Badge className={cn(
                                  'rounded-full text-xs',
                                  enrollment.status === 'ACTIVE' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' :
                                  enrollment.status === 'DROPPED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                )}>
                                  {enrollment.status === 'ACTIVE' ? t('classes.studying', 'Đang học') : enrollment.status === 'DROPPED' ? t('classes.dropped', 'Đã nghỉ') : enrollment.status || '-'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </TabsContent>

              {/* Tab: Attendance Summary */}
              <TabsContent value="attendance" className="flex-1 min-h-0 mt-4">
                {isLoadingSessions ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full" />
                  </div>
                ) : isSessionsError ? (
                  <div className="py-10 text-center">
                    <p className="text-sm text-destructive">{t('common.loadFailed', 'Tải thất bại')}</p>
                  </div>
                ) : classSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Calendar className="h-10 w-10 mb-2 opacity-40" />
                    <p className="text-sm">{t('classes.noSessions', 'Chưa có buổi học')}</p>
                  </div>
                ) : (
                  <ScrollArea className="h-100">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="rounded-full">{classSessions.length} {t('classes.sessions', 'buổi học')}</Badge>
                        <Badge variant="secondary" className="rounded-full">
                          {classDetail?.studentEnrollments?.length || 0} {t('classes.students', 'học viên')}
                        </Badge>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="text-xs font-semibold sticky left-0 bg-background z-10">{t('classes.date', 'Ngày')}</TableHead>
                            {classDetail?.studentEnrollments?.slice(0, 10).map((enrollment: any, idx: number) => (
                              <TableHead key={idx} className="text-xs font-semibold text-center min-w-20">
                                <span className="block truncate max-w-17.5" title={enrollment.student?.user?.name}>
                                  {enrollment.student?.user?.name?.split(' ').pop() || `HV${idx + 1}`}
                                </span>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classSessions.slice(0, 20).map((session: any) => (
                            <TableRow key={session.id}>
                              <TableCell className="text-xs font-medium sticky left-0 bg-background z-10">
                                {session.date ? new Date(session.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '-'}
                              </TableCell>
                              {classDetail?.studentEnrollments?.slice(0, 10).map(() => (
                                <TableCell key={Math.random()} className="text-center text-xs text-muted-foreground">
                                  —
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <p className="text-xs text-muted-foreground mt-2">
                        * {t('classes.attendanceNote', 'Dữ liệu điểm danh chi tiết cần tải từng buổi. Hiển thị tối đa 10 học viên.')}
                      </p>
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              {/* Tab: Media Gallery */}
              <TabsContent value="media" className="flex-1 min-h-0 mt-4">
                {isLoadingMedia ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full" />
                  </div>
                ) : isMediaError ? (
                  <div className="py-10 text-center">
                    <p className="text-sm text-destructive">{t('common.loadFailed', 'Tải thất bại')}</p>
                  </div>
                ) : (
                <ClassMediaTab
                  media={classMedia as any[]}
                  classId={viewingClassId!}
                  onDelete={(id) => mediaDeleteMutation.mutate(id)}
                  isAuthenticated={true}
                />
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('classes.confirmDelete', 'Xác nhận xóa lớp')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('classes.confirmDeleteDescription', 'Bạn có chắc muốn xóa lớp này? Hành động này không thể hoàn tác.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Hủy')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMutation.mutate(deletingId)} className="bg-red-600 hover:bg-red-700 text-white">{t('common.delete', 'Xóa')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
