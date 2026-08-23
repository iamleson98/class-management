/**
 * Parent ↔ children resolution.
 *
 * There is no dedicated "my children" endpoint — children are students
 * (users with the lms_student role) whose `parent_id` points at the parent
 * user. This hook centralizes that lookup so the parent views (dashboard,
 * homework, media, reviews, schedule) share one cached query.
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { getStudents } from '@/lib/api'

export interface ParentChild {
  id: string
  userId: string
  name: string
  code?: string
  status?: string
}

export function useParentChildren(parentUserId: string | undefined) {
  return useQuery({
    queryKey: ['parent-children', parentUserId],
    queryFn: async () => {
      const students = await getStudents()
      return (students as Array<Record<string, any>>)
        .filter((s) => s.parentId === parentUserId)
        .map((s) => ({
          id: s.userId ?? s.id,
          userId: s.userId ?? s.id,
          name: s.name || s.username || [s.firstname, s.lastname].filter(Boolean).join(' '),
          code: s.code,
          status: s.status,
        })) as ParentChild[]
    },
    enabled: !!parentUserId,
  })
}
