import { z } from 'zod/v4'
import { requiredString, emailField, phoneField, optionalEmailField, optionalString, optionalDateField, notesField } from './common'
import { StudentStatus, Gender } from './enums'

// Backend contract: POST /lms/students/create and PUT /lms/students/{id} decode
// into a wrapper `{ user: <model.User>, props: <map[string]any> }` (see
// server/channels/api4/lms_api/student.go + app/lms/student.go).
//
//   - `user` carries model.User fields (firstname/lastname/email/phone/
//     parent_id/branch_id). The server overwrites `roles` to lms_student and
//     `password` to a default hash, so those are not sent. The server
//     auto-derives `username` from the email local-part when absent (the
//     admin form never collects one), de-duplicating with numeric suffixes
//     when the derived name is taken.
//   - `props` is an arbitrary map stored as a JSON string under
//     `user.props["student"]`. Canonical keys (model_helper/lms.go):
//       gender         → "male" | "female"
//       student_status → ACTIVE | RESERVED | DROPPED | PENDING
//     Plus free-form keys: code, dob, school, school_grade, parent_name,
//     vmg_class_code, notes.
//
// To keep the form UX flat and simple, this schema models a single user-friendly
// object. The api.ts layer (buildStudentPayload) splits it into { user, props }
// with the correct key names before posting.

export const createStudentSchema = z.object({
  // ── model.User fields ──
  firstname: requiredString,
  lastname: optionalString,
  email: emailField,
  phone: phoneField,
  parentId: optionalString,
  branchId: optionalString,
  // ── student props (→ user.props["student"]) ──
  code: requiredString,
  gender: Gender,
  status: StudentStatus.default('ACTIVE'),
  dob: optionalDateField,
  school: optionalString,
  schoolGrade: optionalString,
  parentName: optionalString,
  vmgClassCode: optionalString,
  notes: notesField,
})

export const updateStudentSchema = z.object({
  // ── model.User fields ──
  firstname: requiredString,
  lastname: optionalString,
  email: optionalEmailField,
  phone: phoneField,
  parentId: optionalString,
  branchId: optionalString,
  // ── student props ──
  code: requiredString,
  gender: Gender.or(z.literal('')),
  status: StudentStatus,
  dob: optionalDateField,
  school: optionalString,
  schoolGrade: optionalString,
  parentName: optionalString,
  vmgClassCode: optionalString,
  notes: notesField,
})

export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
