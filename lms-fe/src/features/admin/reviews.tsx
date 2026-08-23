'use client'

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Star, Plus, Search, Eye, Pencil, Trash2, MessageSquare } from 'lucide-react'
import {
  getWeeklyReviewsPaginated, createWeeklyReview, updateWeeklyReview, deleteWeeklyReview,
  getClasses, getStudents,
} from '@/lib/api'
import { eq, contains, and, or, paginate } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { useLMSStore } from '@/store/lms-store'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
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
import { PaginationControls, usePagination, derivePageInfo } from '@/components/shared/pagination'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/components/shared/animations'
import { useTranslation } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'

// ── Schema ──────────────────────────────────────────────────────────
const reviewSchema = z.object({
  studentId: z.string().min(1, 'Vui lòng chọn học viên'),
  classId: z.string().min(1, 'Vui lòng chọn lớp'),
  weekNumber: z.number().min(1, 'Tuần phải >= 1').max(52, 'Tuần phải <= 52'),
  rating: z.number().min(1, 'Vui lòng chọn đánh giá').max(5, 'Đánh giá tối đa 5 sao'),
  content: z.string().min(1, 'Vui lòng nhập nhận xét'),
})

type ReviewFormValues = z.input<typeof reviewSchema>

// ── Star Rating Component ────────────────────────────────────────────
function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: {
  value: number
  onChange?: (v: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const [hoverValue, setHoverValue] = useState(0)
  const displayValue = hoverValue || value

  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-6 w-6' : 'h-4.5 w-4.5'

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={cn(
            'p-0 transition-colors',
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
          )}
          onMouseEnter={() => !readonly && setHoverValue(star)}
          onMouseLeave={() => !readonly && setHoverValue(0)}
          onClick={() => !readonly && onChange?.(star)}
        >
          <Star
            className={cn(
              sizeClass,
              'transition-colors',
              displayValue >= star
                ? 'fill-orange-400 text-orange-400'
                : 'fill-none text-muted-foreground/30',
            )}
          />
        </button>
      ))}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────
export default function AdminReviews() {
  const { toast } = useToast()
  const { authUser } = useLMSStore()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // States
  const [search, setSearch] = useState('')
  const [filterClassId, setFilterClassId] = useState('')
  const [filterStudentId, setFilterStudentId] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<any>(null)
  const pagination = usePagination(10)

  // Form
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      studentId: '', classId: '', weekNumber: 1, rating: 0, content: '',
    },
  })

  // Reset to first page whenever filters change so the user doesn't land on
  // an empty page after narrowing the result set.
  useEffect(() => { pagination.setPageIndex(0) }, [search, filterClassId, filterStudentId])

  // Build the typed SearchOpts body. WeeklyReviewFilterOpts has NO top-level
  // search field, so text search is expressed as an ILIKE on
  // weekly_reviews.content via contains(). Class/student filters are EQ.
  const opts = useMemo(() => ({
    where_ands: and(
      eq('weekly_reviews.class_id', filterClassId),
      eq('weekly_reviews.student_id', filterStudentId),
    ),
    where_ors: or(contains('weekly_reviews.content', search)),
    ...paginate(pagination.pageIndex, pagination.pageSize),
  }), [search, filterClassId, filterStudentId, pagination.pageIndex, pagination.pageSize])

  // ── Queries ─────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['weekly-reviews', opts],
    queryFn: () => getWeeklyReviewsPaginated(opts),
  })

  const reviews = data?.items ?? []
  const pageInfo = derivePageInfo(data?.totalCount ?? 0, pagination.pageIndex, pagination.pageSize, reviews.length)

  const { data: classes = [], isLoading: isLoadingClasses, isError: isClassesError } = useQuery({
    queryKey: ['classes', 'all'],
    queryFn: () => getClasses(),
  })

  const { data: students = [], isLoading: isLoadingStudents, isError: isStudentsError } = useQuery({
    queryKey: ['students', form.watch('classId'), 'filter'],
    queryFn: () => getStudents({ class_id: form.watch('classId') }),
    enabled: !!form.watch('classId'),
  })

  const { data: filterStudents = [], isLoading: isLoadingFilterStudents, isError: isFilterStudentsError } = useQuery({
    queryKey: ['students', filterClassId, 'filter-dropdown'],
    queryFn: () => getStudents({ class_id: filterClassId }),
    enabled: !!filterClassId,
  })

  // ── Mutations ──────────────────────────────────────────────────
  const createMutation = useMutation({
    // createdBy (the reviewing teacher/admin) is an audit column on
    // weekly_reviews — fill it from the logged-in user.
    mutationFn: (data: ReviewFormValues) => createWeeklyReview({
      ...data,
      createdBy: authUser?.id || '',
    } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reviews'] })
      toast({ title: t('reviews.createSuccess', 'Viết nhận xét thành công') })
      setCreateDialogOpen(false)
      form.reset({ studentId: '', classId: '', weekNumber: 1, rating: 0, content: '' })
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('reviews.createFailed', 'Viết nhận xét thất bại'), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReviewFormValues }) => updateWeeklyReview(id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reviews'] })
      toast({ title: t('reviews.updateSuccess', 'Cập nhật nhận xét thành công') })
      setEditDialogOpen(false)
      setSelectedReview(null)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('reviews.updateFailed', 'Cập nhật nhận xét thất bại'), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWeeklyReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reviews'] })
      toast({ title: t('reviews.deleteSuccess', 'Xóa nhận xét thành công') })
      setDeleteDialogOpen(false)
      setSelectedReview(null)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('reviews.deleteFailed', 'Xóa nhận xét thất bại'), variant: 'destructive' }),
  })

  // ── Handlers ───────────────────────────────────────────────────
  const openCreate = () => {
    form.reset({ studentId: '', classId: '', weekNumber: 1, rating: 0, content: '' })
    setCreateDialogOpen(true)
  }

  const openEdit = (review: any) => {
    setSelectedReview(review)
    form.reset({
      studentId: review.studentId || '',
      classId: review.classId || '',
      weekNumber: review.weekNumber || 1,
      rating: review.rating || 0,
      content: review.content || '',
    })
    setEditDialogOpen(true)
  }

  const openView = (review: any) => {
    setSelectedReview(review)
    setViewDialogOpen(true)
  }

  const openDelete = (review: any) => {
    setSelectedReview(review)
    setDeleteDialogOpen(true)
  }

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
        title={t('reviews.title', 'Nhận xét hàng tuần')}
        description={t('reviews.description', 'Viết và quản lý nhận xét học viên theo tuần')}
        icon={MessageSquare}
        accentColor="sky"
        actions={
          <Button onClick={openCreate} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('reviews.writeReview', 'Viết nhận xét')}
          </Button>
        }
      />

      {/* Filters */}
      <Card className="rounded-xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('reviews.searchPlaceholder', 'Tìm kiếm học viên, nội dung...')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); pagination.reset() }}
              className="pl-9"
            />
          </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('reviews.className', 'Lớp học')}</p>
                <Select value={filterClassId} onValueChange={(v) => { setFilterClassId(v === '__all__' ? '' : v); setFilterStudentId(''); pagination.reset() }}>
                  <SelectTrigger className="w-48">
                    {isLoadingClasses ? (
                      <SelectValue placeholder={t('common.loading', 'Đang tải...')} />
                    ) : (
                      <SelectValue placeholder={t('reviews.allClasses', 'Tất cả lớp')} />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t('reviews.allClasses', 'Tất cả lớp')}</SelectItem>
                    {isClassesError ? (
                      <SelectItem value="__error" disabled>
                        <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                      </SelectItem>
                    ) : (
                      classes.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {filterClassId && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('reviews.student', 'Học viên')}</p>
                  <Select value={filterStudentId} onValueChange={(v) => { setFilterStudentId(v === '__all__' ? '' : v); pagination.reset() }}>
                    <SelectTrigger className="w-48">
                      {isLoadingFilterStudents ? (
                        <SelectValue placeholder={t('common.loading', 'Đang tải...')} />
                      ) : (
                        <SelectValue placeholder={t('common.all', 'Tất cả')} />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t('common.all', 'Tất cả')}</SelectItem>
                      {isFilterStudentsError ? (
                        <SelectItem value="__error" disabled>
                          <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                        </SelectItem>
                      ) : (
                        filterStudents.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
        </div>
      </Card>

      {/* Table */}
      {reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t('reviews.noReviews', 'Chưa có nhận xét')}
          description={t('reviews.noReviewsDesc', 'Viết nhận xét đầu tiên cho học viên.')}
          actionLabel={t('reviews.writeReview', 'Viết nhận xét')}
          onAction={openCreate}
        />
      ) : (
        <>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="rounded-xl overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="uppercase text-xs font-semibold">{t('reviews.student', 'Học viên')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('reviews.className', 'Lớp')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold text-center">{t('reviews.week', 'Tuần')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold text-center">{t('reviews.rating', 'Đánh giá')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('reviews.content', 'Nội dung')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('reviews.date', 'Ngày')}</TableHead>
                  <TableHead className="uppercase text-xs font-semibold w-28">{t('common.actions', 'Thao tác')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review: any) => (
                  <motion.tr key={review.id} variants={staggerItem} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-sm">
                      {review.student?.name || review.studentName || '-'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {review.class?.name || review.className || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="rounded-full text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                        {t('reviews.weekLabel', 'Tuần')} {review.weekNumber || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <StarRating value={review.rating || 0} readonly size="sm" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-50 truncate">
                      {review.content || '-'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {review.createdAt ? new Date(review.createdAt).toLocaleDateString('vi-VN') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.view', 'Xem')} onClick={() => openView(review)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.edit', 'Sửa')} onClick={() => openEdit(review)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" title={t('common.delete', 'Xóa')} onClick={() => openDelete(review)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
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

      {/* ── Create / Edit Dialog ─────────────────────────────────── */}
      <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => {
        if (!open) { setCreateDialogOpen(false); setEditDialogOpen(false); setSelectedReview(null) }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editDialogOpen ? t('reviews.editReview', 'Chỉnh sửa nhận xét') : t('reviews.writeReview', 'Viết nhận xét')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <Form {...form} schema={reviewSchema}>
            <form onSubmit={form.handleSubmit((data) => {
              if (editDialogOpen && selectedReview) {
                updateMutation.mutate({ id: selectedReview.id, data })
              } else {
                createMutation.mutate(data)
              }
            })} className="space-y-4">
              <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('reviews.className', 'Lớp')} </FormLabel>
                  <Select value={field.value || ''} onValueChange={(v) => {
                    field.onChange(v)
                    form.setValue('studentId', '')
                  }}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t('reviews.selectClass', 'Chọn lớp')} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {classes.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="studentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('reviews.student', 'Học viên')} </FormLabel>
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <FormControl>
                      {isLoadingStudents ? (
                        <SelectTrigger disabled><SelectValue placeholder={t('common.loading', 'Đang tải...')} /></SelectTrigger>
                      ) : (
                        <SelectTrigger><SelectValue placeholder={t('reviews.selectStudent', 'Chọn học viên')} /></SelectTrigger>
                      )}
                    </FormControl>
                    <SelectContent>
                      {isStudentsError ? (
                        <SelectItem value="none" disabled>
                          <span className="text-destructive">{t('common.loadFailed', 'Tải thất bại')}</span>
                        </SelectItem>
                      ) : students.length > 0 ? students.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      )) : (
                        <SelectItem value="none" disabled>{t('reviews.selectClassFirst', 'Chọn lớp trước')}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField control={form.control} name="weekNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('reviews.weekNumber', 'Tuần thứ')} </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={52}
                        {...field}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="rating" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('reviews.rating', 'Đánh giá')} </FormLabel>
                    <FormControl>
                      <StarRating
                        value={field.value || 0}
                        onChange={(v) => field.onChange(v)}
                        size="lg"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('reviews.reviewContent', 'Nội dung nhận xét')} </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ''}
                      rows={4}
                      placeholder={t('reviews.contentPlaceholder', 'Nhập nhận xét về học viên...')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => { setCreateDialogOpen(false); setEditDialogOpen(false); setSelectedReview(null) }}>{t('common.cancel', 'Hủy')}</Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? t('common.loading', 'Đang lưu...')
                    : editDialogOpen
                      ? t('common.update', 'Cập nhật')
                      : t('reviews.saveReview', 'Lưu nhận xét')
                  }
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── View Dialog ──────────────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('reviews.reviewDetail', 'Nhận xét chi tiết')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{t('reviews.student', 'Học viên')}</p>
                  <p className="text-sm font-medium">{selectedReview.student?.name || selectedReview.studentName || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{t('reviews.className', 'Lớp')}</p>
                  <p className="text-sm font-medium">{selectedReview.class?.name || selectedReview.className || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{t('reviews.week', 'Tuần')}</p>
                  <Badge className="rounded-full text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                    {t('reviews.weekLabel', 'Tuần')} {selectedReview.weekNumber || '-'}
                  </Badge>
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground font-medium">{t('reviews.rating', 'Đánh giá')}</p>
                  <StarRating value={selectedReview.rating || 0} readonly size="lg" />
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground font-medium">{t('reviews.createdAt', 'Ngày tạo')}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedReview.createdAt ? new Date(selectedReview.createdAt).toLocaleDateString('vi-VN') : '-'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('reviews.reviewContent', 'Nội dung nhận xét')}</p>
                <div className="p-4 rounded-lg border bg-background text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedReview.content || t('reviews.noContent', 'Không có nội dung')}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>{t('common.close', 'Đóng')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ───────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reviews.deleteTitle', 'Xóa nhận xét')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reviews.confirmDelete', 'Bạn có chắc muốn xóa nhận xét của')} &quot;{selectedReview?.student?.name || selectedReview?.studentName}&quot; ({t('reviews.weekLabel', 'tuần')} {selectedReview?.weekNumber})? {t('common.cannotUndo', 'Hành động này không thể hoàn tác.')}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Hủy')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => selectedReview && deleteMutation.mutate(selectedReview.id)}
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
