// ─── Enums ──────────────────────────────────────────────────────────
export * from './enums'

// ─── Entity & Response Types ──────────────────────────────────────
export * from './types'

// ─── Auth ───────────────────────────────────────────────────────────
export { loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from './auth.schema'
export type { LoginInput, ChangePasswordInput } from './auth.schema'

// ─── User ────────────────────────────────────────────────────────────
export { createUserSchema, updateUserSchema } from './user.schema'
export type { CreateUserInput, UpdateUserInput } from './user.schema'

// ─── Student ─────────────────────────────────────────────────────────
export { createStudentSchema, updateStudentSchema } from './student.schema'
export type { CreateStudentInput, UpdateStudentInput } from './student.schema'

// ─── Course ──────────────────────────────────────────────────────────
export { createCourseSchema, updateCourseSchema } from './course.schema'
export type { CreateCourseInput, UpdateCourseInput } from './course.schema'

// ─── Class ───────────────────────────────────────────────────────────
export { createClassSchema, updateClassSchema, enrollSchema } from './class.schema'
export type { CreateClassInput, UpdateClassInput, EnrollInput } from './class.schema'

// ─── Session ─────────────────────────────────────────────────────────
export { createSessionSchema, updateSessionSchema, attendanceSchema } from './session.schema'
export type { CreateSessionInput, UpdateSessionInput, AttendanceInput } from './session.schema'

// ─── Lead ────────────────────────────────────────────────────────────
export { createLeadSchema, updateLeadSchema, leadActivitySchema } from './lead.schema'
export type { CreateLeadInput, UpdateLeadInput, LeadActivityInput } from './lead.schema'

// ─── Tuition ────────────────────────────────────────────────────────
export { createTuitionSchema, updateTuitionSchema, paymentSchema } from './tuition.schema'
export type { CreateTuitionInput, UpdateTuitionInput, PaymentInput } from './tuition.schema'

// ─── Material ────────────────────────────────────────────────────────
export { createMaterialSchema, updateMaterialSchema } from './material.schema'
export type { CreateMaterialInput, UpdateMaterialInput } from './material.schema'

// ─── Task ────────────────────────────────────────────────────────────
export { createTaskSchema, updateTaskSchema } from './task.schema'
export type { CreateTaskInput, UpdateTaskInput } from './task.schema'

// ─── Post ───────────────────────────────────────────────────────────
export { postCategorySchema, createPostSchema, updatePostSchema } from './post.schema'
export type { PostCategoryInput, CreatePostInput, UpdatePostInput } from './post.schema'

// ─── Branch ──────────────────────────────────────────────────────────
export { createBranchSchema } from './branch.schema'
export type { CreateBranchInput } from './branch.schema'

// ─── Banner ──────────────────────────────────────────────────────────
export { createBannerSchema, updateBannerSchema } from './banner.schema'
export type { CreateBannerInput, UpdateBannerInput } from './banner.schema'

// ─── Fee Package ────────────────────────────────────────────────────
export { createFeePackageSchema } from './fee-package.schema'
export type { CreateFeePackageInput } from './fee-package.schema'

// ─── Homework ───────────────────────────────────────────────────────
export { createHomeworkSchema, updateHomeworkSchema, bulkAssignSchema, homeworkSubmissionSchema, gradeHomeworkSchema } from './homework.schema'
export type { CreateHomeworkInput, UpdateHomeworkInput, BulkAssignInput, HomeworkSubmissionInput, GradeHomeworkInput } from './homework.schema'

// ─── Weekly Review ─────────────────────────────────────────────────
export { createWeeklyReviewSchema, updateWeeklyReviewSchema } from './weekly-review.schema'
export type { CreateWeeklyReviewInput, UpdateWeeklyReviewInput } from './weekly-review.schema'

// ─── Class Media ───────────────────────────────────────────────────
export { createClassMediaSchema } from './class-media.schema'
export type { CreateClassMediaInput } from './class-media.schema'

// ─── Public ──────────────────────────────────────────────────────────
export { registerSchema, contactSchema } from './public.schema'
export type { RegisterInput, ContactInput } from './public.schema'
