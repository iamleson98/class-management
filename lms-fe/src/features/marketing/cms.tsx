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
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/data-table'
import { createMarketingPostColumns, type MarketingPostRow } from './cms-columns'
import RichTextEditor from '@/components/ui/mdx-editor'
import { uploadLmsFile } from '@/lib/file-upload'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { getPosts, createPost, updatePost } from '@/lib/api'
import { contains, or } from '@/lib/query'
import { useTranslation } from '@/lib/i18n'

type MarketingPostFormValues = z.input<typeof createPostSchema>

const EMPTY_CREATE: MarketingPostFormValues = {
  title: '', slug: '', content: '', excerpt: '', categoryId: '', status: 'DRAFT', authorId: '', seoTitle: '', seoDescription: '', seoKeywords: '',
}

export default function MarketingCMSPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { authUser } = useLMSStore()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<MarketingPostRow | null>(null)

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
    onError: (err: unknown) => {
      toast({ title: (err as Error)?.message || t('common.error', 'Có lỗi xảy ra'), variant: 'destructive' })
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
      const result = await uploadLmsFile(file)
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

  const columns = useMemo(
    () => createMarketingPostColumns(t, (post) => handleEdit(post as MarketingPostRow)),
    [t, handleEdit]
  )

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

      <DataTable
        columns={columns}
        data={posts}
        paginationMode="client"
        initialPageSize={10}
        isLoading={isLoading}
        toolbarActions={
          <div className="relative w-full sm:max-w-70">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-slot="marketing-cms-search"
              placeholder={t('marketing.cms.searchPlaceholder', 'Tìm kiếm bài viết...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        }
        emptyState={
          <EmptyState
            icon={<Newspaper className="h-12 w-12" />}
            title={t('marketing.cms.noPostsTitle', 'Chưa có bài viết')}
            description={t('marketing.cms.noPostsDesc', 'Hãy tạo bài viết mới')}
            actionLabel={t('marketing.cms.addPost', 'Thêm bài viết')}
            onAction={handleAdd}
          />
        }
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
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
