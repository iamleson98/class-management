'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Star, MessageSquare, CalendarDays, GraduationCap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { LoadingState } from '@/components/lms/loading-state'
import { ErrorState } from '@/components/lms/error-state'
import { useLMSStore } from '@/store/lms-store'
import { getWeeklyReviews } from '@/lib/api'
import { eq, and } from '@/lib/query'
import { format, parseISO } from 'date-fns'
import { staggerContainer, staggerItem } from '@/components/lms/shared/animations'
import { useTranslation } from '@/lib/i18n'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating
              ? 'fill-orange-400 text-orange-400'
              : 'fill-muted text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  )
}

export default function StudentReviews() {
  const { authUser } = useLMSStore()
  const { t } = useTranslation()

  const { data: reviews, isLoading, isError, refetch } = useQuery({
    queryKey: ['weekly-reviews', 'student', authUser?.id],
    queryFn: () => getWeeklyReviews({ where_ands: and(eq('weekly_reviews.student_id', authUser!.id)) }),
    enabled: !!authUser?.id,
  })

  if (isLoading) return <LoadingState />

  if (isError) return <ErrorState onRetry={() => refetch()} />

  const items = reviews || []

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title={t('student.reviews.title', 'Đánh giá hàng tuần')}
        description={t('student.reviews.description', 'Xem đánh giá và nhận xét của giáo viên về quá trình học tập')}
        icon={<Star className="h-5 w-5" />}
        accentColor="amber"
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Star className="h-10 w-10" />}
          title={t('student.reviews.noReviews', 'Chưa có đánh giá nào')}
          description={t('student.reviews.noReviewsDesc', 'Giáo viên sẽ gửi đánh giá hàng tuần sau mỗi buổi học. Hãy quay lại sau!')}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-4 md:grid-cols-2"
        >
          {items.map((review: any, idx: number) => (
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
                          {review.className || review.class?.name || t('student.reviews.defaultClass', 'Lớp học')}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                            {t('student.reviews.week', 'Tuần')} {review.weekNumber || review.week || '—'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {review.createdAt
                              ? format(parseISO(review.createdAt), 'dd/MM/yyyy')
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <StarRating rating={review.rating || 0} />
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
                        {t('student.reviews.teacherAbbr', 'GV')}: <span className="font-medium">{review.creator.name || review.teacherName || '—'}</span>
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
