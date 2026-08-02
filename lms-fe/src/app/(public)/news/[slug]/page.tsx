'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Markdown from 'react-markdown'
import { ArrowLeft, Calendar, User, Newspaper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n'
import { getPublicPosts } from '@/lib/api'
import { ErrorState } from '@/components/lms/error-state'

export default function NewsDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const { t } = useTranslation()

  const { data: posts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['public-posts'],
    queryFn: getPublicPosts,
  })

  const post = posts.find((p: any) => p.slug === slug || String(p.id) === slug) || null

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-24" />
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl mt-6" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        <div className="bg-gray-50 dark:bg-gray-950/50 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t('news.title', 'Tin tức')}</span>
              <span>/</span>
              <span className="text-foreground font-medium">...</span>
            </div>
          </div>
        </div>
        <ErrorState onRetry={() => refetch()} />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">{t('news.notFound', 'Không tìm thấy bài viết')}</h2>
          <p className="text-muted-foreground mb-6">{t('news.notFoundDesc', 'Bài viết bạn tìm kiếm không tồn tại hoặc đã bị xóa.')}</p>
          <Link href="/news">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('news.backToNews', 'Quay lại tin tức')}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const displayDate = post.publishedAt || String(post.createat)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="bg-gray-50 dark:bg-gray-950/50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/news" className="hover:text-sky-600 transition-colors">{t('news.title', 'Tin tức')}</Link>
            <span>/</span>
            <span className="text-foreground font-medium line-clamp-1">{post.title}</span>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Back link */}
        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-sky-600 transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('news.backToNews', 'Quay lại tin tức')}
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Category badge */}
          {post.categoryName && (
            <Badge variant="secondary" className="mb-4">
              {post.categoryName}
            </Badge>
          )}

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8 pb-6 border-b">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {displayDate
                ? new Date(displayDate).toLocaleDateString('vi-VN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : ''}
            </span>
            {post.authorName && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {post.authorName}
              </span>
            )}
          </div>

          {/* Image — backend BlogPost has no image field */}

          {/* Content */}
          <div className="prose prose-lg dark:prose-invert max-w-none">
            {post.content ? (
              <Markdown>{post.content}</Markdown>
            ) : (
              <div className="whitespace-pre-wrap leading-relaxed text-foreground/80">
                {post.excerpt || t('common.noData', 'Chưa có nội dung.')}
              </div>
            )}
          </div>
        </motion.div>

        {/* Bottom navigation */}
        <div className="mt-12 pt-6 border-t">
          <div className="flex items-center justify-between">
            <Link href="/news">
              <Button variant="outline" className="rounded-lg">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('news.allNews', 'Tất cả tin tức')}
              </Button>
            </Link>
            <Link href="/register">
              <Button className="rounded-lg bg-sky-600 hover:bg-sky-700">
                {t('news.registerCourse', 'Đăng ký học')}
              </Button>
            </Link>
          </div>
        </div>
      </article>
    </div>
  )
}
