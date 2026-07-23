package store

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
)

// ============================================================================
// Dashboard
// ============================================================================

type DashboardStore interface {
	CountStudents() (int64, error)
	GetChildrenByParentID(parentID string) ([]*model.User, error)
}

// ============================================================================
// Branch
// ============================================================================

type BranchStore interface {
	Get(id string) (*lms_models.Branch, error)
	GetAll(opts modelhelper.BranchFilterOpts) ([]*lms_models.Branch, error)
	Count(opts modelhelper.BranchFilterOpts) (int64, error)
	Save(branch *lms_models.Branch) (*lms_models.Branch, error)
	Delete(id string) error
}

// ============================================================================
// Course
// ============================================================================

type CourseStore interface {
	Get(id string) (*lms_models.Course, error)
	GetAll() ([]*lms_models.Course, error)
	GetLessons(courseID string) ([]*lms_models.CourseLesson, error)
	Save(course *lms_models.Course) (*lms_models.Course, error)
	Update(course *lms_models.Course) (*lms_models.Course, error)
	Delete(id string) error
}

// ============================================================================
// CourseLesson
// ============================================================================

type CourseLessonStore interface {
	Get(id string) (*lms_models.CourseLesson, error)
	GetByCourse(courseID string) ([]*lms_models.CourseLesson, error)
	Save(lesson *lms_models.CourseLesson) (*lms_models.CourseLesson, error)
	Update(lesson *lms_models.CourseLesson) (*lms_models.CourseLesson, error)
	Delete(id string) error
}

// ============================================================================
// Class
// ============================================================================

type ClassStore interface {
	Get(id string) (*lms_models.Class, error)
	GetAll(opts modelhelper.ClassFilterOpts) ([]*lms_models.Class, error)
	Save(class *lms_models.Class) (*lms_models.Class, error)
	Update(class *lms_models.Class) (*lms_models.Class, error)
	Delete(id string) error
	Count(opts modelhelper.ClassFilterOpts) (int64, error)
}

// ============================================================================
// StudentClass
// ============================================================================

type StudentClassStore interface {
	Get(id string) (*lms_models.StudentClass, error)
	GetByClass(classID string) ([]*lms_models.StudentClass, error)
	GetByStudent(studentID string) ([]*lms_models.StudentClass, error)
	GetExisting(studentID, classID string) (*lms_models.StudentClass, error)
	CountByStudent(studentID, status string) (int64, error)
	Save(sc *lms_models.StudentClass) (*lms_models.StudentClass, error)
	Delete(id string) error
	DeleteByClass(classID string) error
	DeleteByStudent(studentID string) error
}

// ============================================================================
// LMSSession
// ============================================================================

type LMSSessionStore interface {
	Get(id string) (*lms_models.LMSSession, error)
	GetAll(opts modelhelper.SessionFilterOpts) ([]*lms_models.LMSSession, error)
	Count(opts modelhelper.SessionFilterOpts) (int64, error)
	CountUpcomingByStudent(studentID string) (int64, error)
	Save(session *lms_models.LMSSession) (*lms_models.LMSSession, error)
	Update(session *lms_models.LMSSession) (*lms_models.LMSSession, error)
	Delete(id string) error
}

// ============================================================================
// Attendance
// ============================================================================

type AttendanceStore interface {
	Get(id string) (*lms_models.Attendance, error)
	GetBySession(sessionID string) ([]*lms_models.Attendance, error)
	GetBySessionAndStudent(sessionID, studentID string) (*lms_models.Attendance, error)
	Save(attendance *lms_models.Attendance) (*lms_models.Attendance, error)
	DeleteBySession(sessionID string) error
	Delete(id string) error
}

// ============================================================================
// Lead
// ============================================================================

type LeadStore interface {
	Get(id string) (*lms_models.Lead, error)
	GetAll(opts modelhelper.LeadFilterOpts) ([]*lms_models.Lead, error)
	Count(opts modelhelper.LeadFilterOpts) (int64, error)
	CountNewThisMonth() (int64, error)
	Save(lead *lms_models.Lead) (*lms_models.Lead, error)
	Update(lead *lms_models.Lead) (*lms_models.Lead, error)
	Delete(id string) error
}

// ============================================================================
// LeadActivity
// ============================================================================

type LeadActivityStore interface {
	Get(id string) (*lms_models.LeadActivity, error)
	GetByLead(leadID string) ([]*lms_models.LeadActivity, error)
	Save(activity *lms_models.LeadActivity) (*lms_models.LeadActivity, error)
}

// ============================================================================
// FeePackage
// ============================================================================

type FeePackageStore interface {
	Get(id string) (*lms_models.FeePackage, error)
	GetAll(opts modelhelper.FeePackageFilterOpts) ([]*lms_models.FeePackage, error)
	Count(opts modelhelper.FeePackageFilterOpts) (int64, error)
	Save(fp *lms_models.FeePackage) (*lms_models.FeePackage, error)
	Delete(id string) error
}

// ============================================================================
// Tuition
// ============================================================================

type TuitionStore interface {
	Get(id string) (*lms_models.Tuition, error)
	GetAll(opts modelhelper.TuitionFilterOpts) ([]*lms_models.Tuition, error)
	Count(opts modelhelper.TuitionFilterOpts) (int64, error)
	Save(tuition *lms_models.Tuition) (*lms_models.Tuition, error)
	Update(tuition *lms_models.Tuition) (*lms_models.Tuition, error)
	Delete(id string) error
}

// ============================================================================
// Payment
// ============================================================================

type PaymentStore interface {
	Get(id string) (*lms_models.Payment, error)
	GetAll(opts modelhelper.PaymentFilterOpts) ([]*lms_models.Payment, error)
	Count(opts modelhelper.PaymentFilterOpts) (int64, error)
	GetByTuition(tuitionID string) ([]*lms_models.Payment, error)
	Save(payment *lms_models.Payment) (*lms_models.Payment, error)
}

// ============================================================================
// FeeRefund
// ============================================================================

type FeeRefundStore interface {
	Get(id string) (*lms_models.FeeRefund, error)
	GetByTuition(tuitionID string) ([]*lms_models.FeeRefund, error)
	Save(refund *lms_models.FeeRefund) (*lms_models.FeeRefund, error)
	Delete(id string) error
}

// ============================================================================
// AdditionalFee
// ============================================================================

type AdditionalFeeStore interface {
	Get(id string) (*lms_models.AdditionalFee, error)
	GetByTuition(tuitionID string) ([]*lms_models.AdditionalFee, error)
	Save(af *lms_models.AdditionalFee) (*lms_models.AdditionalFee, error)
	Delete(id string) error
	DeleteByTuition(tuitionID string) error
}

// ============================================================================
// PostCategory
// ============================================================================

type PostCategoryStore interface {
	Get(id string) (*lms_models.PostCategory, error)
	GetAll() ([]*lms_models.PostCategory, error)
	Save(pc *lms_models.PostCategory) (*lms_models.PostCategory, error)
	Delete(id string) error
}

// ============================================================================
// BlogPost
// ============================================================================

type BlogPostStore interface {
	Get(id string) (*lms_models.BlogPost, error)
	GetAll(opts modelhelper.BlogPostFilterOpts) ([]*lms_models.BlogPost, error)
	Count(opts modelhelper.BlogPostFilterOpts) (int64, error)
	GetPublished() ([]*lms_models.BlogPost, error)
	Save(post *lms_models.BlogPost) (*lms_models.BlogPost, error)
	Update(post *lms_models.BlogPost) (*lms_models.BlogPost, error)
	Delete(id string) error
}

// ============================================================================
// WeeklyReview
// ============================================================================

type WeeklyReviewStore interface {
	Get(id string) (*lms_models.WeeklyReview, error)
	GetAll(opts modelhelper.WeeklyReviewFilterOpts) ([]*lms_models.WeeklyReview, error)
	Count(opts modelhelper.WeeklyReviewFilterOpts) (int64, error)
	Save(wr *lms_models.WeeklyReview) (*lms_models.WeeklyReview, error)
	Update(wr *lms_models.WeeklyReview) (*lms_models.WeeklyReview, error)
	Delete(id string) error
}

// ============================================================================
// Homework
// ============================================================================

type HomeworkStore interface {
	Get(id string) (*lms_models.Homework, error)
	GetAll(opts modelhelper.HomeworkFilterOpts) ([]*lms_models.Homework, error)
	Count(opts modelhelper.HomeworkFilterOpts) (int64, error)
	Save(hw *lms_models.Homework) (*lms_models.Homework, error)
	Update(hw *lms_models.Homework) (*lms_models.Homework, error)
	Delete(id string) error
}

// ============================================================================
// Submission
// ============================================================================

type SubmissionStore interface {
	Get(id string) (*lms_models.Submission, error)
	GetByHomework(homeworkID string) ([]*lms_models.Submission, error)
	GetByHomeworkAndStudent(homeworkID, studentID string) (*lms_models.Submission, error)
	Save(sub *lms_models.Submission) (*lms_models.Submission, error)
	Update(sub *lms_models.Submission) (*lms_models.Submission, error)
	Delete(id string) error
}

// ============================================================================
// ClassMedia
// ============================================================================

type ClassMediaStore interface {
	Get(id string) (*lms_models.ClassMedium, error)
	GetAll(opts modelhelper.ClassMediaFilterOpts) ([]*lms_models.ClassMedium, error)
	Count(opts modelhelper.ClassMediaFilterOpts) (int64, error)
	Save(cm *lms_models.ClassMedium) (*lms_models.ClassMedium, error)
	Delete(id string) error
}

// ============================================================================
// Task
// ============================================================================

type TaskStore interface {
	Get(id string) (*lms_models.Task, error)
	GetAll(opts modelhelper.TaskFilterOpts) ([]*lms_models.Task, error)
	Count(opts modelhelper.TaskFilterOpts) (int64, error)
	Save(task *lms_models.Task) (*lms_models.Task, error)
	Update(task *lms_models.Task) (*lms_models.Task, error)
	Delete(id string) error
}

// ============================================================================
// Banner
// ============================================================================

type BannerStore interface {
	Get(id string) (*lms_models.Banner, error)
	GetAll() ([]*lms_models.Banner, error)
	Save(banner *lms_models.Banner) (*lms_models.Banner, error)
	Update(banner *lms_models.Banner) (*lms_models.Banner, error)
	Delete(id string) error
}

// ============================================================================
// Notification
// ============================================================================

type NotificationStore interface {
	Get(id string) (*lms_models.Notification, error)
	GetByUser(userID string) ([]*lms_models.Notification, error)
	Save(n *lms_models.Notification) (*lms_models.Notification, error)
	MarkAsRead(id string) error
}

// ============================================================================
// Material
// ============================================================================

type MaterialStore interface {
	Get(id string) (*lms_models.Material, error)
	GetAll(opts modelhelper.MaterialFilterOpts) ([]*lms_models.Material, error)
	Count(opts modelhelper.MaterialFilterOpts) (int64, error)
	Save(m *lms_models.Material) (*lms_models.Material, error)
	Update(m *lms_models.Material) (*lms_models.Material, error)
	Delete(id string) error
}
