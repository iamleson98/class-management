'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PaginationState } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { FileText, Plus, Search } from 'lucide-react'
import { createMaterialSchema, type CreateMaterialInput } from '@/lib/schemas'
import { useLMSStore } from '@/store/lms-store'
import { getMaterialsPaginated, createMaterial, getCourses } from '@/lib/api'
import { eq, and, or, contains, paginate } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/page-header'
import { FileUpload } from '@/components/shared/file-upload'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { DataTable } from '@/components/data-table'
import { createMaterialColumns } from './materials-columns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useTranslation } from '@/lib/i18n'

export default function AdminMaterials() {
  const { toast } = useToast()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { authUser } = useLMSStore()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  // Display label for the uploaded file backing the hidden fileId field.
  const [fileNameLabel, setFileNameLabel] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  // TODO: wire courseId / visibility filter UI; undefined drops the condition.
  const courseId: string | undefined = undefined
  const visibility: string | undefined = undefined

  type MaterialFormValues = z.input<typeof createMaterialSchema>
  const emptyMaterialForm: MaterialFormValues = {
    title: '', description: '', fileId: '',
    courseId: '', unit: '', visibility: 'TEACHER_ONLY', uploadedById: authUser?.id || '',
  }

  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(createMaterialSchema),
    defaultValues: emptyMaterialForm,
  })

  // Reset to the first page when the search box changes so the user doesn't
  // land on an empty page after narrowing the result set.
  const onSearchChange = (value: string) => {
    setSearch(value)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }

  // Build the typed SearchOpts body. MaterialFilterOpts has NO top-level
  // `search` field, so free-text search on the title goes via where_ors +
  // ILIKE (contains()). course_id / visibility filters are EQ conditions; they
  // are undefined until filter UI is added, and the helpers drop empty values.
  const opts = useMemo(() => ({
    where_ands: and(eq('materials.course_id', courseId), eq('materials.visibility', visibility)),
    where_ors: or(contains('materials.title', search)),
    ...paginate(pagination.pageIndex, pagination.pageSize),
  }), [search, courseId, visibility, pagination.pageIndex, pagination.pageSize])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['materials', opts],
    queryFn: () => getMaterialsPaginated(opts),
  })

  const { data: courses = [], isLoading: isLoadingCourses, isError: isCoursesError } = useQuery({
    queryKey: ['courses-materials'],
    queryFn: () => getCourses(),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateMaterialInput) => createMaterial(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      toast({ title: t('materials.addSuccess', 'Thêm tài liệu thành công') })
      setDialogOpen(false)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('materials.addFailed', 'Thêm tài liệu thất bại'), variant: 'destructive' }),
  })

  const openCreate = () => {
    form.reset({ ...emptyMaterialForm, uploadedById: authUser?.id || '' })
    setFileNameLabel('')
    setDialogOpen(true)
  }

  const columns = useMemo(
    () => createMaterialColumns(t),
    [t]
  )

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <PageHeader
        title={t('materials.title', 'Quản lý tài liệu')}
        description={t('materials.description', 'Quản lý tài liệu giảng dạy')}
        icon={FileText}
        accentColor="sky"
        actions={
          <Button onClick={openCreate} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('materials.addMaterial', 'Thêm tài liệu')}
          </Button>
        }
      />

      {/* Data table (server-driven pagination, server-side search) */}
      <DataTable
        columns={columns}
        data={data?.items}
        paginationMode="server"
        paginationState={pagination}
        onPaginationChange={setPagination}
        rowCount={data?.totalCount ?? 0}
        isLoading={isLoading}
        toolbarActions={
          <div className="relative w-full sm:max-w-70">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-slot="materials-search"
              placeholder={t('materials.searchPlaceholder', 'Tìm kiếm tài liệu...')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        }
        emptyState={
          <EmptyState
            icon={FileText}
            title={t('materials.noMaterials', 'Chưa có tài liệu')}
            description={t('materials.noMaterialsDesc', 'Thêm tài liệu giảng dạy đầu tiên.')}
            actionLabel={t('materials.addMaterial', 'Thêm tài liệu')}
            onAction={openCreate}
          />
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('materials.addMaterialTitle', 'Thêm tài liệu mới')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <Form {...form} schema={createMaterialSchema}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(createMaterialSchema.parse(data)))} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                      <FormLabel>{t('materials.title', 'Tiêu đề')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('materials.titlePlaceholder', 'Tên tài liệu')} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField control={form.control} name="fileId" render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{t('materials.file', 'Tài liệu')}</FormLabel>
                    {/* Real upload via /api/v4/files — sets the fileId the
                        backend requires (materials.file_id). */}
                    <FileUpload
                      value={field.value ? { fileName: fileNameLabel, fileType: '' } : null}
                      onChange={(file) => {
                        form.setValue('fileId', file?.fileId ?? '', { shouldValidate: true })
                        setFileNameLabel(file?.fileName ?? '')
                      }}
                      label={t('materials.chooseFile', 'Chọn tài liệu')}
                      invalid={!!fieldState.error}
                    />
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="visibility" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('materials.visibility', 'Hiển thị')}</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="PUBLIC">{t('materials.public', 'Công khai')}</SelectItem>
                        <SelectItem value="TEACHER_ONLY">{t('materials.private', 'Riêng tư')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} placeholder="Unit 1" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="courseId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('materials.course', 'Khóa học')}</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        {isLoadingCourses ? (
                          <SelectTrigger disabled><SelectValue placeholder={t('common.loading', 'Đang tải...')} /></SelectTrigger>
                        ) : (
                          <SelectTrigger><SelectValue placeholder={t('materials.selectCourse', 'Chọn khóa học')} /></SelectTrigger>
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
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('materials.description', 'Mô tả')}</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ''} rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <input type="hidden" {...form.register('uploadedById')} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Hủy')}</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {createMutation.isPending ? t('common.loading', 'Đang lưu...') : t('common.create', 'Thêm mới')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
