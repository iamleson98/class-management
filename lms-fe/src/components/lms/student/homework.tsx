'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  FileText, Upload, CalendarDays, GraduationCap,
  CheckCircle2, AlertCircle, Send
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/lms/page-header'
import { EmptyState } from '@/components/lms/empty-state'
import { LoadingState } from '@/components/lms/loading-state'
import { ErrorState } from '@/components/lms/error-state'
import { useLMSStore } from '@/store/lms-store'
import { getHomework, submitHomework } from '@/lib/api'
import { format, parseISO } from 'date-fns'
import { staggerContainer, staggerItem } from '@/components/lms/shared/animations'
import { useTranslation } from '@/lib/i18n'

// type HomeworkStatus = 'PENDING' | 'SUBMITTED' | 'GRADED'

function getStatusConfig(status: string) {
  switch (status) {
    case 'SUBMITTED':
      return {
        label: 'Đã nộp',
        bg: 'bg-sky-100 dark:bg-sky-950/30',
        text: 'text-sky-700 dark:text-sky-400',
        hover: 'hover:bg-sky-100',
      }
    case 'GRADED':
      return {
        label: 'Đã chấm',
        bg: 'bg-green-100 dark:bg-green-950/30',
        text: 'text-green-700 dark:text-green-400',
        hover: 'hover:bg-green-100',
      }
    default:
      return {
        label: 'Chờ nộp',
        bg: 'bg-yellow-100 dark:bg-yellow-950/30',
        text: 'text-yellow-700 dark:text-yellow-400',
        hover: 'hover:bg-yellow-100',
      }
  }
}

function isOverdue(deadline: string): boolean {
  try {
    return new Date(deadline) < new Date()
  } catch {
    return false
  }
}

export default function StudentHomework() {
  const { authUser } = useLMSStore()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedHomework, setSelectedHomework] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: homework, isLoading, isError, refetch } = useQuery({
    queryKey: ['homework', 'student', authUser?.id],
    queryFn: () => getHomework({ studentId: authUser!.id }),
    enabled: !!authUser?.id,
  })

  const handleSubmit = async () => {
    if (!selectedHomework || !selectedFile) return
    setSubmitting(true)
    try {
      await submitHomework({
        homeworkId: selectedHomework.id,
        file: selectedFile,
        note,
      })
      queryClient.invalidateQueries({ queryKey: ['homework', 'student', authUser?.id] })
      setDialogOpen(false)
      setSelectedHomework(null)
      setSelectedFile(null)
      setNote('')
    } catch (err) {
      console.error('Submit homework failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const openUploadDialog = (hw: any) => {
    setSelectedHomework(hw)
    setSelectedFile(null)
    setNote('')
    setDialogOpen(true)
  }

  if (isLoading) return <LoadingState />

  if (isError) return <ErrorState onRetry={() => refetch()} />

  const items = (homework || []) as Array<any>

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title={t('student.homework.title', 'Bài tập về nhà')}
        description={t('student.homework.description', 'Xem và nộp bài tập được giao bởi giáo viên')}
        icon={<FileText className="h-5 w-5" />}
        accentColor="sky"
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title={t('student.homework.noHomework', 'Chưa có bài tập nào')}
          description={t('student.homework.noHomeworkDesc', 'Giáo viên sẽ giao bài tập khi cần thiết. Hãy kiểm tra lại sau!')}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {items.map((hw: any, idx: number) => {
            const statusConfig = getStatusConfig(hw.status)
            const overdue = hw.status === 'PENDING' && hw.deadline && isOverdue(hw.deadline)

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
                            <Badge
                              className={`rounded-full text-[10px] font-medium ${statusConfig.bg} ${statusConfig.text} ${statusConfig.hover}`}
                            >
                              {overdue ? (
                                <>
                                  <AlertCircle className="h-3 w-3 mr-0.5" />
                                  {t('student.homework.overdue', 'Quá hạn')}
                                </>
                              ) : hw.status === 'GRADED' ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                  {statusConfig.label}
                                </>
                              ) : (
                                statusConfig.label
                              )}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {hw.className || hw.class?.name || '—'}
                            </span>
                            <span className="text-border">|</span>
                            <span className="flex items-center gap-1">
                              {hw.teacherName || hw.teacher?.name || '—'}
                            </span>
                            <span className="text-border">|</span>
                            <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : ''}`}>
                              <CalendarDays className="h-3 w-3" />
                              {t('student.homework.deadline', 'Hạn')}: {hw.deadline ? format(parseISO(hw.deadline), 'dd/MM/yyyy') : '—'}
                            </span>
                          </div>

                          {/* Description */}
                          {hw.description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {hw.description}
                            </p>
                          )}

                          {/* Grade & Feedback */}
                          {hw.status === 'GRADED' && (
                            <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                                  {t('student.homework.grade', 'Điểm')}: {hw.grade != null ? hw.grade : '—'}
                                </span>
                              </div>
                              {hw.feedback && (
                                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                  {t('student.homework.feedback', 'Nhận xét')}: {hw.feedback}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Submitted info */}
                          {hw.status === 'SUBMITTED' && (
                            <div className="mt-3 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-sky-600" />
                                <span className="text-xs text-sky-700 dark:text-sky-400">
                                  {t('student.homework.submitted', 'Đã nộp')}{hw.submittedAt ? ` ${t('student.homework.on', 'vào')} ${format(parseISO(hw.submittedAt), 'dd/MM/yyyy')}` : ''}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Submit button */}
                      {hw.status === 'PENDING' && (
                        <Button
                          size="sm"
                          onClick={() => openUploadDialog(hw)}
                          className="shrink-0 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs gap-1.5"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {t('student.homework.submit', 'Nộp bài')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Upload Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('student.homework.submitHomework', 'Nộp bài tập')}</DialogTitle>
            <DialogDescription>
              {t('student.homework.uploadFor', 'Tải lên file bài làm cho')}: {selectedHomework?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* File input */}
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-sky-400 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setSelectedFile(file)
                }}
              />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-sky-100 dark:bg-sky-950/30 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-sky-600" />
                  </div>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('student.homework.clickToSelect', 'Nhấn để chọn file')}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('student.homework.fileTypes', 'PDF, DOCX, JPG, PNG (tối đa 10MB)')}
                  </p>
                </div>
              )}
            </div>

            {/* Note */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t('student.homework.note', 'Ghi chú')} ({t('student.homework.optional', 'tuỳ chọn')})
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('student.homework.notePlaceholder', 'Thêm ghi chú cho giáo viên...')}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-lg"
            >
              {t('common.cancel', 'Hủy')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedFile || submitting}
              className="bg-sky-500 hover:bg-sky-600 text-white rounded-lg gap-1.5"
            >
              {submitting ? (
                <>
                  <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                  {t('student.homework.submitting', 'Đang nộp...')}
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  {t('student.homework.submit', 'Nộp bài')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
