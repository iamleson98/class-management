'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Newspaper, Calendar, ArrowRight, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n'
import { getPublicPosts } from '@/lib/api'
import { ErrorState } from '@/components/lms/error-state'

export default function NewsPage() {
  const [search, setSearch] = useState('')
  const { t } = useTranslation()

  const { data: posts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['public-posts'],
    queryFn: getPublicPosts,
  })

  const filtered = posts.filter(
    (p) => !search || p.title?.toLowerCase().includes(search.toLowerCase())
  )

  if (isError) {
    return (
      <div>
        <section className="bg-linear-to-r from-sky-600 to-teal-600 py-16 sm:py-20 relative overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-white">
              {t('news.title', 'Tin tức')}
            </h1>
          </div>
        </section>
        <ErrorState onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div>
      {/* Hero Banner */}
      <section className="bg-linear-to-r from-sky-600 to-teal-600 py-16 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-20 w-72 h-72 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-bold text-white"
          >
            {t('news.title', 'Tin tức')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-sky-100 text-lg max-w-2xl mx-auto"
          >
            {t('news.subtitle', 'Cập nhật thông tin và kiến thức học tiếng Anh')}
          </motion.p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Search */}
          <div className="max-w-sm mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search', 'Tìm bài viết...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Posts Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-72 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((post, idx) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                >
                  <Link href={`/news/${post.slug || post.id}`}>
                    <Card className="h-full hover:shadow-lg transition-shadow group border-0 shadow-sm flex flex-col cursor-pointer">
                      {/* Image */}
                      <div className="aspect-16/10 bg-gray-100 dark:bg-gray-800 rounded-t-xl overflow-hidden relative">
                        {post.imageUrl ? (
                          <img
                            src={post.imageUrl}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-sky-50 dark:bg-sky-900/20">
                            <Newspaper className="h-10 w-10 text-sky-300 dark:text-sky-700" />
                          </div>
                        )}
                        {post.categoryName && (
                          <Badge className="absolute top-3 left-3 bg-sky-600 text-white border-0 text-[10px]">
                            {post.categoryName}
                          </Badge>
                        )}
                      </div>

                      <CardContent className="p-5 flex-1 flex flex-col">
                        <h3 className="font-bold text-base mb-2 line-clamp-2 group-hover:text-sky-600 transition-colors flex-1">
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {post.excerpt}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-auto pt-3 border-t">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {post.publishedAt
                              ? new Date(post.publishedAt).toLocaleDateString('vi-VN')
                              : post.createat
                                ? new Date(post.createat).toLocaleDateString('vi-VN')
                                : ''}
                          </div>
                          <span className="text-sky-600 text-xs font-medium group-hover:underline flex items-center gap-1">
                            {t('news.readMore', 'Đọc thêm')}
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-bold text-xl mb-2">{t('news.noPosts', 'Chưa có bài viết')}</h3>
              <p className="text-muted-foreground">
                {search ? t('news.noSearchResults', 'Không tìm thấy bài viết phù hợp.') : t('news.comeBackLater', 'Vui lòng quay lại sau.')}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
