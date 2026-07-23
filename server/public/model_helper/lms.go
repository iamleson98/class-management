package modelhelper

import (
	"net/http"
	"time"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
)

// ============================================================================
// Filter Option Structs
// ============================================================================

type BranchFilterOpts struct {
	Page      int
	PerPage   int
	CountTotal bool
}

type ClassFilterOpts struct {
	CourseID   string
	Status     string
	TeacherID  string
	Page       int
	PerPage    int
	CountTotal bool
}

type SessionFilterOpts struct {
	ClassID    string
	TeacherID  string
	StudentID  string
	Month      string
	Date       string
	Page       int
	PerPage    int
	CountTotal bool
}

type LeadFilterOpts struct {
	Status      string
	Source      string
	CounselorID string
	Search      string
	Page        int
	PerPage     int
	CountTotal  bool
}

type FeePackageFilterOpts struct {
	CourseID   string
	Page       int
	PerPage    int
	CountTotal bool
}

type TuitionFilterOpts struct {
	StudentID  string
	ClassID    string
	Status     string
	Search     string
	Page       int
	PerPage    int
	CountTotal bool
}

type PaymentFilterOpts struct {
	FromDate   string
	ToDate     string
	Page       int
	PerPage    int
	CountTotal bool
}

type BlogPostFilterOpts struct {
	Status     string
	CategoryID string
	Page       int
	PerPage    int
	CountTotal bool
}

type WeeklyReviewFilterOpts struct {
	StudentID  string
	ClassID    string
	Page       int
	PerPage    int
	CountTotal bool
}

type HomeworkFilterOpts struct {
	ClassID    string
	StudentID  string
	TeacherID  string
	CourseID   string
	Page       int
	PerPage    int
	CountTotal bool
}

type ClassMediaFilterOpts struct {
	ClassID    string
	SessionID  string
	Page       int
	PerPage    int
	CountTotal bool
}

type TaskFilterOpts struct {
	AssigneeID string
	Status     string
	Priority   string
	Page       int
	PerPage    int
	CountTotal bool
}

type MaterialFilterOpts struct {
	CourseID   string
	Visibility string
	Page       int
	PerPage    int
	CountTotal bool
}

// ============================================================================
// Branch — name VARCHAR(100), address VARCHAR(200), phone VARCHAR(13)
// ============================================================================

func BranchIsValid(b *lms_models.Branch) *model.AppError {
	if b.ID != "" && !model.IsValidId(b.ID) {
		return model.NewAppError("BranchIsValid", "model.lms.branch.id.app_error", nil, "", http.StatusBadRequest)
	}
	if b.Name == "" {
		return model.NewAppError("BranchIsValid", "model.lms.branch.name.app_error", nil, "", http.StatusBadRequest)
	}
	if len(b.Name) > 100 {
		return model.NewAppError("BranchIsValid", "model.lms.branch.name.len.app_error", nil, "", http.StatusBadRequest)
	}
	if b.Address.Valid && len(b.Address.String) > 200 {
		return model.NewAppError("BranchIsValid", "model.lms.branch.address.len.app_error", nil, "", http.StatusBadRequest)
	}
	if b.Phone.Valid && len(b.Phone.String) > 13 {
		return model.NewAppError("BranchIsValid", "model.lms.branch.phone.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func BranchPreCreate(b *lms_models.Branch) {
	if b.ID == "" {
		b.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	b.Createat = now
	b.Updateat = now
}

func BranchPreUpdate(b *lms_models.Branch) {
	b.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// Course — name VARCHAR(100), code VARCHAR(100), level VARCHAR(100),
//          age_range VARCHAR(100), description VARCHAR(500), curriculum VARCHAR(1000)
// ============================================================================

func CourseIsValid(c *lms_models.Course) *model.AppError {
	if c.ID != "" && !model.IsValidId(c.ID) {
		return model.NewAppError("CourseIsValid", "model.lms.course.id.app_error", nil, "", http.StatusBadRequest)
	}
	if c.Code == "" {
		return model.NewAppError("CourseIsValid", "model.lms.course.code.app_error", nil, "", http.StatusBadRequest)
	}
	if len(c.Code) > 100 {
		return model.NewAppError("CourseIsValid", "model.lms.course.code.len.app_error", nil, "", http.StatusBadRequest)
	}
	if c.Name == "" {
		return model.NewAppError("CourseIsValid", "model.lms.course.name.app_error", nil, "", http.StatusBadRequest)
	}
	if len(c.Name) > 100 {
		return model.NewAppError("CourseIsValid", "model.lms.course.name.len.app_error", nil, "", http.StatusBadRequest)
	}
	if c.Level.Valid && len(c.Level.String) > 100 {
		return model.NewAppError("CourseIsValid", "model.lms.course.level.len.app_error", nil, "", http.StatusBadRequest)
	}
	if c.AgeRange.Valid && len(c.AgeRange.String) > 100 {
		return model.NewAppError("CourseIsValid", "model.lms.course.age_range.len.app_error", nil, "", http.StatusBadRequest)
	}
	if c.Description.Valid && len(c.Description.String) > 500 {
		return model.NewAppError("CourseIsValid", "model.lms.course.description.len.app_error", nil, "", http.StatusBadRequest)
	}
	if c.Curriculum.Valid && len(c.Curriculum.String) > 1000 {
		return model.NewAppError("CourseIsValid", "model.lms.course.curriculum.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func CoursePreCreate(c *lms_models.Course) {
	if c.ID == "" {
		c.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	c.Createat = now
	c.Updateat = now
}

func CoursePreUpdate(c *lms_models.Course) {
	c.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// CourseLesson — title VARCHAR(200), unit VARCHAR(100), pages VARCHAR(100),
//               objectives VARCHAR(500)
// ============================================================================

func CourseLessonIsValid(cl *lms_models.CourseLesson) *model.AppError {
	if cl.ID != "" && !model.IsValidId(cl.ID) {
		return model.NewAppError("CourseLessonIsValid", "model.lms.course_lesson.id.app_error", nil, "", http.StatusBadRequest)
	}
	if cl.CourseID == "" {
		return model.NewAppError("CourseLessonIsValid", "model.lms.course_lesson.course_id.app_error", nil, "", http.StatusBadRequest)
	}
	if cl.Title.Valid && len(cl.Title.String) > 200 {
		return model.NewAppError("CourseLessonIsValid", "model.lms.course_lesson.title.len.app_error", nil, "", http.StatusBadRequest)
	}
	if cl.Unit.Valid && len(cl.Unit.String) > 100 {
		return model.NewAppError("CourseLessonIsValid", "model.lms.course_lesson.unit.len.app_error", nil, "", http.StatusBadRequest)
	}
	if cl.Pages.Valid && len(cl.Pages.String) > 100 {
		return model.NewAppError("CourseLessonIsValid", "model.lms.course_lesson.pages.len.app_error", nil, "", http.StatusBadRequest)
	}
	if cl.Objectives.Valid && len(cl.Objectives.String) > 500 {
		return model.NewAppError("CourseLessonIsValid", "model.lms.course_lesson.objectives.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func CourseLessonPreCreate(cl *lms_models.CourseLesson) {
	if cl.ID == "" {
		cl.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	cl.Createat = now
	cl.Updateat = now
}

func CourseLessonPreUpdate(cl *lms_models.CourseLesson) {
	cl.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// Class — name VARCHAR(100), code VARCHAR(100), status VARCHAR(50),
//         room VARCHAR(100)
// ============================================================================

func ClassIsValid(c *lms_models.Class) *model.AppError {
	if c.ID != "" && !model.IsValidId(c.ID) {
		return model.NewAppError("ClassIsValid", "model.lms.class.id.app_error", nil, "", http.StatusBadRequest)
	}
	if c.Code == "" {
		return model.NewAppError("ClassIsValid", "model.lms.class.code.app_error", nil, "", http.StatusBadRequest)
	}
	if len(c.Code) > 100 {
		return model.NewAppError("ClassIsValid", "model.lms.class.code.len.app_error", nil, "", http.StatusBadRequest)
	}
	if c.Name == "" {
		return model.NewAppError("ClassIsValid", "model.lms.class.name.app_error", nil, "", http.StatusBadRequest)
	}
	if len(c.Name) > 100 {
		return model.NewAppError("ClassIsValid", "model.lms.class.name.len.app_error", nil, "", http.StatusBadRequest)
	}
	if c.CourseID == "" {
		return model.NewAppError("ClassIsValid", "model.lms.class.course_id.app_error", nil, "", http.StatusBadRequest)
	}
	if c.TeacherID == "" {
		return model.NewAppError("ClassIsValid", "model.lms.class.teacher_id.app_error", nil, "", http.StatusBadRequest)
	}
	if len(c.Status) > 50 {
		return model.NewAppError("ClassIsValid", "model.lms.class.status.len.app_error", nil, "", http.StatusBadRequest)
	}
	if c.Room.Valid && len(c.Room.String) > 100 {
			return model.NewAppError("ClassIsValid", "model.lms.class.room.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func ClassPreCreate(c *lms_models.Class) {
	if c.ID == "" {
		c.ID = model.NewId()
	}
	if c.Status == "" {
		c.Status = "OPEN"
	}
	now := time.Now().UnixMilli()
	c.Createat = now
	c.Updateat = now
}

func ClassPreUpdate(c *lms_models.Class) {
	c.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// StudentClass — status VARCHAR(50)
// ============================================================================

func StudentClassIsValid(sc *lms_models.StudentClass) *model.AppError {
	if sc.ID != "" && !model.IsValidId(sc.ID) {
		return model.NewAppError("StudentClassIsValid", "model.lms.student_class.id.app_error", nil, "", http.StatusBadRequest)
	}
	if sc.StudentID == "" {
		return model.NewAppError("StudentClassIsValid", "model.lms.student_class.student_id.app_error", nil, "", http.StatusBadRequest)
	}
	if sc.ClassID == "" {
		return model.NewAppError("StudentClassIsValid", "model.lms.student_class.class_id.app_error", nil, "", http.StatusBadRequest)
	}
	if len(sc.Status) > 50 {
		return model.NewAppError("StudentClassIsValid", "model.lms.student_class.status.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func StudentClassPreCreate(sc *lms_models.StudentClass) {
	if sc.ID == "" {
		sc.ID = model.NewId()
	}
	if sc.Status == "" {
		sc.Status = "ACTIVE"
	}
	sc.EnrollmentAt = time.Now().UnixMilli()
	now := time.Now().UnixMilli()
	sc.Createat = now
	sc.Updateat = now
}

func StudentClassPreUpdate(sc *lms_models.StudentClass) {
	sc.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// LMSSession — title VARCHAR(200), room VARCHAR(100), status VARCHAR(50)
// ============================================================================

func LMSSessionIsValid(s *lms_models.LMSSession) *model.AppError {
	if s.ID != "" && !model.IsValidId(s.ID) {
		return model.NewAppError("LMSSessionIsValid", "model.lms.session.id.app_error", nil, "", http.StatusBadRequest)
	}
	if s.ClassID == "" {
		return model.NewAppError("LMSSessionIsValid", "model.lms.session.class_id.app_error", nil, "", http.StatusBadRequest)
	}
	if s.TeacherID == "" {
		return model.NewAppError("LMSSessionIsValid", "model.lms.session.teacher_id.app_error", nil, "", http.StatusBadRequest)
	}
	if s.Date.IsZero() {
		return model.NewAppError("LMSSessionIsValid", "model.lms.session.date.app_error", nil, "", http.StatusBadRequest)
	}
		if s.Title.Valid && len(s.Title.String) > 200 {
			return model.NewAppError("LMSSessionIsValid", "model.lms.session.title.len.app_error", nil, "", http.StatusBadRequest)
		}
		if s.Room.Valid && len(s.Room.String) > 100 {
			return model.NewAppError("LMSSessionIsValid", "model.lms.session.room.len.app_error", nil, "", http.StatusBadRequest)
	}
	if len(s.Status) > 50 {
		return model.NewAppError("LMSSessionIsValid", "model.lms.session.status.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func LMSSessionPreCreate(s *lms_models.LMSSession) {
	if s.ID == "" {
		s.ID = model.NewId()
	}
	if s.Status == "" {
		s.Status = "SCHEDULED"
	}
	now := time.Now().UnixMilli()
	s.Createat = now
	s.Updateat = now
}

func LMSSessionPreUpdate(s *lms_models.LMSSession) {
	s.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// Attendance — status VARCHAR(50), note VARCHAR(500)
// ============================================================================

func AttendanceIsValid(a *lms_models.Attendance) *model.AppError {
	if a.ID != "" && !model.IsValidId(a.ID) {
		return model.NewAppError("AttendanceIsValid", "model.lms.attendance.id.app_error", nil, "", http.StatusBadRequest)
	}
	if a.SessionID == "" {
		return model.NewAppError("AttendanceIsValid", "model.lms.attendance.session_id.app_error", nil, "", http.StatusBadRequest)
	}
	if a.StudentID == "" {
		return model.NewAppError("AttendanceIsValid", "model.lms.attendance.student_id.app_error", nil, "", http.StatusBadRequest)
	}
	if a.Status == "" {
		return model.NewAppError("AttendanceIsValid", "model.lms.attendance.status.app_error", nil, "", http.StatusBadRequest)
	}
	if len(a.Status) > 50 {
		return model.NewAppError("AttendanceIsValid", "model.lms.attendance.status.len.app_error", nil, "", http.StatusBadRequest)
	}
	if a.Note.Valid && len(a.Note.String) > 500 {
		return model.NewAppError("AttendanceIsValid", "model.lms.attendance.note.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func AttendancePreCreate(a *lms_models.Attendance) {
	if a.ID == "" {
		a.ID = model.NewId()
	}
	if a.Status == "" {
		a.Status = "PRESENT"
	}
	now := time.Now().UnixMilli()
	a.Createat = now
	a.Updateat = now
}

// ============================================================================
// Lead — name VARCHAR(100), email VARCHAR(100), phone VARCHAR(13),
//        school VARCHAR(100), source VARCHAR(100), need VARCHAR(500),
//        status VARCHAR(50), notes VARCHAR(500), test_result VARCHAR(50)
// ============================================================================

func LeadIsValid(l *lms_models.Lead) *model.AppError {
	if l.ID != "" && !model.IsValidId(l.ID) {
		return model.NewAppError("LeadIsValid", "model.lms.lead.id.app_error", nil, "", http.StatusBadRequest)
	}
	if l.Name == "" {
		return model.NewAppError("LeadIsValid", "model.lms.lead.name.app_error", nil, "", http.StatusBadRequest)
	}
	if len(l.Name) > 100 {
		return model.NewAppError("LeadIsValid", "model.lms.lead.name.len.app_error", nil, "", http.StatusBadRequest)
	}
	if l.Phone.Valid && len(l.Phone.String) > 13 {
		return model.NewAppError("LeadIsValid", "model.lms.lead.phone.len.app_error", nil, "", http.StatusBadRequest)
	}
	if l.Email.Valid && len(l.Email.String) > 100 {
		return model.NewAppError("LeadIsValid", "model.lms.lead.email.len.app_error", nil, "", http.StatusBadRequest)
	}
	if l.School.Valid && len(l.School.String) > 100 {
		return model.NewAppError("LeadIsValid", "model.lms.lead.school.len.app_error", nil, "", http.StatusBadRequest)
	}
	if l.Source.Valid && len(l.Source.String) > 100 {
		return model.NewAppError("LeadIsValid", "model.lms.lead.source.len.app_error", nil, "", http.StatusBadRequest)
	}
	if l.Need.Valid && len(l.Need.String) > 500 {
		return model.NewAppError("LeadIsValid", "model.lms.lead.need.len.app_error", nil, "", http.StatusBadRequest)
	}
	if len(l.Status) > 50 {
		return model.NewAppError("LeadIsValid", "model.lms.lead.status.len.app_error", nil, "", http.StatusBadRequest)
	}
	if l.Notes.Valid && len(l.Notes.String) > 500 {
		return model.NewAppError("LeadIsValid", "model.lms.lead.notes.len.app_error", nil, "", http.StatusBadRequest)
	}
	if l.TestResult.Valid && len(l.TestResult.String) > 50 {
		return model.NewAppError("LeadIsValid", "model.lms.lead.test_result.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func LeadPreCreate(l *lms_models.Lead) {
	if l.ID == "" {
		l.ID = model.NewId()
	}
	if l.Status == "" {
		l.Status = "NEW"
	}
	now := time.Now().UnixMilli()
	l.Createat = now
	l.Updateat = now
}

func LeadPreUpdate(l *lms_models.Lead) {
	l.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// LeadActivity — type VARCHAR(50), content VARCHAR(500)
// ============================================================================

func LeadActivityIsValid(la *lms_models.LeadActivity) *model.AppError {
	if la.ID != "" && !model.IsValidId(la.ID) {
		return model.NewAppError("LeadActivityIsValid", "model.lms.lead_activity.id.app_error", nil, "", http.StatusBadRequest)
	}
	if la.LeadID == "" {
		return model.NewAppError("LeadActivityIsValid", "model.lms.lead_activity.lead_id.app_error", nil, "", http.StatusBadRequest)
	}
	if la.Type == "" {
		return model.NewAppError("LeadActivityIsValid", "model.lms.lead_activity.type.app_error", nil, "", http.StatusBadRequest)
	}
	if len(la.Type) > 50 {
		return model.NewAppError("LeadActivityIsValid", "model.lms.lead_activity.type.len.app_error", nil, "", http.StatusBadRequest)
	}
	if la.Content.Valid && len(la.Content.String) > 500 {
		return model.NewAppError("LeadActivityIsValid", "model.lms.lead_activity.content.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func LeadActivityPreCreate(la *lms_models.LeadActivity) {
	if la.ID == "" {
		la.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	la.Createat = now
	la.Updateat = now
}

// ============================================================================
// FeePackage — name VARCHAR(100)
// ============================================================================

func FeePackageIsValid(fp *lms_models.FeePackage) *model.AppError {
	if fp.ID != "" && !model.IsValidId(fp.ID) {
		return model.NewAppError("FeePackageIsValid", "model.lms.fee_package.id.app_error", nil, "", http.StatusBadRequest)
	}
	if fp.Name == "" {
		return model.NewAppError("FeePackageIsValid", "model.lms.fee_package.name.app_error", nil, "", http.StatusBadRequest)
	}
	if len(fp.Name) > 100 {
		return model.NewAppError("FeePackageIsValid", "model.lms.fee_package.name.len.app_error", nil, "", http.StatusBadRequest)
	}
	if fp.CourseID == "" {
		return model.NewAppError("FeePackageIsValid", "model.lms.fee_package.course_id.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func FeePackagePreCreate(fp *lms_models.FeePackage) {
	if fp.ID == "" {
		fp.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	fp.Createat = now
	fp.Updateat = now
}

func FeePackagePreUpdate(fp *lms_models.FeePackage) {
	fp.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// Tuition — status VARCHAR(50), note VARCHAR(500), discount_type VARCHAR(50)
// ============================================================================

func TuitionIsValid(t *lms_models.Tuition) *model.AppError {
	if t.ID != "" && !model.IsValidId(t.ID) {
		return model.NewAppError("TuitionIsValid", "model.lms.tuition.id.app_error", nil, "", http.StatusBadRequest)
	}
	if t.StudentID == "" {
		return model.NewAppError("TuitionIsValid", "model.lms.tuition.student_id.app_error", nil, "", http.StatusBadRequest)
	}
	if t.ClassID == "" {
		return model.NewAppError("TuitionIsValid", "model.lms.tuition.class_id.app_error", nil, "", http.StatusBadRequest)
	}
	if t.FeePackageID == "" {
		return model.NewAppError("TuitionIsValid", "model.lms.tuition.fee_package_id.app_error", nil, "", http.StatusBadRequest)
	}
	if len(t.Status) > 50 {
		return model.NewAppError("TuitionIsValid", "model.lms.tuition.status.len.app_error", nil, "", http.StatusBadRequest)
	}
	if t.Note.Valid && len(t.Note.String) > 500 {
		return model.NewAppError("TuitionIsValid", "model.lms.tuition.note.len.app_error", nil, "", http.StatusBadRequest)
	}
	if t.DiscountType.Valid && len(t.DiscountType.String) > 50 {
		return model.NewAppError("TuitionIsValid", "model.lms.tuition.discount_type.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func TuitionPreCreate(t *lms_models.Tuition) {
	if t.ID == "" {
		t.ID = model.NewId()
	}
	if t.Status == "" {
		t.Status = "PENDING"
	}
	now := time.Now().UnixMilli()
	t.Createat = now
	t.Updateat = now
}

func TuitionPreUpdate(t *lms_models.Tuition) {
	t.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// Payment — method VARCHAR(50), receipt_number VARCHAR(100), note VARCHAR(500)
// ============================================================================

func PaymentIsValid(p *lms_models.Payment) *model.AppError {
	if p.ID != "" && !model.IsValidId(p.ID) {
		return model.NewAppError("PaymentIsValid", "model.lms.payment.id.app_error", nil, "", http.StatusBadRequest)
	}
	if p.TuitionID == "" {
		return model.NewAppError("PaymentIsValid", "model.lms.payment.tuition_id.app_error", nil, "", http.StatusBadRequest)
	}
	if p.PaidByID == "" {
		return model.NewAppError("PaymentIsValid", "model.lms.payment.paid_by_id.app_error", nil, "", http.StatusBadRequest)
	}
	if len(p.Method) > 50 {
		return model.NewAppError("PaymentIsValid", "model.lms.payment.method.len.app_error", nil, "", http.StatusBadRequest)
	}
	if p.ReceiptNumber.Valid && len(p.ReceiptNumber.String) > 100 {
		return model.NewAppError("PaymentIsValid", "model.lms.payment.receipt_number.len.app_error", nil, "", http.StatusBadRequest)
	}
	if p.Note.Valid && len(p.Note.String) > 500 {
		return model.NewAppError("PaymentIsValid", "model.lms.payment.note.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func PaymentPreCreate(p *lms_models.Payment) {
	if p.ID == "" {
		p.ID = model.NewId()
	}
	if p.Method == "" {
		p.Method = "CASH"
	}
	if p.PaymentDate.IsZero() {
		p.PaymentDate = time.Now()
	}
	now := time.Now().UnixMilli()
	p.Createat = now
	p.Updateat = now
}

// ============================================================================
// FeeRefund — reason VARCHAR(500), status VARCHAR(50)
// ============================================================================

func FeeRefundIsValid(fr *lms_models.FeeRefund) *model.AppError {
	if fr.ID != "" && !model.IsValidId(fr.ID) {
		return model.NewAppError("FeeRefundIsValid", "model.lms.fee_refund.id.app_error", nil, "", http.StatusBadRequest)
	}
	if fr.TuitionID == "" {
		return model.NewAppError("FeeRefundIsValid", "model.lms.fee_refund.tuition_id.app_error", nil, "", http.StatusBadRequest)
	}
	if fr.Reason.Valid && len(fr.Reason.String) > 500 {
		return model.NewAppError("FeeRefundIsValid", "model.lms.fee_refund.reason.len.app_error", nil, "", http.StatusBadRequest)
	}
	if len(fr.Status) > 50 {
		return model.NewAppError("FeeRefundIsValid", "model.lms.fee_refund.status.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func FeeRefundPreCreate(fr *lms_models.FeeRefund) {
	if fr.ID == "" {
		fr.ID = model.NewId()
	}
	if fr.Status == "" {
		fr.Status = "PENDING"
	}
	if fr.RefundDate.IsZero() {
		fr.RefundDate = time.Now()
	}
	now := time.Now().UnixMilli()
	fr.Createat = now
	fr.Updateat = now
}

func FeeRefundPreUpdate(fr *lms_models.FeeRefund) {
	fr.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// PostCategory — name VARCHAR(100), slug VARCHAR(120)
// ============================================================================

func PostCategoryIsValid(pc *lms_models.PostCategory) *model.AppError {
	if pc.ID != "" && !model.IsValidId(pc.ID) {
		return model.NewAppError("PostCategoryIsValid", "model.lms.post_category.id.app_error", nil, "", http.StatusBadRequest)
	}
	if pc.Name == "" {
		return model.NewAppError("PostCategoryIsValid", "model.lms.post_category.name.app_error", nil, "", http.StatusBadRequest)
	}
	if len(pc.Name) > 100 {
		return model.NewAppError("PostCategoryIsValid", "model.lms.post_category.name.len.app_error", nil, "", http.StatusBadRequest)
	}
	if pc.Slug == "" {
		return model.NewAppError("PostCategoryIsValid", "model.lms.post_category.slug.app_error", nil, "", http.StatusBadRequest)
	}
	if len(pc.Slug) > 120 {
		return model.NewAppError("PostCategoryIsValid", "model.lms.post_category.slug.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func PostCategoryPreCreate(pc *lms_models.PostCategory) {
	if pc.ID == "" {
		pc.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	pc.Createat = now
	pc.Updateat = now
}

// ============================================================================
// BlogPost — title VARCHAR(200), slug VARCHAR(220), excerpt VARCHAR(500),
//           status VARCHAR(50), seo_title VARCHAR(200), seo_description VARCHAR(500),
//           seo_keywords VARCHAR(200)
// ============================================================================

func BlogPostIsValid(p *lms_models.BlogPost) *model.AppError {
	if p.ID != "" && !model.IsValidId(p.ID) {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.id.app_error", nil, "", http.StatusBadRequest)
	}
	if p.Title == "" {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.title.app_error", nil, "", http.StatusBadRequest)
	}
	if len(p.Title) > 200 {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.title.len.app_error", nil, "", http.StatusBadRequest)
	}
	if p.Slug == "" {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.slug.app_error", nil, "", http.StatusBadRequest)
	}
	if len(p.Slug) > 220 {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.slug.len.app_error", nil, "", http.StatusBadRequest)
	}
	if p.CategoryID == "" {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.category_id.app_error", nil, "", http.StatusBadRequest)
	}
	if p.AuthorID == "" {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.author_id.app_error", nil, "", http.StatusBadRequest)
	}
	if p.Excerpt.Valid && len(p.Excerpt.String) > 500 {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.excerpt.len.app_error", nil, "", http.StatusBadRequest)
	}
	if len(p.Status) > 50 {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.status.len.app_error", nil, "", http.StatusBadRequest)
	}
	if p.SeoTitle.Valid && len(p.SeoTitle.String) > 200 {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.seo_title.len.app_error", nil, "", http.StatusBadRequest)
	}
	if p.SeoDescription.Valid && len(p.SeoDescription.String) > 500 {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.seo_description.len.app_error", nil, "", http.StatusBadRequest)
	}
	if p.SeoKeywords.Valid && len(p.SeoKeywords.String) > 200 {
		return model.NewAppError("BlogPostIsValid", "model.lms.blog_post.seo_keywords.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func BlogPostPreCreate(p *lms_models.BlogPost) {
	if p.ID == "" {
		p.ID = model.NewId()
	}
	if p.Status == "" {
		p.Status = "DRAFT"
	}
	now := time.Now().UnixMilli()
	p.Createat = now
	p.Updateat = now
}

func BlogPostPreUpdate(p *lms_models.BlogPost) {
	p.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// WeeklyReview — content TEXT (no length limit)
// ============================================================================

func WeeklyReviewIsValid(wr *lms_models.WeeklyReview) *model.AppError {
	if wr.ID != "" && !model.IsValidId(wr.ID) {
		return model.NewAppError("WeeklyReviewIsValid", "model.lms.weekly_review.id.app_error", nil, "", http.StatusBadRequest)
	}
	if wr.StudentID == "" {
		return model.NewAppError("WeeklyReviewIsValid", "model.lms.weekly_review.student_id.app_error", nil, "", http.StatusBadRequest)
	}
	if wr.ClassID == "" {
		return model.NewAppError("WeeklyReviewIsValid", "model.lms.weekly_review.class_id.app_error", nil, "", http.StatusBadRequest)
	}
	if wr.Content == "" {
		return model.NewAppError("WeeklyReviewIsValid", "model.lms.weekly_review.content.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func WeeklyReviewPreCreate(wr *lms_models.WeeklyReview) {
	if wr.ID == "" {
		wr.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	wr.Createat = now
	wr.Updateat = now
}

func WeeklyReviewPreUpdate(wr *lms_models.WeeklyReview) {
	wr.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// Homework — title VARCHAR(200), description TEXT (no length limit)
// ============================================================================

func HomeworkIsValid(h *lms_models.Homework) *model.AppError {
	if h.ID != "" && !model.IsValidId(h.ID) {
		return model.NewAppError("HomeworkIsValid", "model.lms.homework.id.app_error", nil, "", http.StatusBadRequest)
	}
	if h.Title == "" {
		return model.NewAppError("HomeworkIsValid", "model.lms.homework.title.app_error", nil, "", http.StatusBadRequest)
	}
	if len(h.Title) > 200 {
		return model.NewAppError("HomeworkIsValid", "model.lms.homework.title.len.app_error", nil, "", http.StatusBadRequest)
	}
	if h.ClassID == "" {
		return model.NewAppError("HomeworkIsValid", "model.lms.homework.class_id.app_error", nil, "", http.StatusBadRequest)
	}
	if h.CourseID == "" {
		return model.NewAppError("HomeworkIsValid", "model.lms.homework.course_id.app_error", nil, "", http.StatusBadRequest)
	}
	if h.TeacherID == "" {
		return model.NewAppError("HomeworkIsValid", "model.lms.homework.teacher_id.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func HomeworkPreCreate(h *lms_models.Homework) {
	if h.ID == "" {
		h.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	h.Createat = now
	h.Updateat = now
}

func HomeworkPreUpdate(h *lms_models.Homework) {
	h.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// Submission — title VARCHAR(200), description VARCHAR(500), feedback VARCHAR(500)
// ============================================================================

func SubmissionIsValid(s *lms_models.Submission) *model.AppError {
	if s.ID != "" && !model.IsValidId(s.ID) {
		return model.NewAppError("SubmissionIsValid", "model.lms.submission.id.app_error", nil, "", http.StatusBadRequest)
	}
	if s.StudentID == "" {
		return model.NewAppError("SubmissionIsValid", "model.lms.submission.student_id.app_error", nil, "", http.StatusBadRequest)
	}
	if s.HomeworkID == "" {
		return model.NewAppError("SubmissionIsValid", "model.lms.submission.homework_id.app_error", nil, "", http.StatusBadRequest)
	}
	if len(s.Title) > 200 {
		return model.NewAppError("SubmissionIsValid", "model.lms.submission.title.len.app_error", nil, "", http.StatusBadRequest)
	}
	if s.Description.Valid && len(s.Description.String) > 500 {
		return model.NewAppError("SubmissionIsValid", "model.lms.submission.description.len.app_error", nil, "", http.StatusBadRequest)
	}
	if s.Feedback.Valid && len(s.Feedback.String) > 500 {
		return model.NewAppError("SubmissionIsValid", "model.lms.submission.feedback.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func SubmissionPreCreate(s *lms_models.Submission) {
	if s.ID == "" {
		s.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	s.Createat = now
	s.Updateat = now
}

func SubmissionPreUpdate(s *lms_models.Submission) {
	s.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// ClassMedia — title VARCHAR(200), file_url VARCHAR(500), file_type VARCHAR(50)
// ============================================================================

func ClassMediaIsValid(cm *lms_models.ClassMedium) *model.AppError {
	if cm.ID != "" && !model.IsValidId(cm.ID) {
		return model.NewAppError("ClassMediaIsValid", "model.lms.class_media.id.app_error", nil, "", http.StatusBadRequest)
	}
	if cm.ClassID == "" {
		return model.NewAppError("ClassMediaIsValid", "model.lms.class_media.class_id.app_error", nil, "", http.StatusBadRequest)
	}
	if cm.FileURL == "" {
		return model.NewAppError("ClassMediaIsValid", "model.lms.class_media.file_url.app_error", nil, "", http.StatusBadRequest)
	}
	if cm.FileType == "" {
		return model.NewAppError("ClassMediaIsValid", "model.lms.class_media.file_type.app_error", nil, "", http.StatusBadRequest)
	}
	if cm.Title.Valid && len(cm.Title.String) > 200 {
		return model.NewAppError("ClassMediaIsValid", "model.lms.class_media.title.len.app_error", nil, "", http.StatusBadRequest)
	}
	if len(cm.FileURL) > 500 {
		return model.NewAppError("ClassMediaIsValid", "model.lms.class_media.file_url.len.app_error", nil, "", http.StatusBadRequest)
	}
	if len(cm.FileType) > 50 {
		return model.NewAppError("ClassMediaIsValid", "model.lms.class_media.file_type.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func ClassMediaPreCreate(cm *lms_models.ClassMedium) {
	if cm.ID == "" {
		cm.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	cm.Createat = now
	cm.Updateat = now
}

// ============================================================================
// AdditionalFee — label VARCHAR(100)
// ============================================================================

func AdditionalFeeIsValid(af *lms_models.AdditionalFee) *model.AppError {
	if af.ID != "" && !model.IsValidId(af.ID) {
		return model.NewAppError("AdditionalFeeIsValid", "model.lms.additional_fee.id.app_error", nil, "", http.StatusBadRequest)
	}
	if af.Label == "" {
		return model.NewAppError("AdditionalFeeIsValid", "model.lms.additional_fee.label.app_error", nil, "", http.StatusBadRequest)
	}
	if len(af.Label) > 100 {
		return model.NewAppError("AdditionalFeeIsValid", "model.lms.additional_fee.label.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func AdditionalFeePreCreate(af *lms_models.AdditionalFee) {
	if af.ID == "" {
		af.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	af.Createat = now
	af.Updateat = now
}

// ============================================================================
// Task — title VARCHAR(200), description VARCHAR(500), priority VARCHAR(50),
//       status VARCHAR(50), notes VARCHAR(500)
// ============================================================================

func TaskIsValid(t *lms_models.Task) *model.AppError {
	if t.ID != "" && !model.IsValidId(t.ID) {
		return model.NewAppError("TaskIsValid", "model.lms.task.id.app_error", nil, "", http.StatusBadRequest)
	}
	if t.Title == "" {
		return model.NewAppError("TaskIsValid", "model.lms.task.title.app_error", nil, "", http.StatusBadRequest)
	}
	if len(t.Title) > 200 {
		return model.NewAppError("TaskIsValid", "model.lms.task.title.len.app_error", nil, "", http.StatusBadRequest)
	}
	if t.AssigneeID == "" {
		return model.NewAppError("TaskIsValid", "model.lms.task.assignee_id.app_error", nil, "", http.StatusBadRequest)
	}
	if t.CreatorID == "" {
		return model.NewAppError("TaskIsValid", "model.lms.task.creator_id.app_error", nil, "", http.StatusBadRequest)
	}
	if t.Description.Valid && len(t.Description.String) > 500 {
		return model.NewAppError("TaskIsValid", "model.lms.task.description.len.app_error", nil, "", http.StatusBadRequest)
	}
	if len(t.Priority) > 50 {
		return model.NewAppError("TaskIsValid", "model.lms.task.priority.len.app_error", nil, "", http.StatusBadRequest)
	}
	if len(t.Status) > 50 {
		return model.NewAppError("TaskIsValid", "model.lms.task.status.len.app_error", nil, "", http.StatusBadRequest)
	}
	if t.Notes.Valid && len(t.Notes.String) > 500 {
		return model.NewAppError("TaskIsValid", "model.lms.task.notes.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func TaskPreCreate(t *lms_models.Task) {
	if t.ID == "" {
		t.ID = model.NewId()
	}
	if t.Priority == "" {
		t.Priority = "MEDIUM"
	}
	if t.Status == "" {
		t.Status = "TODO"
	}
	now := time.Now().UnixMilli()
	t.Createat = now
	t.Updateat = now
}

func TaskPreUpdate(t *lms_models.Task) {
	t.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// Banner — title VARCHAR(200), image_url VARCHAR(500), link_url VARCHAR(500)
// ============================================================================

func BannerIsValid(b *lms_models.Banner) *model.AppError {
	if b.ID != "" && !model.IsValidId(b.ID) {
		return model.NewAppError("BannerIsValid", "model.lms.banner.id.app_error", nil, "", http.StatusBadRequest)
	}
	if b.Title == "" {
		return model.NewAppError("BannerIsValid", "model.lms.banner.title.app_error", nil, "", http.StatusBadRequest)
	}
	if len(b.Title) > 200 {
		return model.NewAppError("BannerIsValid", "model.lms.banner.title.len.app_error", nil, "", http.StatusBadRequest)
	}
	if b.ImageURL.Valid && len(b.ImageURL.String) > 500 {
		return model.NewAppError("BannerIsValid", "model.lms.banner.image_url.len.app_error", nil, "", http.StatusBadRequest)
	}
	if b.LinkURL.Valid && len(b.LinkURL.String) > 500 {
		return model.NewAppError("BannerIsValid", "model.lms.banner.link_url.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func BannerPreCreate(b *lms_models.Banner) {
	if b.ID == "" {
		b.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	b.Createat = now
	b.Updateat = now
}

func BannerPreUpdate(b *lms_models.Banner) {
	b.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// Notification — title VARCHAR(200), message VARCHAR(500), type VARCHAR(50),
//               link_url VARCHAR(500)
// ============================================================================

func NotificationIsValid(n *lms_models.Notification) *model.AppError {
	if n.ID != "" && !model.IsValidId(n.ID) {
		return model.NewAppError("NotificationIsValid", "model.lms.notification.id.app_error", nil, "", http.StatusBadRequest)
	}
	if n.UserID == "" {
		return model.NewAppError("NotificationIsValid", "model.lms.notification.user_id.app_error", nil, "", http.StatusBadRequest)
	}
	if n.Title == "" {
		return model.NewAppError("NotificationIsValid", "model.lms.notification.title.app_error", nil, "", http.StatusBadRequest)
	}
	if len(n.Title) > 200 {
		return model.NewAppError("NotificationIsValid", "model.lms.notification.title.len.app_error", nil, "", http.StatusBadRequest)
	}
	if n.Message == "" {
		return model.NewAppError("NotificationIsValid", "model.lms.notification.message.app_error", nil, "", http.StatusBadRequest)
	}
	if len(n.Message) > 500 {
		return model.NewAppError("NotificationIsValid", "model.lms.notification.message.len.app_error", nil, "", http.StatusBadRequest)
	}
	if n.Type.Valid && len(n.Type.String) > 50 {
		return model.NewAppError("NotificationIsValid", "model.lms.notification.type.len.app_error", nil, "", http.StatusBadRequest)
	}
	if n.LinkURL.Valid && len(n.LinkURL.String) > 500 {
		return model.NewAppError("NotificationIsValid", "model.lms.notification.link_url.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func NotificationPreCreate(n *lms_models.Notification) {
	if n.ID == "" {
		n.ID = model.NewId()
	}
	now := time.Now().UnixMilli()
	n.Createat = now
	n.Updateat = now
}

func NotificationPreUpdate(n *lms_models.Notification) {
	n.Updateat = time.Now().UnixMilli()
}

// ============================================================================
// Material — title VARCHAR(200), description VARCHAR(500), unit VARCHAR(100),
//            visibility VARCHAR(50)
// ============================================================================

func MaterialIsValid(m *lms_models.Material) *model.AppError {
	if m.ID != "" && !model.IsValidId(m.ID) {
		return model.NewAppError("MaterialIsValid", "model.lms.material.id.app_error", nil, "", http.StatusBadRequest)
	}
	if m.Title == "" {
		return model.NewAppError("MaterialIsValid", "model.lms.material.title.app_error", nil, "", http.StatusBadRequest)
	}
	if len(m.Title) > 200 {
		return model.NewAppError("MaterialIsValid", "model.lms.material.title.len.app_error", nil, "", http.StatusBadRequest)
	}
	if m.CourseID == "" {
		return model.NewAppError("MaterialIsValid", "model.lms.material.course_id.app_error", nil, "", http.StatusBadRequest)
	}
	if m.UploadedByID == "" {
		return model.NewAppError("MaterialIsValid", "model.lms.material.uploaded_by_id.app_error", nil, "", http.StatusBadRequest)
	}
	if m.Description.Valid && len(m.Description.String) > 500 {
		return model.NewAppError("MaterialIsValid", "model.lms.material.description.len.app_error", nil, "", http.StatusBadRequest)
	}
	if m.Unit.Valid && len(m.Unit.String) > 100 {
		return model.NewAppError("MaterialIsValid", "model.lms.material.unit.len.app_error", nil, "", http.StatusBadRequest)
	}
	if len(m.Visibility) > 50 {
		return model.NewAppError("MaterialIsValid", "model.lms.material.visibility.len.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func MaterialPreCreate(m *lms_models.Material) {
	if m.ID == "" {
		m.ID = model.NewId()
	}
	if m.Visibility == "" {
		m.Visibility = "TEACHER_ONLY"
	}
	now := time.Now().UnixMilli()
	m.Createat = now
	m.Updateat = now
}

func MaterialPreUpdate(m *lms_models.Material) {
	m.Updateat = time.Now().UnixMilli()
}
