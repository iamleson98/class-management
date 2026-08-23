/**
 * LMS store tests — role parsing and view routing invariants.
 */

import { describe, it, expect } from 'vitest'
import { parseAllLMSRoles } from '@/store/lms-store'

describe('parseAllLMSRoles', () => {
	it('extracts LMS roles in priority order', () => {
		expect(parseAllLMSRoles('system_user lms_teacher lms_admin')).toEqual(['lms_admin', 'lms_teacher'])
	})

	it('ignores non-LMS roles', () => {
		expect(parseAllLMSRoles('system_user system_admin')).toEqual([])
	})

	it('handles empty and whitespace-only strings', () => {
		expect(parseAllLMSRoles('')).toEqual([])
		expect(parseAllLMSRoles('   ')).toEqual([])
	})

	it('single role passes through', () => {
		expect(parseAllLMSRoles('lms_student')).toEqual(['lms_student'])
	})
})
