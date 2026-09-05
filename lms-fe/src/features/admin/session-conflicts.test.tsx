import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { TeacherConflictBanner, formatConflictDate } from './session-conflicts'
import type { SessionConflictItem } from '@/lib/api'

const conflict = (over: Partial<SessionConflictItem> = {}): SessionConflictItem => ({
  date: '2026-09-07',
  startTime: Date.parse('2026-09-07T01:00:00Z'), // 08:00 ICT
  endTime: Date.parse('2026-09-07T02:30:00Z'), // 09:30 ICT
  classId: 'cls123',
  className: 'Lớp Toán B',
  teacherId: 'tch123',
  teacherName: 'Nguyễn Lan',
  ...over,
})

describe('formatConflictDate', () => {
  it('reformats ISO dates to dd/MM/yyyy', () => {
    expect(formatConflictDate('2026-09-07')).toBe('07/09/2026')
  })

  it('passes through unknown shapes', () => {
    expect(formatConflictDate('')).toBe('')
    expect(formatConflictDate('bad')).toBe('bad')
  })
})

describe('TeacherConflictBanner', () => {
  it('renders nothing without conflicts', () => {
    const { container } = render(
      <TeacherConflictBanner conflicts={[]} onForce={vi.fn()} onDismiss={vi.fn()} actionLabel="Vẫn tạo" isPending={false} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('lists the conflicting sessions with date, time and class', () => {
    render(
      <TeacherConflictBanner
        conflicts={[conflict(), conflict({ date: '2026-09-14', className: 'Lớp Văn A' })]}
        onForce={vi.fn()}
        onDismiss={vi.fn()}
        actionLabel="Vẫn tạo buổi học"
        isPending={false}
      />,
    )
    const banner = screen.getByTestId('teacher-conflict-banner')
    expect(banner).toHaveTextContent('Nguyễn Lan')
    expect(banner).toHaveTextContent('07/09/2026')
    // Times are formatted in Vietnam time (UTC+7).
    expect(banner).toHaveTextContent('08:00–09:30')
    expect(banner).toHaveTextContent('Lớp Toán B')
    expect(banner).toHaveTextContent('14/09/2026')
    expect(banner).toHaveTextContent('Lớp Văn A')
  })

  it('shows a +N overflow row beyond 10 conflicts', () => {
    const many = Array.from({ length: 12 }, (_, i) => conflict({ date: `2026-10-${String(i + 1).padStart(2, '0')}` }))
    render(
      <TeacherConflictBanner conflicts={many} onForce={vi.fn()} onDismiss={vi.fn()} actionLabel="OK" isPending={false} />,
    )
    expect(screen.getByTestId('teacher-conflict-banner')).toHaveTextContent('+2')
  })

  it('fires force and dismiss actions', () => {
    const onForce = vi.fn()
    const onDismiss = vi.fn()
    render(
      <TeacherConflictBanner conflicts={[conflict()]} onForce={onForce} onDismiss={onDismiss} actionLabel="Vẫn tạo" isPending={false} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /vẫn tạo/i }))
    expect(onForce).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /chỉnh sửa thời gian/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('disables the force button while pending', () => {
    render(
      <TeacherConflictBanner conflicts={[conflict()]} onForce={vi.fn()} onDismiss={vi.fn()} actionLabel="Vẫn tạo" isPending={true} />,
    )
    expect(screen.getByRole('button', { name: /vẫn tạo/i })).toBeDisabled()
  })

  it('falls back to a generic title when the teacher name is missing', () => {
    render(
      <TeacherConflictBanner
        conflicts={[conflict({ teacherName: '', teacherId: '' })]}
        onForce={vi.fn()}
        onDismiss={vi.fn()}
        actionLabel="OK"
        isPending={false}
      />,
    )
    expect(screen.getByTestId('teacher-conflict-banner')).toHaveTextContent('Giáo viên đã có lịch trùng')
  })
})
