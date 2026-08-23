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
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { useLMSStore } from '@/store/lms-store'
import { getHomework, getHomeworkSubmissions, submitHomework } from '@/lib/api'
import { uploadLmsFile } from '@/lib/file-upload'
import { useToast } from '@/hooks/use-toast'
import { format, parseISO } from 'date-fns'
import { staggerContainer, staggerItem } from '@/components/shared/animations'
import { useTranslation } from '@/lib/i18n'


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
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedHomework, setSelectedHomework] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: homework, isLoading, isError, refetch } = useQuery({
    queryKey: ['homework', 'student', authUser?.id],
    // NOTE: homeworks has no student_id column (homework↔student is via
    // submissions/enrollment, a backend join not exposed here). Fetch all
    // homework; student-scoping is a backend follow-up.
    queryFn: () => getHomework(),
    enabled: !!authUser?.id,
  })

  const homeworkIds = ((homework || []) as Array<any>).map((hw) => hw.id)

  // The homework list has no per-student state — fetch MY submission for each
  // homework (small N; cached under the same key as the list so it refreshes
  // after a successful submit).
  const { data: mySubmissions = [] } = useQuery({
    queryKey: ['homework', 'student-submissions', authUser?.id, homeworkIds.join(',')],
    queryFn: async () => {
      if (!homeworkIds.length) return []
      const results = await Promise.all(
        homeworkIds.map((id) => getHomeworkSubmissions(id).catch(() => [])),
      )
      // Flatten and keep only this student's rows → map homeworkId → submission.
      const mine = results
        .flat()
        .filter((s: any) => s.studentId === authUser?.id)
      return mine
    },
    enabled: !!authUser?.id && homeworkIds.length > 0,
  })

  /** This student's submission for a homework, if any. */
  const submissionFor = (homeworkId: string) =>
    (mySubmissions as Array<any>).find((s) => s.homeworkId === homeworkId) || null

  const handleSubmit = async () => {
    if (!selectedHomework || !selectedFile || !authUser?.id) return
    setSubmitting(true)
    try {
      // 1. Upload the file via /api/v4/files (returns the FileInfo id).
      const uploaded = await uploadLmsFile(selectedFile)
      // 2. Upsert the submission — student_id is required by the backend.
      await submitHomework(selectedHomework.id, {
        studentId: authUser.id,
        description: note || undefined,
        fileId: uploaded.fileId,
      })
      queryClient.invalidateQueries({ queryKey: ['homework', 'student', authUser?.id] })
      queryClient.invalidateQueries({ queryKey: ['homework', 'student-submissions'] })
      setDialogOpen(false)
      setSelectedHomework(null)
      setSelectedFile(null)
      setNote('')
      toast({ title: t('student.homework.submitSuccess', 'Nộp bài thành công') })
    } catch (err) {
      toast({
        title: (err as Error)?.message || t('student.homework.submitFailed', 'Nộp bài thất bại'),
        variant: 'destructive',
      })
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
            // Real submission state from the backend (no status column on
            // homework — submitted/graded is derived from my submission row;
            // "graded" = teacher left feedback).
            const submission = submissionFor(hw.id)
            const submitted = !!submission
            const graded = submitted && !!submission.feedback
            const overdue = !submitted && hw.deadline && isOverdue(hw.deadline)

            const statusBadge = graded
              ? { label: t('student.homework.graded', 'Đã chấm'), bg: 'bg-green-100 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400' }
              : submitted
                ? { label: t('student.homework.submitted', 'Đã nộp'), bg: 'bg-sky-100 dark:bg-sky-950/30', text: 'text-sky-700 dark:text-sky-400' }
                : overdue
                  ? { label: t('student.homework.overdue', 'Quá hạn'), bg: 'bg-red-100 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400' }
                  : { label: t('student.homework.pending', 'Chờ nộp'), bg: 'bg-yellow-100 dark:bg-yellow-950/30', text: 'text-yellow-700 dark:text-yellow-400' }

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
                            <Badge className={`rounded-full text-[10px] font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                              {graded || overdue ? (
                                <>
                                  {overdue ? <AlertCircle className="h-3 w-3 mr-0.5" /> : <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                                  {statusBadge.label}
                                </>
                              ) : (
                                statusBadge.label
                              )}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {hw.className || hw.class?.name || '—'}
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

                          {/* Teacher feedback (from my graded submission) */}
                          {graded && (
                            <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30">
                              <p className="text-xs text-green-600 dark:text-green-400">
                                {t('student.homework.feedback', 'Nhận xét')}: {submission.feedback}
                              </p>
                            </div>
                          )}

                          {/* Submitted info */}
                          {submitted && (
                            <div className="mt-3 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-sky-600" />
                                <span className="text-xs text-sky-700 dark:text-sky-400">
                                  {t('student.homework.submitted', 'Đã nộp')}{submission.createdAt ? ` ${t('student.homework.on', 'vào')} ${format(new Date(submission.createdAt), 'dd/MM/yyyy')}` : ''}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Submit button — always available; the backend upserts
                          (re-submission replaces the previous file). */}
                      <Button
                        size="sm"
                        onClick={() => openUploadDialog(hw)}
                        variant={submitted ? 'outline' : 'default'}
                        className="shrink-0 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs gap-1.5"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {submitted ? t('student.homework.resubmit', 'Nộp lại') : t('student.homework.submit', 'Nộp bài')}
                      </Button>
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
