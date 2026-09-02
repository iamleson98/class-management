'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PaginationState } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { GraduationCap, Plus, Search, X } from 'lucide-react'
import { createStudentSchema, updateStudentSchema, type CreateStudentInput, type UpdateStudentInput, type Student } from '@/lib/schemas'
import { getStudentsPaginated, createStudent, updateStudent, deleteStudent } from '@/lib/api'
import { paginate } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { DataTable } from '@/components/data-table'
import { createStudentsColumns, STATUS_MAP } from './students-columns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(updateStudentSchema),
    defaultValues: EMPTY_STUDENT,
  })

  // Filters reset to page 0 directly in their change handlers (no effect needed).
  const onSearchChange = (value: string) => {
    setSearch(value)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }

  const onStatusFilterChange = (value: string) => {
    setStatusFilter(value)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }

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

  const openEdit = (student: Student) => {
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

  const columns = useMemo(
    () =>
      createStudentsColumns(t, {
        onEdit: openEdit,
        onDelete: (student) => {
          setDeletingId(student.id)
          setDeleteOpen(true)
        },
      }),
    [t]
  )

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
          <>
            <div className="relative flex-1 w-full sm:w-70">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-slot="students-search"
                placeholder={t('students.searchPlaceholder', 'Tìm theo tên, email, SĐT, tên phụ huynh...')}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
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
              <Button variant="ghost" size="icon" onClick={() => onSearchChange('')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        }
        emptyState={
          <EmptyState
            icon={GraduationCap}
            title={t('students.emptyTitle', 'Chưa có học viên')}
            description={t('students.emptyDescription', 'Nhấn nút thêm học viên để bắt đầu.')}
            actionLabel={t('students.addStudent', 'Thêm học viên')}
            onAction={openCreate}
          />
        }
      />

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
