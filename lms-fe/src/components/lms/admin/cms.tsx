'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Newspaper, Plus, Pencil, Trash2, Eye } from 'lucide-react'
import { createPostSchema, updatePostSchema, type CreatePostInput, type UpdatePostInput } from '@/lib/schemas'
import { useLMSStore } from '@/store/lms-store'
import { getPostsPaginated, createPost, updatePost, deletePost, getPostCategories } from '@/lib/api'
import { paginate } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { ErrorState } from '@/components/lms/error-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import RichTextEditor from '@/components/ui/mdx-editor'
import { uploadFile } from '@/lib/file-upload'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PaginationControls, usePagination, derivePageInfo } from '@/components/lms/shared/pagination'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/components/lms/shared/animations'
import { useTranslation } from '@/lib/i18n'

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
  PENDING: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  PUBLISHED: { label: 'Đã xuất bản', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
}

type PostFormValues = z.input<typeof createPostSchema>

const EMPTY_CREATE: PostFormValues = {
  title: '', slug: '', content: '', excerpt: '', categoryId: '', status: 'DRAFT', imageUrl: '', authorId: '', seoTitle: '', seoDescription: '', seoKeywords: '',
}

export default function AdminCMS() {
  const { toast } = useToast()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { authUser } = useLMSStore()

  const [tab, setTab] = useState('posts')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<any>(null)
  const [viewingPost, setViewingPost] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const pagination = usePagination(10)

  const form = useForm<PostFormValues>({
    resolver: zodResolver(createPostSchema),
    defaultValues: EMPTY_CREATE,
  })

  // BlogPostFilterOpts has NO top-level `search` field — text search would go
  // via where_ors + ILIKE once a search UI exists. For now we only wire
  // server-driven paging.
  const opts = useMemo(() => ({
    ...paginate(pagination.pageIndex, pagination.pageSize),
  }), [pagination.pageIndex, pagination.pageSize])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['posts', opts],
    queryFn: () => getPostsPaginated(opts),
  })

  const posts = data?.items ?? []
  const pageInfo = derivePageInfo(data?.totalCount ?? 0, pagination.pageIndex, pagination.pageSize, posts.length)

  const { data: categories = [], isLoading: isLoadingCategories, isError: isCategoriesError } = useQuery({
    queryKey: ['post-categories'],
    queryFn: () => getPostCategories(),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreatePostInput) => createPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      toast({ title: t('cms.createSuccess', 'Tạo bài viết thành công') })
      closeDialog()
    },
    onError: () => toast({ title: t('cms.createFailed', 'Tạo bài viết thất bại'), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePostInput }) => updatePost(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      toast({ title: t('cms.updateSuccess', 'Cập nhật bài viết thành công') })
      closeDialog()
    },
    onError: () => toast({ title: t('cms.updateFailed', 'Cập nhật thất bại'), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      toast({ title: t('cms.deleteSuccess', 'Xóa bài viết thành công') })
      setDeleteOpen(false)
      setDeletingId(null)
    },
    onError: () => toast({ title: t('cms.deleteFailed', 'Xóa thất bại'), variant: 'destructive' }),
  })

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingPost(null)
    form.reset(EMPTY_CREATE)
  }

  const openCreate = () => {
    setEditingPost(null)
    form.reset({ ...EMPTY_CREATE, authorId: authUser?.id || '' })
    setDialogOpen(true)
  }

  const openEdit = (post: any) => {
    setEditingPost(post)
    form.reset({
      title: post.title || '', slug: post.slug || '', content: post.content || '',
      excerpt: post.excerpt || '', categoryId: post.categoryId || '', status: post.status || 'DRAFT',
      imageUrl: post.imageUrl || '', seoTitle: post.seoTitle || '', seoDescription: post.seoDescription || '', seoKeywords: post.seoKeywords || '',
      authorId: post.authorId || post.author?.id || authUser?.id || '',
    })
    setDialogOpen(true)
  }

  const handleImageUpload = async (file: File): Promise<string> => {
    try {
      const result = await uploadFile(file, 'posts')
      return result.fileUrl
    } catch (err) {
      console.error('Upload failed:', err)
      throw err
    }
  }

  const onSubmit = (values: PostFormValues) => {
    const data = { ...values }
    if (!data.slug) data.slug = data.title.toLowerCase().replace(/\s+/g, '-')
    if (editingPost) {
      updateMutation.mutate({ id: editingPost.id, data: updatePostSchema.parse(data) })
    } else {
      createMutation.mutate(createPostSchema.parse(data))
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
        title={t('cms.title', 'Quản lý nội dung')}
        description={t('cms.description', 'Quản lý bài viết và chuyên mục')}
        icon={Newspaper}
        accentColor="sky"
        actions={
          <Button onClick={openCreate} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('cms.writePost', 'Viết bài')}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="posts">{t('cms.posts', 'Bài viết')} ({pageInfo.totalItems})</TabsTrigger>
          <TabsTrigger value="categories">{t('cms.categories', 'Chuyên mục')} ({categories.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4">
          {posts.length === 0 ? (
            <EmptyState icon={Newspaper} title={t('cms.noPosts', 'Chưa có bài viết')} description={t('cms.noPostsDesc', 'Viết bài viết đầu tiên.')} actionLabel={t('cms.writePost', 'Viết bài')} onAction={openCreate} />
          ) : (
            <>
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="rounded-xl overflow-hidden border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="uppercase text-xs font-semibold">{t('cms.title', 'Tiêu đề')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold hidden md:table-cell">{t('cms.category', 'Chuyên mục')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('cms.author', 'Tác giả')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold">{t('common.status', 'Trạng thái')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold hidden lg:table-cell">{t('cms.publishDate', 'Ngày đăng')}</TableHead>
                      <TableHead className="uppercase text-xs font-semibold w-30">{t('common.actions', 'Thao tác')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((post: any) => {
                      const status = STATUS_MAP[post.status] || STATUS_MAP.DRAFT
                      const catName = categories.find((c: any) => c.id === post.categoryId)?.name || '-'
                      return (
                        <motion.tr key={post.id} variants={staggerItem} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-sm">{post.title}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{catName}</TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{post.authorName || post.author?.nickname || post.author?.name || authUser?.nickname || authUser?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge className={cn('rounded-full text-xs', status.className)}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {post.createdAt ? new Date(post.createdAt).toLocaleDateString('vi-VN') : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewingPost(post); setViewOpen(true) }}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(post)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => { setDeletingId(post.id); setDeleteOpen(true) }}>
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
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          {isLoadingCategories ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full" />
            </div>
          ) : isCategoriesError ? (
            <div className="py-10 text-center">
              <p className="text-sm text-destructive">{t('common.loadFailed', 'Tải thất bại')}</p>
            </div>
          ) : categories.length === 0 ? (
            <EmptyState icon={Newspaper} title={t('cms.noCategories', 'Chưa có chuyên mục')} description={t('cms.noCategoriesDesc', 'Tạo chuyên mục đầu tiên.')} />
          ) : (
            <div className="space-y-2">
              {categories.map((cat: any) => (
                <Card key={cat.id} className="rounded-xl border p-4 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{cat.name}</span>
                    <span className="text-xs text-muted-foreground ml-3">/{cat.slug}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{cat.slug}</Badge>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Post Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPost ? t('cms.editPost', 'Chỉnh sửa bài viết') : t('cms.newPost', 'Viết bài mới')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <Form {...form} schema={editingPost ? updatePostSchema : createPostSchema}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('cms.title', 'Tiêu đề')}</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('cms.titlePlaceholder', 'Tiêu đề bài viết')} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="tu-dong-tao" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('cms.category', 'Chuyên mục')}</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t('cms.selectCategory', 'Chọn chuyên mục')} /></SelectTrigger></FormControl>
                        <SelectContent>
                          {categories.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="excerpt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('cms.excerpt', 'Tóm tắt')}</FormLabel>
                    <FormControl><Textarea {...field} value={field.value ?? ''} rows={2} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('cms.content', 'Nội dung')}</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ''}
                        onChange={field.onChange}
                        onImageUpload={handleImageUpload}
                        className="min-h-75"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('cms.imageUrl', 'URL ảnh')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
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
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="seoTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SEO Title</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="seoKeywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SEO Keywords</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('cms.seoKeywordsPlaceholder', 'Từ khóa, cách nhau bởi dấu phẩy')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="seoDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SEO Description</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <input type="hidden" {...form.register('authorId')} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={closeDialog}>{t('common.cancel', 'Hủy')}</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {createMutation.isPending || updateMutation.isPending ? t('common.loading', 'Đang lưu...') : editingPost ? t('common.update', 'Cập nhật') : t('cms.createPost', 'Tạo bài')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Post Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingPost?.title}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          {viewingPost?.imageUrl && <img src={viewingPost.imageUrl} alt="" className="w-full rounded-lg" />}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{viewingPost?.content || viewingPost?.excerpt || t('cms.noContent', 'Chưa có nội dung')}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cms.confirmDelete', 'Xác nhận xóa bài viết')}</AlertDialogTitle>
            <AlertDialogDescription>{t('cms.confirmDeleteDesc', 'Bạn có chắc muốn xóa bài viết này? Hành động này không thể hoàn tác.')}</AlertDialogDescription>
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
