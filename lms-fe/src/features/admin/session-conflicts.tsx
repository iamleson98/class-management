'use client'

/**
 * Shared bits for the session create/edit dialogs: teacher-conflict banner
 * (HTTP 409 payload) and a tiny date labeler. Kept local to this file since
 * only the schedule dialogs render them.
 */

import { AlertTriangle, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { epochMsToHHmm, type SessionConflictItem } from '@/lib/api'

/** "2026-09-07" → "07/09/2026" (falls back to the raw string). */
export function formatConflictDate(s: string): string {
  const parts = (s || '').split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : s
}

interface ConflictBannerProps {
  conflicts: SessionConflictItem[]
  /** Retry with force (create anyway) after the admin reviews the list. */
  onForce: () => void
  onDismiss: () => void
  /** Verb used on the force button (create vs save). */
  actionLabel: string
  isPending: boolean
}

/**
 * Renders the teacher's conflicting sessions returned by the 409 response:
 * one row per conflicting class with its date and time, plus the
 * "proceed anyway" / "adjust time" actions.
 */
export function TeacherConflictBanner({ conflicts, onForce, onDismiss, actionLabel, isPending }: ConflictBannerProps) {
  const { t } = useTranslation()
  if (conflicts.length === 0) return null

  const teacherName = conflicts[0]?.teacherName || conflicts[0]?.teacherId || ''

  return (
    <div
      role="alert"
      data-testid="teacher-conflict-banner"
      className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/60 p-3 space-y-2"
    >
      <p className="flex items-start gap-2 text-sm font-medium text-amber-900 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          {teacherName
            ? t('schedule.conflictTeacherBusy', `Giáo viên ${teacherName} đã có lịch trùng:`)
            : t('schedule.conflictGeneric', 'Giáo viên đã có lịch trùng:')}
        </span>
      </p>
      <ul className="max-h-35 overflow-y-auto text-xs text-amber-900/90 dark:text-amber-200/90 space-y-1 pl-6 list-disc">
        {conflicts.slice(0, 10).map((cf, i) => (
          <li key={`${cf.classId}-${cf.date}-${i}`}>
            <span className="font-semibold">{formatConflictDate(cf.date)}</span>
            {' · '}
            <span>{epochMsToHHmm(cf.startTime)}–{epochMsToHHmm(cf.endTime)}</span>
            {' · '}
            <span>{cf.className || cf.classId || t('schedule.conflictUnknownClass', 'Lớp khác')}</span>
          </li>
        ))}
        {conflicts.length > 10 && (
          <li className="text-amber-700/80 dark:text-amber-400/80">
            +{conflicts.length - 10} {t('schedule.conflictMore', 'buổi khác...')}
          </li>
        )}
      </ul>
      <div className="flex flex-wrap gap-2 pt-0.5">
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
          {t('schedule.conflictAdjust', 'Chỉnh sửa thời gian')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onForce}
          disabled={isPending}
          className={cn('bg-amber-600 hover:bg-amber-700 text-white')}
        >
          <TriangleAlert className="h-3.5 w-3.5" />
          {actionLabel}
        </Button>
      </div>
    </div>
  )
}
