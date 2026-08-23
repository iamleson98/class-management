'use client'

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { GraduationCap, Plus, Search, Pencil, Trash2, X } from 'lucide-react'
import { createStudentSchema, updateStudentSchema, type CreateStudentInput, type UpdateStudentInput } from '@/lib/schemas'
import { getStudentsPaginated, createStudent, updateStudent, deleteStudent } from '@/lib/api'
import { paginate } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
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
import { PaginationControls, usePagination, derivePageInfo } from '@/components/shared/pagination'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/components/shared/animations'
import { useTranslation } from '@/lib/i18n'

type StudentFormValues = z.input<typeof updateStudentSchema>

const EMPTY_STUDENT: StudentFormValues = {
  firstname: '',
  lastname: '',
  email: '',
  phone: '',
  parentName: '',
  vmgClassCode: '',
  code: '',
  gender: 'male',
  school: '',
  schoolGrade: '',
  dob: '',
  parentId: '',
  branchId: '',
  notes: '',
  status: 'ACTIVE',
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang học', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  RESERVED: { label: 'Bảo lưu', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  DROPPED: { label: 'Nghỉ', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  PENDING: { label: 'Chờ xếp', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

function normalizeGender(value: unknown): StudentFormValues['gender'] {
  if (typeof value !== 'string') return 'male'
  const normalized = value.trim().toLowerCase()

  if (normalized === 'male' || normalized === 'nam') return 'male'
  if (normalized === 'female' || normalized === 'nu' || normalized === 'nữ') return 'female'

  return 'male'
}

function normalizeStatus(value: unknown): StudentFormValues['status'] {
  if (typeof value !== 'string') return 'ACTIVE'
  const normalized = value.trim().toUpperCase()

  if (normalized in STATUS_MAP) return normalized as StudentFormValues['status']

  if (normalized === 'STUDYING') return 'ACTIVE'
  if (normalized === 'SUSPENDED') return 'RESERVED'
  if (normalized === 'QUIT') return 'DROPPED'
  if (normalized === 'WAITING') return 'PENDING'

  return 'ACTIVE'
}

export default function AdminStudents() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const pagination = usePagination(10)

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(updateStudentSchema),
    defaultValues: EMPTY_STUDENT,
  })

  // Reset to first page whenever filters change so the user doesn't land on
  // an empty page after narrowing the result set.
  useEffect(() => { pagination.setPageIndex(0) }, [search, statusFilter])

  // Build the typed SearchOpts body. StudentFilterOpts honors top-level
  // `search` and `status` fields (see server/public/model_helper/lms.go), so
  // those go at the body root rather than into where_ands.
  const opts = useMemo(() => ({
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    ...paginate(pagination.pageIndex, pagination.pageSize),
  }), [search, statusFilter, pagination.pageIndex, pagination.pageSize])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['students', opts],
    queryFn: () => getStudentsPaginated(opts),
  })

  const students = data?.items ?? []
  const pageInfo = derivePageInfo(data?.totalCount ?? 0, pagination.pageIndex, pagination.pageSize, students.length)

  const createMutation = useMutation({
    mutationFn: (data: CreateStudentInput) => createStudent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast({ title: t('students.createSuccess', 'Thêm học viên thành công') })
      setDialogOpen(false)
      setEditingStudent(null)
      form.reset(EMPTY_STUDENT)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('students.createFail', 'Thêm học viên thất bại'), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStudentInput }) => updateStudent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast({ title: t('students.updateSuccess', 'Cập nhật học viên thành công') })
      setDialogOpen(false)
      setEditingStudent(null)
      form.reset(EMPTY_STUDENT)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('common.updateFail', 'Cập nhật thất bại'), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast({ title: t('students.deleteSuccess', 'Xóa học viên thành công') })
      setDeleteOpen(false)
      setDeletingId(null)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('common.deleteFail', 'Xóa thất bại'), variant: 'destructive' }),
  })

  const openCreate = () => {
    setEditingStudent(null)
    form.reset(EMPTY_STUDENT)
    setDialogOpen(true)
  }

  const openEdit = (student: any) => {
    setEditingStudent(student)
    form.reset({
      firstname: student.firstname || student.user?.firstname || '',
      lastname: student.lastname || student.user?.lastname || '',
      email: student.email || student.user?.email || '',
      phone: student.phone || student.user?.phone || '',
      parentName: student.parentName || '',
      vmgClassCode: student.vmgClassCode || '',
      code: student.code || '',
      gender: normalizeGender(student.gender),
      school: student.school || '',
      schoolGrade: student.schoolGrade || '',
      dob: student.dob || '',
      parentId: student.parentId || '',
      branchId: student.branchId || '',
      notes: student.notes || '',
      status: normalizeStatus(student.status),
    })
    setDialogOpen(true)
  }

  const onSubmit = (values: StudentFormValues) => {
    if (editingStudent) {
      updateMutation.mutate({ id: editingStudent.id, data: updateStudentSchema.parse(values) })
    } else {
      createMutation.mutate(createStudentSchema.parse(values))
    }
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
        title={t('students.title', 'Quản lý học viên')}
        description={t('students.description', 'Quản lý thông tin và trạng thái học viên')}
        icon={GraduationCap}
        accentColor="sky"
        actions={
          <Button onClick={openCreate} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('students.addStudent', 'Thêm học viên')}
          </Button>
        }
      />

      {/* Filters */}
      <Card className="rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('students.searchPlaceholder', 'Tìm theo tên, email, SĐT, tên phụ huynh...')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); pagination.reset() }}
              className="pl-9"
            />
          </div>
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
          {search && (
            <Button variant="ghost" size="icon" onClick={() => { setSearch(''); pagination.reset() }}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      {students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={t('students.emptyTitle', 'Chưa có học viên')}
          description={t('students.emptyDescription', 'Nhấn nút thêm học viên để bắt đầu.')}
          actionLabel={t('students.addStudent', 'Thêm học viên')}
          onAction={openCreate}
        />
      ) : (
        <>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="rounded-xl overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="uppercase text-xs font-semibold">{t('students.studentCode', 'Mã HV')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">{t('common.name', 'Họ tên')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('common.phone', 'SĐT')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('students.parent', 'Phụ huynh')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('students.vmgClassCode', 'Mã lớp VMG')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('students.gender', 'Giới tính')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('students.school', 'Trường')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden sm:table-cell">{t('students.grade', 'Lớp')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">{t('common.status', 'Trạng thái')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold w-20">{t('common.actions', 'Thao tác')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student: any) => {
                  const status = STATUS_MAP[student.status]
                  return (
                    <motion.tr
                      key={student.id}
                      variants={staggerItem}
                      className="hover:bg-muted/30"
                    >
                      <TableCell className="font-mono text-xs">{student.code || student.id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.email || student.user?.email || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{student.phone || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{student.parentName || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{student.vmgClassCode || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {student.gender === 'male' ? t('students.male', 'Nam') : student.gender === 'female' ? t('students.female', 'Nữ') : t('students.other', 'Khác')}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{student.school || '-'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                        {student.enrollments?.[0]?.className || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('rounded-full text-xs', status.className)}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(student)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => { setDeletingId(student.id); setDeleteOpen(true) }}>
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

          <PaginationControls {...pageInfo} onPageIndexChange={pagination.setPageIndex} onPageSizeChange={pagination.setPageSize} />
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStudent ? t('students.editStudent', 'Chỉnh sửa học viên') : t('students.addNewStudent', 'Thêm học viên mới')}</DialogTitle>
          </DialogHeader>
          <Form {...form} schema={editingStudent ? updateStudentSchema : createStudentSchema}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="firstname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.firstName', 'Họ')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="Nguyễn" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.lastName', 'Tên')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="Văn A" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('students.phoneNumber', 'Số điện thoại')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="0901xxx" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.email', 'Email')}</FormLabel>
                      <FormControl><Input type="email" {...field} value={field.value ?? ''} placeholder="email@example.com" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="parentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('students.parentName', 'Tên phụ huynh')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('students.parentNamePlaceholder', 'Họ tên phụ huynh')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('students.gender', 'Giới tính')}</FormLabel>
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="male">{t('students.male', 'Nam')}</SelectItem>
                          <SelectItem value="female">{t('students.female', 'Nữ')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {!editingStudent && (
                <div className="grid grid-cols-2 gap-4 items-start">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('students.studentCode', 'Mã học viên')}</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ''} placeholder="HV001" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vmgClassCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('students.vmgClassCode', 'Mã lớp học Việt Mỹ')}</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ''} placeholder="VD: VMG-A1" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              {editingStudent && (
                <div className="grid grid-cols-2 gap-4 items-start">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.status', 'Trạng thái')}</FormLabel>
                        <Select value={field.value ?? ''} onValueChange={field.onChange}>
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
                  <FormField
                    control={form.control}
                    name="vmgClassCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('students.vmgClassCode', 'Mã lớp học Việt Mỹ')}</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ''} placeholder="VD: VMG-A1" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('students.school', 'Trường')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('students.schoolPlaceholder', 'Tiểu học Hải An')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="schoolGrade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('students.grade', 'Lớp')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="VD: Lớp 5" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                    control={form.control}
                    name="dob"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>{t('students.dob', 'Ngày sinh')}</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            invalid={!!fieldState.error}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('students.notes', 'Ghi chú')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('students.notesPlaceholder', 'Ghi chú')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Hủy')}</Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {createMutation.isPending || updateMutation.isPending ? t('common.saving', 'Đang lưu...') : editingStudent ? t('common.update', 'Cập nhật') : t('common.addNew', 'Thêm mới')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('students.confirmDelete', 'Xác nhận xóa học viên')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('students.confirmDeleteDescription', 'Bạn có chắc muốn xóa học viên này? Hành động này không thể hoàn tác.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Hủy')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t('common.delete', 'Xóa')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
