'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ListTodo, FileText, CheckCircle2, GraduationCap, AlertCircle, CalendarDays } from 'lucide-react'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { LoadingState } from '@/components/lms/loading-state'
import { ErrorState } from '@/components/lms/error-state'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLMSStore } from '@/store/lms-store'
import { format, parseISO, isPast } from 'date-fns'
import { getDashboard, getHomework } from '@/lib/api'
import { staggerContainer, staggerItem } from '@/components/lms/shared/animations'
import { useTranslation } from '@/lib/i18n'

const STATUS_MAP: Record<string, { label: string; className: string; hover: string }> = {
  pending: {
    label: 'Chờ nộp',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
    hover: 'hover:bg-yellow-100',
  },
  submitted: {
    label: 'Đã nộp',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400',
    hover: 'hover:bg-sky-100',
  },
  graded: {
    label: 'Đã chấm',
    className: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
    hover: 'hover:bg-green-100',
  },
}

function getHomeworkStatus(homework: any) {
  const submission = homework.submissions?.[0]
  if (submission?.grade) return 'graded'
  if (submission) return 'submitted'
  return 'pending'
}

export default function ParentHomework() {
  const { authUser } = useLMSStore()
  const { t } = useTranslation()

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'PARENT', authUser?.id, 'homework-child'],
    queryFn: () => getDashboard('PARENT', authUser!.id),
    enabled: !!authUser?.id,
  })

  const child = (dashboardQuery.data?.child || dashboardQuery.data?.student || {}) as Record<string, unknown>
  const childStudentId = (child?.id || child?.studentId) as string | undefined

  const homeworkQuery = useQuery({
    queryKey: ['homework', 'parent', childStudentId],
    queryFn: () => getHomework({ studentId: childStudentId }),
    enabled: !!childStudentId,
  })

  if (dashboardQuery.isLoading || homeworkQuery.isLoading) return <LoadingState />

  if (dashboardQuery.isError || homeworkQuery.isError) {
    return <ErrorState onRetry={() => { dashboardQuery.refetch(); homeworkQuery.refetch() }} />
  }

  const homework = homeworkQuery.data || []

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title={t('parent.homework.title', 'Bài tập')}
        description={t('parent.homework.description', 'Bài tập của con bạn (chỉ xem)')}
        icon={<ListTodo className="h-5 w-5" />}
        accentColor="sky"
      />

      {homework.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-10 w-10" />}
          title={t('parent.homework.noHomework', 'Chưa có bài tập nào')}
          description={t('parent.homework.noHomeworkDesc', 'Bài tập sẽ hiển thị ở đây khi giáo viên giao.')}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {homework.map((hw: any, idx: number) => {
            const status = getHomeworkStatus(hw)
            const statusInfo = STATUS_MAP[status]
            const submission = hw.submissions?.[0]
            const overdue = status === 'pending' && hw.deadline && isPast(parseISO(hw.deadline))

            return (
              <motion.div key={hw.id || idx} variants={staggerItem}>
                <Card className="rounded-xl border-l-4 border-l-sky-500 hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left content */}
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="h-5 w-5 text-sky-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm truncate">{hw.title}</h3>
                            <Badge className={`rounded-full text-[10px] font-medium ${statusInfo.className} ${statusInfo.hover}`}>
                              {overdue ? (
                                <>
                                  <AlertCircle className="h-3 w-3 mr-0.5" />
                                  {t('parent.homework.overdue', 'Quá hạn')}
                                </>
                              ) : status === 'graded' ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                  {statusInfo.label}
                                </>
                              ) : (
                                statusInfo.label
                              )}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {hw.class?.name || hw.className || '—'}
                            </span>
                            <span className="text-border">|</span>
                            <span className="flex items-center gap-1">
                              {hw.teacher?.name || hw.teacherName || '—'}
                            </span>
                            {hw.deadline && (
                              <>
                                <span className="text-border">|</span>
                                <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : ''}`}>
                                  <CalendarDays className="h-3 w-3" />
                                  {t('parent.homework.deadline', 'Hạn')}: {format(parseISO(hw.deadline), 'dd/MM/yyyy')}
                                </span>
                              </>
                            )}
                          </div>

                          {hw.description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {hw.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Show grade and feedback if graded */}
                    {status === 'graded' && submission && (
                      <div className="mt-3 ml-14 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                            {t('parent.homework.grade', 'Điểm')}: {submission.grade}
                          </span>
                        </div>
                        {submission.feedback && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {t('parent.homework.feedback', 'Nhận xét')}: {submission.feedback}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Show submitted info */}
                    {status === 'submitted' && submission && (
                      <div className="mt-3 ml-14 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-sky-600" />
                          <span className="text-xs text-sky-700 dark:text-sky-400">
                            {t('parent.homework.submitted', 'Đã nộp')}{submission.createdAt ? ` ${t('parent.homework.on', 'vào')} ${format(parseISO(submission.createdAt), 'dd/MM/yyyy')}` : ''}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </motion.div>
  )
}
