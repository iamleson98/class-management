'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { FileText, Plus, Search, Eye, Download } from 'lucide-react'
import { createMaterialSchema, type CreateMaterialInput } from '@/lib/schemas'
import { useLMSStore } from '@/store/lms-store'
import { getMaterials, createMaterial, getCourses } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { ErrorState } from '@/components/lms/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileTypeIcon } from '@/components/lms/file-type-icon'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PaginationControls, usePagination, paginate } from '@/components/lms/shared/pagination'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/components/lms/shared/animations'
import { useTranslation } from '@/lib/i18n'

const TYPE_MAP: Record<string, { label: string; className: string }> = {
  DOCUMENT: { label: 'Tài liệu', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  VIDEO: { label: 'Video', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  AUDIO: { label: 'Âm thanh', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  EXERCISE: { label: 'Bài tập', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  IMAGE: { label: 'Hình ảnh', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
}

export default function AdminMaterials() {
  const { toast } = useToast()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { authUser } = useLMSStore()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const pagination = usePagination(10)

  type MaterialFormValues = z.input<typeof createMaterialSchema>
  const emptyMaterialForm: MaterialFormValues = {
    title: '', description: '', fileUrl: '', fileName: '', fileType: '',
    courseId: '', unit: '', visibility: 'TEACHER_ONLY', uploadedById: authUser?.id || '',
  }

  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(createMaterialSchema),
    defaultValues: emptyMaterialForm,
  })

  const { data: materials = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['materials', search],
    queryFn: () => getMaterials({ courseId: undefined }),
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
    onError: () => toast({ title: t('materials.addFailed', 'Thêm tài liệu thất bại'), variant: 'destructive' }),
  })

  const filtered = useMemo(() => {
    if (!search) return materials
    return materials.filter((m: any) =>
      m.title?.toLowerCase().includes(search.toLowerCase())
    )
  }, [materials, search])

  const paginated = paginate(filtered, pagination.pageIndex, pagination.pageSize)

  const openCreate = () => {
    form.reset({ ...emptyMaterialForm, uploadedById: authUser?.id || '' })
    setDialogOpen(true)
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

      <Card className="rounded-xl p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('materials.searchPlaceholder', 'Tìm kiếm tài liệu...')} value={search} onChange={(e) => { setSearch(e.target.value); pagination.reset() }} className="pl-9" />
        </div>
      </Card>

      {paginated.data.length === 0 ? (
        <EmptyState icon={FileText} title={t('materials.noMaterials', 'Chưa có tài liệu')} description={t('materials.noMaterialsDesc', 'Thêm tài liệu giảng dạy đầu tiên.')} actionLabel={t('materials.addMaterial', 'Thêm tài liệu')} onAction={openCreate} />
      ) : (
        <>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="rounded-xl overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="uppercase text-xs font-semibold">{t('materials.type', 'Loại')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">{t('materials.title', 'Tiêu đề')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">{t('materials.course', 'Khóa học')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">Unit</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('materials.visibility', 'Hiển thị')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold w-20">{t('common.actions', 'Thao tác')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.data.map((material: any) => {
                  const type = TYPE_MAP[material.type] || TYPE_MAP.DOCUMENT
                  return (
                    <motion.tr key={material.id} variants={staggerItem} className="hover:bg-muted/30">
                      <TableCell><FileTypeIcon fileType={material.fileType} /></TableCell>
                      <TableCell className="font-medium text-sm">{material.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{material.course?.name || material.courseName || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{material.unit || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge className={cn('rounded-full text-xs', material.visibility === 'PUBLIC' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400')}>
                          {material.visibility === 'PUBLIC' ? t('materials.public', 'Công khai') : t('materials.private', 'Riêng tư')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.view', 'Xem')}><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.download', 'Tải xuống')}><Download className="h-3.5 w-3.5" /></Button>
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
                <FormField control={form.control} name="fileType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('materials.fileType', 'Loại file')}</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="PDF">PDF</SelectItem>
                        <SelectItem value="DOCX">DOCX</SelectItem>
                        <SelectItem value="PPTX">PPTX</SelectItem>
                        <SelectItem value="XLSX">XLSX</SelectItem>
                        <SelectItem value="IMAGE">{t('materials.image', 'Hình ảnh')}</SelectItem>
                      </SelectContent>
                    </Select>
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
