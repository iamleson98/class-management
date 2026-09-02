package store

import (
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
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
	Search(opts modelhelper.BranchFilterOpts) ([]*lms_models.Branch, int64, error)
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
	Search(opts modelhelper.ClassFilterOpts) ([]*lms_models.Class, int64, error)
	Save(class *lms_models.Class) (*lms_models.Class, error)
	Update(class *lms_models.Class) (*lms_models.Class, error)
	Delete(id string) error
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
	SearchStudentUsers(opts modelhelper.StudentFilterOpts) (lms_models.UserSlice, int64, error)
}

// ============================================================================
// LMSSession
// ============================================================================

type LMSSessionStore interface {
	Get(id string) (*lms_models.LMSSession, error)
	Search(opts modelhelper.SessionFilterOpts) ([]*lms_models.LMSSession, int64, error)
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
	Search(opts modelhelper.LeadFilterOpts) ([]*lms_models.Lead, int64, error)
	CountNewThisMonth(counselorId string) (int64, error)
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
	Search(opts modelhelper.FeePackageFilterOpts) ([]*lms_models.FeePackage, int64, error)
	Save(fp *lms_models.FeePackage) (*lms_models.FeePackage, error)
	Delete(id string) error
}

// ============================================================================
// Tuition
// ============================================================================

type TuitionStore interface {
	Get(id string) (*lms_models.Tuition, error)
	Search(opts modelhelper.TuitionFilterOpts) ([]*lms_models.Tuition, int64, error)
	Save(tuition *lms_models.Tuition) (*lms_models.Tuition, error)
	Update(tuition *lms_models.Tuition) (*lms_models.Tuition, error)
	Delete(id string) error
}

// ============================================================================
// Payment
// ============================================================================

type PaymentStore interface {
	Get(id string) (*lms_models.Payment, error)
	Search(opts modelhelper.PaymentFilterOpts) ([]*lms_models.Payment, int64, error)
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
	Update(pc *lms_models.PostCategory) (*lms_models.PostCategory, error)
	Delete(id string) error
}

// ============================================================================
// BlogPost
// ============================================================================

type BlogPostStore interface {
	Get(id string) (*lms_models.BlogPost, error)
	Search(opts modelhelper.BlogPostFilterOpts) ([]*lms_models.BlogPost, int64, error)
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
	Search(opts modelhelper.WeeklyReviewFilterOpts) ([]*lms_models.WeeklyReview, int64, error)
	Save(wr *lms_models.WeeklyReview) (*lms_models.WeeklyReview, error)
	Update(wr *lms_models.WeeklyReview) (*lms_models.WeeklyReview, error)
	Delete(id string) error
}

// ============================================================================
// Homework
// ============================================================================

type HomeworkStore interface {
	Get(id string) (*lms_models.Homework, error)
	Search(opts modelhelper.HomeworkFilterOpts) ([]*lms_models.Homework, int64, error)
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
	GetByFileID(fileID string) (*lms_models.ClassMedium, error)
	Search(opts modelhelper.ClassMediaFilterOpts) ([]*lms_models.ClassMedium, int64, error)
	Save(cm *lms_models.ClassMedium) (*lms_models.ClassMedium, error)
	Delete(id string) error
}

// ============================================================================
// Task
// ============================================================================

type TaskStore interface {
	Get(id string) (*lms_models.Task, error)
	Search(opts modelhelper.TaskFilterOpts) ([]*lms_models.Task, int64, error)
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
	Search(opts modelhelper.MaterialFilterOpts) ([]*lms_models.Material, int64, error)
	Save(m *lms_models.Material) (*lms_models.Material, error)
	Update(m *lms_models.Material) (*lms_models.Material, error)
	Delete(id string) error
}

// ============================================================================
// Calls
//
// The calls sub-stores persist only the durable boundaries of a realtime call:
// call start/end (CallStore), participant join/leave (CallSessionStore),
// recording/transcription jobs (CallJobStore), historical aggregates
// (CallStatStore), and per-channel configuration (CallsChannelStore).
//
// Live / transient state (mute, voice, screen, video, raised hand) is held
// in-memory in the calls service and fanned out over websockets — it is NOT
// written here, which keeps the DB write rate proportional to
// (calls x participants) rather than (calls x participants x interactions).
// ============================================================================

// CallFilterOpts filters calls for history / reporting queries.
type CallFilterOpts struct {
	ChannelID string
	OwnerID   string
	Active    *bool // true => only ongoing calls (endat = 0)
	Page      int
	PerPage   int
}

// CallStore persists call lifecycle records (start / end).
type CallStore interface {
	Get(callID string) (*model.Call, error)
	GetActiveByChannel(channelID string) (*model.Call, error)
	Search(opts CallFilterOpts) ([]*model.Call, error)
	Save(call *model.Call) (*model.Call, error)
	Update(call *model.Call) (*model.Call, error)
	Delete(callID string) error
}

// CallSessionStore persists per-participant join/leave records.
type CallSessionStore interface {
	Get(sessionID string) (*model.CallSession, error)
	GetByCall(callID string) ([]*model.CallSession, error)
	GetByCallAndUser(callID, userID string) (*model.CallSession, error)
	Save(session *model.CallSession) (*model.CallSession, error)
	Update(session *model.CallSession) (*model.CallSession, error)
	Delete(sessionID string) error
}

// CallJobStore persists recording / transcription / captions jobs.
type CallJobStore interface {
	Get(jobID string) (*model.CallJob, error)
	GetByCall(callID string) ([]*model.CallJob, error)
	Save(job *model.CallJob) (*model.CallJob, error)
	Update(job *model.CallJob) (*model.CallJob, error)
	Delete(jobID string) error
}

// CallStatStore persists one aggregate row per completed call.
type CallStatStore interface {
	Get(statID string) (*model.CallStat, error)
	GetByCall(callID string) (*model.CallStat, error)
	GetByChannel(channelID string, page, perPage int) ([]*model.CallStat, error)
	Save(stat *model.CallStat) (*model.CallStat, error)
}

// CallsChannelStore persists per-channel call configuration / defaults.
type CallsChannelStore interface {
	Get(channelID string) (*model.CallsChannel, error)
	Save(cc *model.CallsChannel) (*model.CallsChannel, error)
	Delete(channelID string) error
}
