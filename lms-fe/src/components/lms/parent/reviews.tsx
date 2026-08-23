'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Star, MessageSquare, CalendarDays, GraduationCap, ClipboardCheck } from 'lucide-react'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { LoadingState } from '@/components/lms/loading-state'
import { ErrorState } from '@/components/lms/error-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLMSStore } from '@/store/lms-store'
import { format, parseISO } from 'date-fns'
import { getWeeklyReviews } from '@/lib/api'
import { useParentChildren } from '@/lib/parent'
import { eq, and } from '@/lib/query'
import { staggerContainer, staggerItem } from '@/components/lms/shared/animations'
import { useTranslation } from '@/lib/i18n'

function StarRating({ rating, size = 'md' }: { rating: number | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' }
  const starSize = sizeClasses[size]
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${starSize} ${i <= (rating || 0) ? 'text-orange-400 fill-orange-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  )
}

export default function ParentReviews() {
  const { authUser } = useLMSStore()
  const { t } = useTranslation()

  // Children are students whose parent_id points at this user (lib/parent).
  const childrenQuery = useParentChildren(authUser?.id)
  const children = childrenQuery.data || []
  const childStudentId = children[0]?.id

  const reviewsQuery = useQuery({
    queryKey: ['weekly-reviews', 'parent', childStudentId],
    queryFn: () => getWeeklyReviews({ where_ands: and(eq('weekly_reviews.student_id', childStudentId)) }),
    enabled: !!childStudentId,
  })

  if (childrenQuery.isLoading || reviewsQuery.isLoading) return <LoadingState />

  if (childrenQuery.isError || reviewsQuery.isError) {
    return <ErrorState onRetry={() => { childrenQuery.refetch(); reviewsQuery.refetch() }} />
  }

  const reviews = reviewsQuery.data || []

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title={t('parent.reviews.title', 'Nhận xét học viên')}
        description={t('parent.reviews.description', 'Nhận xét giáo viên về con bạn')}
        icon={<ClipboardCheck className="h-5 w-5" />}
        accentColor="amber"
      />

      {reviews.length === 0 ? (
        <EmptyState
          icon={<Star className="h-10 w-10" />}
          title={t('parent.reviews.noReviews', 'Chưa có nhận xét nào')}
          description={t('parent.reviews.noReviewsDesc', 'Nhận xét của giáo viên sẽ hiển thị ở đây sau khi có buổi học.')}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-4 md:grid-cols-2"
        >
          {reviews.map((review: any, idx: number) => (
            <motion.div key={review.id || idx} variants={staggerItem}>
              <Card className="rounded-xl border-l-4 border-l-amber-400 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                        <GraduationCap className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate">
                          {review.class?.name || review.className || t('parent.reviews.defaultClass', 'Lớp học')}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                            {t('parent.reviews.week', 'Tuần')} {review.weekNumber || '—'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {review.createdAt ? format(parseISO(review.createdAt), 'dd/MM/yyyy') : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {review.content && (
                    <div className="flex gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {review.content}
                      </p>
                    </div>
                  )}
                  {review.creator && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-[10px] text-muted-foreground">
                        {t('parent.reviews.teacherAbbr', 'GV')}: <span className="font-medium">{review.creator.name || review.teacherName || '—'}</span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
