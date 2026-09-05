'use client'

import { useState, useMemo, useRef } from 'react'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PaginationState } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { School, Plus, Trash2, Users, Camera, Calendar, Play, Upload, UserPlus, BookOpen, UserRound, MapPin, ImagePlay, Loader2 } from 'lucide-react'
import { type CreateClassInput, type UpdateClassInput, type Class } from '@/lib/schemas'
import { getClassesPaginated, createClass, updateClass, deleteClass, enrollStudents, unenrollStudent, getStudents, getClassDetail, getClassMedia, createClassMedia, deleteClassMedia, getSessions } from '@/lib/api'
import { uploadLmsFile, lmsMediaSrc, type LmsUploadProgress } from '@/lib/file-upload'
import { eq, and, paginate } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { useLMSStore } from '@/store/lms-store'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { DataTable } from '@/components/data-table'
import {
  createClassColumns,
  createEnrollmentColumns,
  createAttendanceMatrixColumns,
  buildAttendanceMatrixRows,
  CLASS_STATUS_MAP,
} from './classes-columns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { useTranslation } from '@/lib/i18n'
import ClassForm from './components/class-form'

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
  const { authUser } = useLMSStore()
  const [selectedMedia, setSelectedMedia] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadUrl, setUploadUrl] = useState('')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadType, setUploadType] = useState<'PHOTO' | 'VIDEO'>('PHOTO')
  const [uploadFileId, setUploadFileId] = useState('')
  const [isFileUploading, setIsFileUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<LmsUploadProgress | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createClassMedia(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-media'] })
      setUploadUrl('')
      setUploadTitle('')
      setUploadFileId('')
      toast({ title: t('classes.uploadSuccess', 'Tải lên thành công') })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('classes.uploadFail', 'Tải lên thất bại'), variant: 'destructive' }),
  })

  /** Upload a local file (Mattermost-style: simple upload ≤5MB, resumable
   *  upload session for larger files, with server-confirmed progress). */
  async function uploadFileObject(file: File) {
    if (isFileUploading) return
    setIsFileUploading(true)
    setUploadProgress(null)
    try {
      const uploaded = await uploadLmsFile(file, setUploadProgress)
      setUploadUrl(uploaded.selfUrl)
      setUploadFileId(uploaded.fileId)
      setUploadType(uploaded.fileType === 'video' ? 'VIDEO' : 'PHOTO')
      if (!uploadTitle) setUploadTitle(uploaded.fileName)
    } catch (err) {
      toast({ title: (err as Error)?.message || t('classes.uploadFail', 'Tải lên thất bại'), variant: 'destructive' })
    } finally {
      setIsFileUploading(false)
      setUploadProgress(null)
    }
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void uploadFileObject(file)
    e.target.value = ''
  }

  function handleUpload() {
    if (!uploadUrl || !authUser?.id) return
    // uploaded_by_id is required for audit (who uploaded the media).
    uploadMutation.mutate({
      classId,
      title: uploadTitle || undefined,
      fileUrl: uploadUrl,
      fileType: uploadType,
      fileId: uploadFileId || undefined,
      uploadedById: authUser.id,
    })
  }

  return (
    <div className="space-y-4">
      {/* Upload area — click, drag & drop, or paste a URL. The file is stored
          through the Mattermost file API (resumable >5MB) before the media
          row is created, so the gallery always renders server-backed bytes. */}
      {isAuthenticated && (
        <Card
          className={`rounded-xl p-4 border-dashed transition-colors ${isDragOver ? 'border-primary bg-primary/5' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) void uploadFileObject(file)
          }}
        >
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFilePicked}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isFileUploading}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-lg py-6 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                {isFileUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </span>
              <span className="text-sm font-medium">
                {isFileUploading
                  ? t('classes.uploadingProgress', 'Đang tải lên...')
                  : t('classes.dropzoneHint', 'Kéo thả ảnh/video vào đây, hoặc bấm để chọn file')}
              </span>
              <span className="text-xs text-muted-foreground/70">
                {t('classes.dropzoneFormats', 'Hỗ trợ ảnh (JPG, PNG, GIF, WebP) và video (MP4, WebM)')}
              </span>
            </button>
            {isFileUploading && uploadProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('classes.uploadingProgress', 'Đang tải lên...')}</span>
                  <span className="font-mono tabular-nums">{uploadProgress.percent}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress.percent}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {(uploadProgress.uploadedBytes / (1024 * 1024)).toFixed(1)} / {(uploadProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB
                  {uploadProgress.uploadedBytes > 5 * 1024 * 1024 && t('classes.uploadResumable', ' · hỗ trợ tiếp tục khi mất mạng')}
                </p>
              </div>
            )}
            {/* External URL fallback — hidden once a file has been picked
                (its stored fileId replaces the URL). */}
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                placeholder={t('classes.uploadUrlPlaceholder', 'Hoặc dán URL hình ảnh/video...')}
                value={uploadFileId ? '' : uploadUrl}
                onChange={(e) => { setUploadUrl(e.target.value); setUploadFileId('') }}
                className="flex-1 min-w-56 h-9"
                disabled={!!uploadFileId || isFileUploading}
              />
              <Input
                placeholder={t('classes.uploadTitlePlaceholder', 'Tiêu đề (tuỳ chọn)')}
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="w-52 h-9"
              />
              <Select value={uploadType} onValueChange={(v) => setUploadType(v as 'PHOTO' | 'VIDEO')}>
                <SelectTrigger className="w-28 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHOTO">{t('classes.photo', 'Ảnh')}</SelectItem>
                  <SelectItem value="VIDEO">{t('classes.video', 'Video')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleUpload}
                disabled={(!uploadUrl && !uploadFileId) || uploadMutation.isPending}
                className="h-9"
              >
                {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Camera className="h-4 w-4 mr-1.5" />}
                {uploadMutation.isPending ? t('common.saving', 'Đang lưu...') : t('classes.upload', 'Lưu vào lớp')}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {media.map((item: any, idx: number) => {
            // Skip broken rows defensively (null items / rows with no source):
            // they previously crashed the tab ("reading 'fileId' of null").
            if (!item) return null
            const src = lmsMediaSrc(item)
            return (
            <motion.div
              key={item.id || idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => { if (src) { setSelectedMedia(item); setDialogOpen(true) } }}
              className="cursor-pointer group relative"
            >
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative aspect-video bg-muted">
                  {!src ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/60">
                      <Camera className="h-6 w-6 mb-1" />
                      <span className="text-[10px]">{t('classes.mediaUnavailable', 'Không xem được')}</span>
                    </div>
                  ) : item.fileType === 'VIDEO' ? (
                    <>
                      <video src={src} className="w-full h-full object-cover" preload="metadata" muted />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="p-2 rounded-full bg-white/90">
                          <Play className="h-5 w-5 text-sky-600 fill-sky-600" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img src={src} alt={item.title || 'Class photo'} loading="lazy" className="w-full h-full object-cover bg-muted animate-in fade-in duration-500" />
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
            )
          })}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              {selectedMedia?.title || (selectedMedia?.fileType === 'VIDEO' ? t('classes.video', 'Video') : t('classes.photo', 'Hình ảnh'))}
            </DialogTitle>
          </DialogHeader>
          <div className="w-full">
            {selectedMedia?.fileType === 'VIDEO' ? (
              <video src={lmsMediaSrc(selectedMedia)} controls className="w-full rounded-lg" />
            ) : selectedMedia ? (
              <img src={lmsMediaSrc(selectedMedia)} alt={selectedMedia?.title || 'Preview'} className="w-full rounded-lg" />
            ) : null}
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
  const [viewingClass, setViewingClass] = useState<Class | null>(null)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [enrollingClassId, setEnrollingClassId] = useState<string | null>(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const onStatusFilterChange = (value: string) => {
    setStatusFilter(value)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }

  // Build the typed SearchOpts body. ClassFilterOpts honors a top-level
  // `search` field (see server/public/model_helper/lms.go); the status filter
  // goes into where_ands via eq() since there is no top-level status field.
  const opts = useMemo(() => ({
    search: undefined,
    where_ands: and(eq('classes.status', statusFilter !== 'all' ? statusFilter : undefined)),
    ...paginate(pagination.pageIndex, pagination.pageSize),
  }), [statusFilter, pagination.pageIndex, pagination.pageSize])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['classes', opts],
    queryFn: () => getClassesPaginated(opts),
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
    queryFn: () => getSessions({ where_ands: and(eq('lms_sessions.class_id', viewingClassId!)) }),
    enabled: !!viewingClassId && detailOpen,
  })

  const { data: classMedia = [], isLoading: isLoadingMedia, isError: isMediaError } = useQuery({
    queryKey: ['class-media', viewingClassId],
    queryFn: () => getClassMedia({ where_ands: and(eq('class_media.class_id', viewingClassId!)) }),
    enabled: !!viewingClassId && detailOpen,
  })

  const mediaDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteClassMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-media'] })
      toast({ title: t('classes.deleteMediaSuccess', 'Xóa media thành công') })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('common.deleteFail', 'Xóa thất bại'), variant: 'destructive' }),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateClassInput) => createClass(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast({ title: t('classes.createSuccess', 'Thêm lớp thành công') })
      closeDialog()
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('classes.createFail', 'Thêm lớp thất bại'), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClassInput }) => updateClass(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast({ title: t('classes.updateSuccess', 'Cập nhật lớp thành công') })
      closeDialog()
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('common.updateFail', 'Cập nhật thất bại'), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast({ title: t('classes.deleteSuccess', 'Xóa lớp thành công') })
      setDeleteOpen(false)
      setDeletingId(null)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('common.deleteFail', 'Xóa thất bại'), variant: 'destructive' }),
  })

  const enrollMutation = useMutation({
    mutationFn: ({ classId, studentIds }: { classId: string; studentIds: string[] }) => enrollStudents(classId, studentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      queryClient.invalidateQueries({ queryKey: ['class-detail'] })
      toast({ title: t('classes.enrollSuccess', 'Ghi danh thành công') })
      setEnrollOpen(false)
      setSelectedStudentIds([])
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('classes.enrollFail', 'Ghi danh thất bại'), variant: 'destructive' }),
  })

  // Remove a student from the class — the server also takes them out of the
  // class chat channel (membership sync on un-enroll).
  const unenrollMutation = useMutation({
    mutationFn: ({ classId, studentId }: { classId: string; studentId: string }) => unenrollStudent(classId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-detail'] })
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast({ title: t('classes.removeStudentSuccess', 'Đã xóa học viên khỏi lớp') })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('classes.removeStudentFail', 'Xóa học viên thất bại'), variant: 'destructive' }),
  })

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingClass(null)
  }

  const openCreate = () => {
    setEditingClass(null)
    setDialogOpen(true)
  }

  const openEdit = (cls: Class) => {
    setEditingClass(cls)
    setDialogOpen(true)
  }

  const openEnroll = (cls: Class) => {
    setEnrollingClassId(cls.id)
    setSelectedStudentIds([])
    setEnrollOpen(true)
  }

  const openDetail = (cls: Class) => {
    setViewingClass(cls)
    setViewingClassId(cls.id)
    setDetailTab('students')
    setDetailOpen(true)
  }

  // Enrollment launched from the detail modal targets the viewed class.
  const enrollFromDetail = () => {
    if (viewingClass) openEnroll(viewingClass)
  }

  const handleEnroll = () => {
    if (!enrollingClassId || selectedStudentIds.length === 0) return
    enrollMutation.mutate({ classId: enrollingClassId, studentIds: selectedStudentIds })
  }

  const columns = useMemo(
    () =>
      createClassColumns(t, {
        onView: openDetail,
        onEnroll: openEnroll,
        onEdit: openEdit,
        onDelete: (cls) => {
          setDeletingId(cls.id)
          setDeleteOpen(true)
        },
      }),
    [t]
  )

  // Detail modal: enrolled-students table columns (+ remove-from-class
  // action so the tab doubles as the membership manager)
  const unenrollMutate = unenrollMutation.mutate
  const enrollmentColumns = useMemo(
    () => createEnrollmentColumns(t, {
      onRemove: (enrollment) => {
        if (!viewingClassId || !enrollment?.studentId) return
        unenrollMutate({ classId: viewingClassId, studentId: enrollment.studentId })
      },
    }),
    // unenrollMutate is referentially stable (useMutation exposes a stable
    // mutate), so the columns only rebuild when the language/class changes.
    [t, viewingClassId, unenrollMutate],
  )

  // Detail modal: attendance matrix (columns built from the roster, rows from sessions)
  const matrixStudentNames = useMemo(
    () =>
      (classDetail?.studentEnrollments ?? []).slice(0, 10).map(
        (e) => e.student?.user?.name ?? e.student?.name ?? ''
      ),
    [classDetail]
  )
  const attendanceColumns = useMemo(
    () => createAttendanceMatrixColumns(t, matrixStudentNames),
    [t, matrixStudentNames]
  )
  const attendanceRows = useMemo(
    () => buildAttendanceMatrixRows(classSessions ?? [], classDetail?.studentEnrollments ?? []),
    [classSessions, classDetail]
  )

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

      {/* Data table (server-driven pagination) */}
      <DataTable
        columns={columns}
        data={data?.items}
        paginationMode="server"
        paginationState={pagination}
        onPaginationChange={setPagination}
        rowCount={data?.totalCount ?? 0}
        isLoading={isLoading}
        toolbarActions={
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-45">
              <SelectValue placeholder={t('common.status', 'Trạng thái')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.allStatuses', 'Tất cả trạng thái')}</SelectItem>
              {Object.entries(CLASS_STATUS_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        emptyState={
          <EmptyState
            icon={School}
            title={t('classes.emptyTitle', 'Chưa có lớp học')}
            description={t('classes.emptyDescription', 'Tạo lớp học đầu tiên để bắt đầu.')}
            actionLabel={t('classes.createClass', 'Tạo lớp')}
            onAction={openCreate}
          />
        }
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingClass ? t('classes.editClass', 'Chỉnh sửa lớp') : t('classes.createNewClass', 'Tạo lớp mới')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <ClassForm onDone={closeDialog} editingClass={Boolean(editingClass)} editingClassId={editingClass ? editingClass.id : undefined} classData={editingClass} />
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
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
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

      {/* Class Detail Dialog — near-full-screen workspace (80rem max, 92vh)
          so the students/attendance/media tabs have room to breathe. */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[min(80rem,calc(100vw-2rem))] max-w-none h-[92vh] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b bg-muted/30 dark:bg-card/50 shrink-0">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <School className="h-5 w-5" />
              </span>
              <span className="truncate">{classDetail?.code || ''} — {classDetail?.name || ''}</span>
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm mt-1.5">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                {classDetail?.course?.name || t('classes.noCourse', 'Không có khóa học')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                {classDetail?.teacher?.name || t('classes.noTeacherAssigned', 'Chưa phân công')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {classDetail?.room || '-'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="tabular-nums font-semibold">{classDetail?.studentEnrollments?.length || 0}</span>
                {t('classes.students', 'học viên')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="tabular-nums font-semibold">{(classMedia as any[])?.length || 0}</span>
                media
              </span>
              {classDetail?.status && (
                <Badge variant="secondary" className="rounded-full">{CLASS_STATUS_MAP[classDetail.status]?.label || classDetail.status}</Badge>
              )}
              <span className="flex-1" />
              <Button size="sm" onClick={enrollFromDetail} className="rounded-lg">
                <UserPlus className="h-4 w-4 mr-1.5" />
                {t('classes.enrollStudents', 'Ghi danh học viên')}
              </Button>
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : isDetailError ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <ErrorState onRetry={() => refetchDetail()} />
            </div>
          ) : (
            <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1 min-h-0 flex flex-col">
              <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto my-4">
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
              <TabsContent value="students" className="flex-1 min-h-0 px-6 pb-6 flex flex-col">
                {classDetail?.studentEnrollments?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Users className="h-10 w-10 mb-2 opacity-40" />
                    <p className="text-sm">{t('classes.noEnrolledStudents', 'Chưa có học viên ghi danh')}</p>
                  </div>
                ) : (
                  <ScrollArea className="h-full min-h-0 flex-1">
                    <DataTable
                      columns={enrollmentColumns}
                      data={classDetail?.studentEnrollments ?? []}
                      paginationMode="none"
                      showToolbar={false}
                      animateRows={false}
                      className="[&_[data-slot=table-container]]:rounded-none [&_[data-slot=table-container]]:border-0"
                    />
                  </ScrollArea>
                )}
              </TabsContent>

              {/* Tab: Attendance Summary */}
              <TabsContent value="attendance" className="flex-1 min-h-0 px-6 pb-6 flex flex-col">
                {isLoadingSessions ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
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
                  <ScrollArea className="h-full min-h-0 flex-1">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="rounded-full">{classSessions.length} {t('classes.sessions', 'buổi học')}</Badge>
                        <Badge variant="secondary" className="rounded-full">
                          {classDetail?.studentEnrollments?.length || 0} {t('classes.students', 'học viên')}
                        </Badge>
                      </div>
                      <DataTable
                        columns={attendanceColumns}
                        data={attendanceRows}
                        paginationMode="none"
                        showToolbar={false}
                        animateRows={false}
                        tableClassName="rounded-none border-0"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        * {t('classes.attendanceNote', 'Dữ liệu điểm danh chi tiết cần tải từng buổi. Hiển thị tối đa 10 học viên.')}
                      </p>
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              {/* Tab: Media Gallery */}
              <TabsContent value="media" className="flex-1 min-h-0 px-6 pb-6 flex flex-col">
                {isLoadingMedia ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : isMediaError ? (
                  <div className="py-10 text-center">
                    <p className="text-sm text-destructive">{t('common.loadFailed', 'Tải thất bại')}</p>
                  </div>
                ) : (
                  <ScrollArea className="h-full min-h-0 flex-1 pr-3">
                    <ClassMediaTab
                      media={classMedia as any[]}
                      classId={viewingClassId!}
                      onDelete={(id) => mediaDeleteMutation.mutate(id)}
                      isAuthenticated={true}
                    />
                  </ScrollArea>
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
