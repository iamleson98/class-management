'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Newspaper, Plus, Pencil, Search, Eye } from 'lucide-react'
import { createPostSchema, updatePostSchema } from '@/lib/schemas'
import { useLMSStore } from '@/store/lms-store'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/lms/page-header'
import { ErrorState } from '@/components/lms/error-state'
import { EmptyState } from '@/components/lms/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import RichTextEditor from '@/components/ui/mdx-editor'
import { uploadFile } from '@/lib/file-upload'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { getPosts, createPost, updatePost } from '@/lib/api'
import { contains, or } from '@/lib/query'
import { useTranslation } from '@/lib/i18n'

type MarketingPostFormValues = z.input<typeof createPostSchema>

const EMPTY_CREATE: MarketingPostFormValues = {
  title: '', slug: '', content: '', excerpt: '', categoryId: '', status: 'DRAFT', imageUrl: '', authorId: '', seoTitle: '', seoDescription: '', seoKeywords: '',
}

export default function MarketingCMSPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { authUser } = useLMSStore()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<any>(null)

  const form = useForm<MarketingPostFormValues>({
    resolver: zodResolver(createPostSchema),
    defaultValues: EMPTY_CREATE,
  })

  // BlogPostFilterOpts has no top-level `search` field → ILIKE on title.
  const opts = useMemo(() => ({ where_ors: or(contains('blog_posts.title', search)) }), [search])

  const { data: posts, isLoading, isError, refetch } = useQuery({
    queryKey: ['posts', opts],
    queryFn: () => getPosts(opts),
  })

  const mutation = useMutation({
    mutationFn: (data: any) => editingPost ? updatePost(editingPost.id, data) : createPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      toast({ title: editingPost ? t('marketing.cms.updateSuccess', 'Cập nhật bài viết thành công') : t('marketing.cms.createSuccess', 'Tạo bài viết thành công') })
      closeDialog()
    },
    onError: () => {
      toast({ title: t('common.error', 'Có lỗi xảy ra'), variant: 'destructive' })
    },
  })

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingPost(null)
    form.reset(EMPTY_CREATE)
  }

  const handleEdit = (post: any) => {
    setEditingPost(post)
    form.reset({
      title: post.title || '',
      slug: post.slug || '',
      content: post.content || '',
      excerpt: post.excerpt || '',
      categoryId: post.categoryId || '',
      status: post.status || 'DRAFT',
      imageUrl: post.imageUrl || '',
      seoTitle: post.seoTitle || '',
      seoDescription: post.seoDescription || '',
      seoKeywords: post.seoKeywords || '',
      authorId: post.authorId || post.author?.id || authUser?.id || '',
    })
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingPost(null)
    form.reset({ ...EMPTY_CREATE, authorId: authUser?.id || '' })
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

  const onSubmit = (values: MarketingPostFormValues) => {
    const data = { ...values }
    if (!data.slug && data.title) {
      data.slug = data.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    }
      mutation.mutate(editingPost ? updatePostSchema.parse(data) : createPostSchema.parse(data))
  }

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'NEWS': return <Badge variant="outline">{t('marketing.cms.categoryNews', 'Tin tức')}</Badge>
      case 'PROMOTION': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{t('marketing.cms.categoryPromotion', 'Khuyến mãi')}</Badge>
      case 'EVENT': return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">{t('marketing.cms.categoryEvent', 'Sự kiện')}</Badge>
      case 'BLOG': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{t('marketing.cms.categoryBlog', 'Blog')}</Badge>
      default: return <Badge variant="outline">{category}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{t('marketing.cms.statusPublished', 'Đã xuất bản')}</Badge>
      case 'DRAFT': return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">{t('marketing.cms.statusDraft', 'Nháp')}</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredPosts = posts || []

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title={t('marketing.cms.title', 'Quản lý nội dung')}
        description={t('marketing.cms.description', 'Quản lý bài viết và nội dung marketing')}
        icon={<Newspaper className="h-5 w-5" />}
        accentColor="pink"
        actions={
          <Button onClick={handleAdd} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('marketing.cms.addPost', 'Thêm bài viết')}
          </Button>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('marketing.cms.searchPlaceholder', 'Tìm kiếm bài viết...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3 text-muted-foreground">{t('common.loading', 'Đang tải...')}</span>
        </div>
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-12 w-12" />}
          title={t('marketing.cms.noPostsTitle', 'Chưa có bài viết')}
          description={t('marketing.cms.noPostsDesc', 'Hãy tạo bài viết mới')}
          actionLabel={t('marketing.cms.addPost', 'Thêm bài viết')}
          onAction={handleAdd}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('marketing.cms.colTitle', 'Tiêu đề')}</TableHead>
                <TableHead>{t('marketing.cms.colCategory', 'Chuyên mục')}</TableHead>
                <TableHead>{t('common.status', 'Trạng thái')}</TableHead>
                <TableHead className="w-25 text-right">{t('common.actions', 'Thao tác')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPosts.map((post: any) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>{getCategoryBadge(post.category)}</TableCell>
                  <TableCell>{getStatusBadge(post.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title={t('common.view', 'Xem')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(post)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPost ? t('marketing.cms.editPost', 'Chỉnh sửa bài viết') : t('marketing.cms.newPost', 'Thêm bài viết mới')}</DialogTitle>
            <DialogDescription>
              {editingPost ? t('marketing.cms.editPostDesc', 'Cập nhật nội dung bài viết') : t('marketing.cms.newPostDesc', 'Nhập nội dung bài viết mới')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form} schema={editingPost ? updatePostSchema : createPostSchema}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('marketing.cms.fieldTitle', 'Tiêu đề')}</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('marketing.cms.titlePlaceholder', 'Tiêu đề bài viết')} /></FormControl>
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.status', 'Trạng thái')}</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t('marketing.cms.selectStatus', 'Chọn trạng thái')} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="DRAFT">{t('marketing.cms.statusDraft', 'Nháp')}</SelectItem>
                          <SelectItem value="PUBLISHED">{t('marketing.cms.statusPublished', 'Đã xuất bản')}</SelectItem>
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
                    <FormLabel>{t('marketing.cms.fieldExcerpt', 'Tóm tắt')}</FormLabel>
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
                    <FormLabel>{t('marketing.cms.fieldContent', 'Nội dung')}</FormLabel>
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
              <input type="hidden" {...form.register('authorId')} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>{t('common.cancel', 'Hủy')}</Button>
                <Button type="submit" disabled={mutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {mutation.isPending ? t('common.loading', 'Đang lưu...') : editingPost ? t('common.update', 'Cập nhật') : t('common.create', 'Tạo mới')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
