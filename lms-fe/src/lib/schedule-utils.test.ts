import { describe, expect, it } from 'vitest'

import {
  MAX_REPEAT_OCCURRENCES,
  occurrenceDate,
  parseDateOnly,
  repeatRangeLabel,
  resolveRepeatUntil,
  weeklyOccurrenceCount,
  type RepeatMode,
} from './schedule-utils'

describe('parseDateOnly', () => {
  it('parses valid dates to UTC midnight', () => {
    const d = parseDateOnly('2026-09-05')
    expect(d?.toISOString()).toBe('2026-09-05T00:00:00.000Z')
  })

  it('rejects invalid shapes', () => {
    expect(parseDateOnly('05/09/2026')).toBeNull()
    expect(parseDateOnly('')).toBeNull()
    expect(parseDateOnly(undefined)).toBeNull()
    expect(parseDateOnly('2026-13-45')).toBeNull()
  })
})

describe('weeklyOccurrenceCount', () => {
  it('counts inclusive weekly occurrences', () => {
    expect(weeklyOccurrenceCount('2026-09-07', '2026-09-07')).toBe(1)
    expect(weeklyOccurrenceCount('2026-09-07', '2026-10-05')).toBe(5)
    expect(weeklyOccurrenceCount('2026-09-07', '2026-09-06')).toBe(0)
    // Until a mid-week day: same count as the Saturday before it.
    expect(weeklyOccurrenceCount('2026-09-07', '2026-09-09')).toBe(1)
  })

  it('caps at the server limit', () => {
    expect(weeklyOccurrenceCount('2026-01-01', '2040-01-01')).toBe(MAX_REPEAT_OCCURRENCES)
  })

  it('returns 0 for invalid input', () => {
    expect(weeklyOccurrenceCount('nope', '2026-10-05')).toBe(0)
  })
})

describe('occurrenceDate', () => {
  it('advances by exact weeks', () => {
    expect(occurrenceDate('2026-09-07', 0)).toBe('2026-09-07')
    expect(occurrenceDate('2026-09-07', 1)).toBe('2026-09-14')
    expect(occurrenceDate('2026-09-07', 4)).toBe('2026-10-05')
  })
})

describe('resolveRepeatUntil', () => {
  const sessionDate = '2026-09-07'

  it('none → empty', () => {
    expect(resolveRepeatUntil('none', '2026-12-30', '2026-10-01', sessionDate)).toBe('')
  })

  it('weekly_until_class_end uses the class end date', () => {
    expect(resolveRepeatUntil('weekly_until_class_end', '2026-12-28', '', sessionDate)).toBe('2026-12-28')
  })

  it('weekly_until_class_end with missing end date is unresolved', () => {
    expect(resolveRepeatUntil('weekly_until_class_end', null, '', sessionDate)).toBe('')
    expect(resolveRepeatUntil('weekly_until_class_end', '', '', sessionDate)).toBe('')
  })

  it('weekly_until_class_end before the session date is unresolved', () => {
    expect(resolveRepeatUntil('weekly_until_class_end', '2026-09-01', '', sessionDate)).toBe('')
  })

  it('weekly_until_date uses the custom date', () => {
    expect(resolveRepeatUntil('weekly_until_date', null, '2026-11-02', sessionDate)).toBe('2026-11-02')
    expect(resolveRepeatUntil('weekly_until_date', null, '2026-09-01', sessionDate)).toBe('')
    expect(resolveRepeatUntil('weekly_until_date', null, '', sessionDate)).toBe('')
  })

  it('unknown mode falls back to empty', () => {
    expect(resolveRepeatUntil('bogus' as RepeatMode, '2026-12-28', '', sessionDate)).toBe('')
  })
})

describe('repeatRangeLabel', () => {
  it('formats dd/MM/yyyy range', () => {
    expect(repeatRangeLabel('2026-09-07', '2026-12-28')).toBe('07/09/2026 → 28/12/2026')
  })

  it('empty for missing parts', () => {
    expect(repeatRangeLabel('2026-09-07', '')).toBe('')
  })
})
