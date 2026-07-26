'use client'

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BookOpen, Plus, Pencil, Trash2, Search, Filter, ArrowUpDown, X } from 'lucide-react'
import { createCourseSchema, updateCourseSchema } from '@/lib/schemas'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { ErrorState } from '@/components/lms/error-state'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { formatVND, getCourses, createCourse, updateCourse, deleteCourse } from '@/lib/api'
import { PaginationControls, usePagination, derivePageInfo } from '@/components/lms/shared/pagination'
import { useTranslation } from '@/lib/i18n'

type CourseFormValues = z.input<typeof createCourseSchema>

const emptyCourse: CourseFormValues = {
  code: '',
  name: '',
  level: '',
  ageRange: '',
  totalSessions: 0,
  durationPerSession: 90,
  fee: 0,
  description: '',
  curriculum: '',
}

export default function CoursesPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [priceFilter, setPriceFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<any>(null)
  const pagination = usePagination(12)

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: emptyCourse,
  })

  const { data: courses, isLoading, isError, refetch } = useQuery({
    queryKey: ['courses'],
    queryFn: () => getCourses(),
  })

  // Reset to first page whenever the client-side filters/sort change.
  useEffect(() => { pagination.setPageIndex(0) }, [search, levelFilter, priceFilter, sortBy])

  const mutation = useMutation({
    mutationFn: (data: any) => editingCourse ? updateCourse(editingCourse.id, data) : createCourse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast({ title: editingCourse ? t('courses.updateSuccess', 'Cập nhật khóa học thành công') : t('courses.createSuccess', 'Tạo khóa học thành công') })
      setDialogOpen(false)
      setEditingCourse(null)
      form.reset(emptyCourse)
    },
    onError: () => {
      toast({ title: t('common.error', 'Có lỗi xảy ra'), variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCourse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast({ title: t('courses.deleteSuccess', 'Xóa khóa học thành công') })
      setDeleteDialogOpen(false)
      setEditingCourse(null)
    },
    onError: () => {
      toast({ title: t('common.error', 'Có lỗi xảy ra'), variant: 'destructive' })
    },
  })

  const handleEdit = (course: CourseFormValues) => {
    setEditingCourse(course)
    form.reset({
      code: course.code,
      name: course.name,
      level: course.level,
      ageRange: course.ageRange,
      totalSessions: course.totalSessions,
      durationPerSession: course.durationPerSession,
      fee: course.fee,
      description: course.description,
      curriculum: course.curriculum,
    })
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingCourse(null)
    form.reset(emptyCourse)
    setDialogOpen(true)
  }

  const handleDelete = (course: CourseFormValues) => {
    setEditingCourse(course)
    setDeleteDialogOpen(true)
  }

  const onSubmit = (values: CourseFormValues) => {
    mutation.mutate(editingCourse ? updateCourseSchema.parse(values) : createCourseSchema.parse(values))
  }

  const filteredCourses = useMemo(() => {
    let result = (courses || []).filter((c: any) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.code?.toLowerCase().includes(search.toLowerCase())
    )
    if (levelFilter) {
      result = result.filter((c: any) => c.level === levelFilter)
    }
    if (priceFilter) {
      const ranges: Record<string, [number, number]> = {
        'under2m': [0, 2_000_000],
        '2m-5m': [2_000_000, 5_000_000],
        '5m-10m': [5_000_000, 10_000_000],
        'over10m': [10_000_000, Infinity],
      }
      const [min, max] = ranges[priceFilter] ?? [0, Infinity]
      result = result.filter((c: any) => (c.fee ?? 0) >= min && (c.fee ?? 0) <= max)
    }
    const sorted = [...result]
    switch (sortBy) {
      case 'name-asc': sorted.sort((a: any, b: any) => a.name?.localeCompare(b.name)); break
      case 'name-desc': sorted.sort((a: any, b: any) => b.name?.localeCompare(a.name)); break
      case 'price-asc': sorted.sort((a: any, b: any) => (a.fee ?? 0) - (b.fee ?? 0)); break
      case 'price-desc': sorted.sort((a: any, b: any) => (b.fee ?? 0) - (a.fee ?? 0)); break
      case 'sessions-desc': sorted.sort((a: any, b: any) => (b.totalSessions ?? 0) - (a.totalSessions ?? 0)); break
      default: break // newest = default order from API
    }
    return sorted
  }, [courses, search, levelFilter, priceFilter, sortBy])

  // Courses are served via GET (no server-side filter/sort body), so paging is
  // applied CLIENT-SIDE over the filtered+sorted list. derivePageInfo yields the
  // server-style page-control props for consistency with other listings.
  const startIndex = pagination.pageIndex * pagination.pageSize
  const pageCourses = filteredCourses.slice(startIndex, startIndex + pagination.pageSize)
  const pageInfo = derivePageInfo(filteredCourses.length, pagination.pageIndex, pagination.pageSize, pageCourses.length)

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title={t('courses.title', 'Quản lý khóa học')}
        description={t('courses.description', 'Danh sách khóa học trong hệ thống')}
        icon={BookOpen}
        accentColor="sky"
        actions={
          <Button onClick={handleAdd} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('courses.addCourse', 'Thêm khóa học')}
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('courses.searchPlaceholder', 'Tìm kiếm khóa học...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-37.5 h-9 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder={t('courses.level', 'Trình độ')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('courses.allLevels', 'Tất cả trình độ')}</SelectItem>
              <SelectItem value="BEGINNER">Beginner</SelectItem>
              <SelectItem value="ELEMENTARY">Elementary</SelectItem>
              <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
              <SelectItem value="ADVANCED">Advanced</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priceFilter} onValueChange={(v) => setPriceFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-37.5 h-9 text-xs">
              <SelectValue placeholder={t('courses.priceRange', 'Mức giá')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('courses.allPriceRanges', 'Tất cả mức giá')}</SelectItem>
              <SelectItem value="under2m">{t('courses.under2m', 'Dưới 2 triệu')}</SelectItem>
              <SelectItem value="2m-5m">{t('courses.2mTo5m', '2 - 5 triệu')}</SelectItem>
              <SelectItem value="5m-10m">{t('courses.5mTo10m', '5 - 10 triệu')}</SelectItem>
              <SelectItem value="over10m">{t('courses.over10m', 'Trên 10 triệu')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t('courses.newest', 'Mới nhất')}</SelectItem>
              <SelectItem value="name-asc">{t('courses.nameAsc', 'Tên A-Z')}</SelectItem>
              <SelectItem value="name-desc">{t('courses.nameDesc', 'Tên Z-A')}</SelectItem>
              <SelectItem value="price-asc">{t('courses.priceAsc', 'Giá tăng dần')}</SelectItem>
              <SelectItem value="price-desc">{t('courses.priceDesc', 'Giá giảm dần')}</SelectItem>
              <SelectItem value="sessions-desc">{t('courses.mostSessions', 'Nhiều buổi nhất')}</SelectItem>
            </SelectContent>
          </Select>
          {(levelFilter || priceFilter || sortBy !== 'newest') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground"
              onClick={() => { setLevelFilter(''); setPriceFilter(''); setSortBy('newest') }}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              {t('courses.clearFilters', 'Xóa bộ lọc')}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3 text-muted-foreground">{t('common.loading', 'Đang tải...')}</span>
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filteredCourses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-12 w-12" />}
          title={t('courses.emptyTitle', 'Chưa có khóa học')}
          description={t('courses.emptyDescription', 'Hãy thêm khóa học mới để bắt đầu')}
          actionLabel={t('courses.addCourse', 'Thêm khóa học')}
          onAction={handleAdd}
        />
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageCourses.map((course: any) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{course.code}</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(course)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(course)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold text-lg mb-2">{course.name}</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{t('courses.levelLabel', 'Trình độ')}: {course.level || '—'}</p>
                  <p>{t('courses.ageRangeLabel', 'Độ tuổi')}: {course.ageRange || '—'}</p>
                  <p>{t('courses.sessionsLabel', 'Số buổi')}: {course.totalSessions || 0}</p>
                  <p className="text-base font-medium text-foreground">
                    {t('courses.tuitionLabel', 'Học phí')}: {formatVND(course.fee || 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <PaginationControls
          {...pageInfo}
          onPageIndexChange={pagination.setPageIndex}
          onPageSizeChange={pagination.setPageSize}
        />
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse ? t('courses.editCourse', 'Chỉnh sửa khóa học') : t('courses.addNewCourse', 'Thêm khóa học mới')}</DialogTitle>
            <DialogDescription>
              {editingCourse ? t('courses.editCourseDescription', 'Cập nhật thông tin khóa học') : t('courses.addNewCourseDescription', 'Nhập thông tin cho khóa học mới')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form} schema={editingCourse ? updateCourseSchema : createCourseSchema}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('courses.courseCode', 'Mã khóa học')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('courses.level', 'Trình độ')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t('courses.selectLevel', 'Chọn trình độ')} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="BEGINNER">Beginner</SelectItem>
                          <SelectItem value="ELEMENTARY">Elementary</SelectItem>
                          <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                          <SelectItem value="ADVANCED">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <FormLabel>{t('courses.courseName', 'Tên khóa học')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
              />
              <div className="grid grid-cols-3 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="ageRange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('courses.ageRange', 'Độ tuổi')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="VD: 6-12" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalSessions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('courses.sessionsLabel', 'Số buổi')}</FormLabel>
                      <FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('courses.tuitionLabel', 'Học phí')}</FormLabel>
                      <FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('courses.description', 'Mô tả')}</FormLabel>
                    <FormControl><Textarea {...field} value={field.value ?? ''} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="durationPerSession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('courses.durationPerSession', 'Thời lượng/buổi (phút)')}</FormLabel>
                      <FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="curriculum"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('courses.curriculum', 'Chương trình')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="VD: Communicative" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Hủy')}</Button>
                <Button type="submit" disabled={mutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {mutation.isPending ? t('common.saving', 'Đang lưu...') : editingCourse ? t('common.update', 'Cập nhật') : t('common.create', 'Tạo mới')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('courses.confirmDelete', 'Xác nhận xóa')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('courses.confirmDeleteDescription', 'Bạn có chắc muốn xóa khóa học "{name}"? Hành động này không thể hoàn tác.', { name: editingCourse?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel', 'Hủy')}</Button>
            <Button variant="destructive" onClick={() => editingCourse && deleteMutation.mutate(editingCourse.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? t('common.deleting', 'Đang xóa...') : t('common.delete', 'Xóa')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
