/**
 * Pure helpers for the weekly-repeat session flow. They mirror the server's
 * expansion in server/channels/app/lms/session.go (expandWeeklyOccurrences)
 * so the dialog's preview count matches what gets created.
 *
 * All dates are date-only "YYYY-MM-DD" strings (the VnTime wire format).
 */

const DAY_MS = 24 * 3600 * 1000
const WEEK_MS = 7 * DAY_MS

/** Cap matching the server's maxRepeatOccurrences. */
export const MAX_REPEAT_OCCURRENCES = 104

export type RepeatMode =
  | 'none' // single session — e.g. a makeup lesson (học bù)
  | 'weekly_until_class_end' // hàng tuần cho đến hết thời gian của lớp học
  | 'weekly_until_date' // hàng tuần đến ngày... (chosen explicitly)

export interface RepeatOption {
  mode: RepeatMode
  /** Target date the expansion runs to (inclusive), "" while not resolvable. */
  until: string
}

/** Parse "YYYY-MM-DD" to a UTC-midnight Date (invalid → null). */
export function parseDateOnly(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  return isNaN(d.getTime()) ? null : d
}

/** Format a Date as "YYYY-MM-DD" (UTC). */
export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Number of weekly occurrences from sessionDate to untilDate (inclusive). */
export function weeklyOccurrenceCount(sessionDate: string, untilDate: string): number {
  const start = parseDateOnly(sessionDate)
  const until = parseDateOnly(untilDate)
  if (!start || !until) return 0
  if (until.getTime() < start.getTime()) return 0
  const weeks = Math.floor((until.getTime() - start.getTime()) / WEEK_MS) + 1
  return Math.max(0, Math.min(weeks, MAX_REPEAT_OCCURRENCES))
}

/** The k-th occurrence date (k = 0 is the session's own date). */
export function occurrenceDate(sessionDate: string, k: number): string | null {
  const start = parseDateOnly(sessionDate)
  if (!start || k < 0) return null
  return formatDateOnly(new Date(start.getTime() + k * WEEK_MS))
}

/**
 * Resolve the repeat control into the payload's repeat_until value.
 * Returns "" for none; the target date for the weekly modes; and "" when a
 * weekly mode is selected but no target date is resolvable yet (the caller
 * treats that as "incomplete, block submit").
 */
export function resolveRepeatUntil(
  mode: RepeatMode,
  classEndDate: string | null | undefined,
  customUntil: string,
  sessionDate: string,
): string {
  switch (mode) {
    case 'none':
      return ''
    case 'weekly_until_class_end': {
      const end = classEndDate && /^\d{4}-\d{2}-\d{2}$/.test(classEndDate) ? classEndDate : ''
      if (!end) return ''
      // Guard: the class end must be on/after the session date.
      return weeklyOccurrenceCount(sessionDate, end) > 0 ? end : ''
    }
    case 'weekly_until_date':
      return customUntil && weeklyOccurrenceCount(sessionDate, customUntil) > 0 ? customUntil : ''
    default:
      return ''
  }
}

/** Short human label of the dates covered by a repeat ("05/09 → 27/12"). */
export function repeatRangeLabel(sessionDate: string, until: string): string {
  const fmt = (s: string) => {
    const [y, m, d] = s.split('-')
    return y ? `${d}/${m}/${y}` : s
  }
  if (!sessionDate || !until) return ''
  return `${fmt(sessionDate)} → ${fmt(until)}`
}
