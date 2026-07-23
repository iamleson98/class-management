package lmsapi

import (
	"encoding/json"

	"github.com/aarondl/null/v8"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
)

// ============================================================================
// LMS Role Constants
// ============================================================================

// const (
// 	LMSRoleSuperAdmin = "SUPER_ADMIN"
// 	LMSRoleAdmin      = "ADMIN"
// 	LMSRoleCounselor  = "COUNSELOR"
// 	LMSRoleTeacher    = "TEACHER"
// 	LMSRoleAccountant = "ACCOUNTANT"
// 	LMSRoleMarketing  = "MARKETING"
// 	LMSRoleParent     = "PARENT"
// 	LMSRoleStudent    = "STUDENT"
// )

// ============================================================================
// Status Enums
// ============================================================================

const (
	// Student statuses
	StudentStatusActive    = "ACTIVE"
	StudentStatusReserved  = "RESERVED"
	StudentStatusDropped   = "DROPPED"
	StudentStatusPending   = "PENDING"
	StudentStatusCompleted = "COMPLETED"

	// Lead statuses
	LeadStatusNew            = "NEW"
	LeadStatusContacted      = "CONTACTED"
	LeadStatusTestScheduled  = "TEST_SCHEDULED"
	LeadStatusTested         = "TESTED"
	LeadStatusPendingPayment = "PENDING_PAYMENT"
	LeadStatusEnrolled       = "ENROLLED"
	LeadStatusNotInterested  = "NOT_INTERESTED"

	// Lead sources
	LeadSourceWebsite  = "WEBSITE"
	LeadSourceFacebook = "FACEBOOK"
	LeadSourceReferral = "REFERRAL"
	LeadSourcePhone    = "PHONE"
	LeadSourceWalkIn   = "WALK_IN"
	LeadSourceZalo     = "ZALO"
	LeadSourceTiktok   = "TIKTOK"

	// Lead activity types
	ActivityTypeNote    = "NOTE"
	ActivityTypeCall    = "CALL"
	ActivityTypeMeeting = "MEETING"
	ActivityTypeEmail   = "EMAIL"

	// Class statuses
	ClassStatusOpen      = "OPEN"
	ClassStatusClosed    = "CLOSED"
	ClassStatusCancelled = "CANCELLED"

	// Session statuses
	SessionStatusScheduled = "SCHEDULED"
	SessionStatusCompleted = "COMPLETED"
	SessionStatusCancelled = "CANCELLED"

	// Attendance statuses
	AttendanceStatusPresent         = "PRESENT"
	AttendanceStatusAbsentExcused   = "ABSENT_EXCUSED"
	AttendanceStatusAbsentUnexcused = "ABSENT_UNEXCUSED"
	AttendanceStatusLate            = "LATE"
	AttendanceStatusEarlyLeave      = "EARLY_LEAVE"
	AttendanceStatusMakeup          = "MAKEUP"

	// Task priorities
	TaskPriorityHigh   = "HIGH"
	TaskPriorityMedium = "MEDIUM"
	TaskPriorityLow    = "LOW"

	// Task statuses
	TaskStatusTodo       = "TODO"
	TaskStatusInProgress = "IN_PROGRESS"
	TaskStatusReview     = "REVIEW"
	TaskStatusDone       = "DONE"

	// Post statuses
	PostStatusDraft     = "DRAFT"
	PostStatusPublished = "PUBLISHED"

	// Material visibility
	MaterialVisibilityPublic      = "PUBLIC"
	MaterialVisibilityTeacherOnly = "TEACHER_ONLY"

	// Material types
	MaterialTypeDocument = "DOCUMENT"
	MaterialTypeVideo    = "VIDEO"
	MaterialTypeAudio    = "AUDIO"
	MaterialTypeExercise = "EXERCISE"
	MaterialTypeImage    = "IMAGE"

	// Payment methods
	PaymentMethodCash     = "CASH"
	PaymentMethodTransfer = "TRANSFER"
	PaymentMethodCard     = "CARD"

	// Tuition statuses
	TuitionStatusPending = "PENDING"
	TuitionStatusPartial = "PARTIAL"
	TuitionStatusPaid    = "PAID"
	TuitionStatusOverdue = "OVERDUE"

	// Fee refund statuses
	FeeRefundStatusPending  = "PENDING"
	FeeRefundStatusApproved = "APPROVED"
	FeeRefundStatusRejected = "REJECTED"

	// Tuition discount types
	DiscountTypePercent  = "PERCENT"
	DiscountTypeFixedVND = "FIXED_VND"

	// Class media file types
	ClassMediaTypePhoto = "PHOTO"
	ClassMediaTypeVideo = "VIDEO"
)

// ============================================================================
// Props helpers — read/write role-specific fields from users.props JSONB
// ============================================================================

// StudentProps holds student-specific fields stored in users.props["student"].
type StudentProps struct {
	Code         string `json:"code,omitempty"`
	DOB          string `json:"dob,omitempty"`
	Gender       string `json:"gender,omitempty"`
	School       string `json:"school,omitempty"`
	SchoolGrade  string `json:"schoolGrade,omitempty"`
	Status       string `json:"status,omitempty"`
	ParentName   string `json:"parentName,omitempty"`
	VMGClassCode string `json:"vmgClassCode,omitempty"`
	Notes        string `json:"notes,omitempty"`
}

// TeacherProps holds teacher-specific fields stored in users.props["teacher"].
type TeacherProps struct {
	Specializations string `json:"specializations,omitempty"`
	Bio             string `json:"bio,omitempty"`
}

// ParentProps holds parent-specific fields stored in users.props["parent"].
type ParentProps struct {
	Relation string `json:"relation,omitempty"`
}

// GetStudentProps extracts student fields from a user's props JSONB.
func GetStudentProps(props null.JSON) *StudentProps {
	if !props.Valid || len(props.JSON) == 0 {
		return &StudentProps{}
	}
	var m map[string]json.RawMessage
	if err := json.Unmarshal(props.JSON, &m); err != nil {
		return &StudentProps{}
	}
	raw, ok := m["student"]
	if !ok {
		return &StudentProps{}
	}
	sp := &StudentProps{}
	_ = json.Unmarshal(raw, sp)
	return sp
}

// SetStudentProps builds a full props map merging existing props with student fields.
func SetStudentProps(existingProps null.JSON, sp *StudentProps) (null.JSON, error) {
	m := make(map[string]json.RawMessage)
	if existingProps.Valid && len(existingProps.JSON) > 0 {
		_ = json.Unmarshal(existingProps.JSON, &m)
	}
	studentJSON, err := json.Marshal(sp)
	if err != nil {
		return null.JSON{}, err
	}
	m["student"] = studentJSON
	result, err := json.Marshal(m)
	if err != nil {
		return null.JSON{}, err
	}
	return null.JSONFrom(result), nil
}

// GetTeacherProps extracts teacher fields from a user's props JSONB.
func GetTeacherProps(props null.JSON) *TeacherProps {
	if !props.Valid || len(props.JSON) == 0 {
		return &TeacherProps{}
	}
	var m map[string]json.RawMessage
	if err := json.Unmarshal(props.JSON, &m); err != nil {
		return &TeacherProps{}
	}
	raw, ok := m["teacher"]
	if !ok {
		return &TeacherProps{}
	}
	tp := &TeacherProps{}
	_ = json.Unmarshal(raw, tp)
	return tp
}

// SetTeacherProps builds a full props map merging existing props with teacher fields.
func SetTeacherProps(existingProps null.JSON, tp *TeacherProps) (null.JSON, error) {
	m := make(map[string]json.RawMessage)
	if existingProps.Valid && len(existingProps.JSON) > 0 {
		_ = json.Unmarshal(existingProps.JSON, &m)
	}
	teacherJSON, err := json.Marshal(tp)
	if err != nil {
		return null.JSON{}, err
	}
	m["teacher"] = teacherJSON
	result, err := json.Marshal(m)
	if err != nil {
		return null.JSON{}, err
	}
	return null.JSONFrom(result), nil
}

// GetParentProps extracts parent fields from a user's props JSONB.
func GetParentProps(props null.JSON) *ParentProps {
	if !props.Valid || len(props.JSON) == 0 {
		return &ParentProps{}
	}
	var m map[string]json.RawMessage
	if err := json.Unmarshal(props.JSON, &m); err != nil {
		return &ParentProps{}
	}
	raw, ok := m["parent"]
	if !ok {
		return &ParentProps{}
	}
	pp := &ParentProps{}
	_ = json.Unmarshal(raw, pp)
	return pp
}

// SetParentProps builds a full props map merging existing props with parent fields.
func SetParentProps(existingProps null.JSON, pp *ParentProps) (null.JSON, error) {
	m := make(map[string]json.RawMessage)
	if existingProps.Valid && len(existingProps.JSON) > 0 {
		_ = json.Unmarshal(existingProps.JSON, &m)
	}
	parentJSON, err := json.Marshal(pp)
	if err != nil {
		return null.JSON{}, err
	}
	m["parent"] = parentJSON
	result, err := json.Marshal(m)
	if err != nil {
		return null.JSON{}, err
	}
	return null.JSONFrom(result), nil
}

// ============================================================================
// Enriched user model — used in API responses
// ============================================================================

// LMSUser is the enriched user model for API responses.
type LMSUser struct {
	lms_models.User
	StudentProps *StudentProps `json:"studentProps,omitempty"`
	TeacherProps *TeacherProps `json:"teacherProps,omitempty"`
	ParentProps  *ParentProps  `json:"parentProps,omitempty"`
}

// NewLMSUser creates an enriched user from a database user model.
// func NewLMSUser(u *lms_models.User) *LMSUser {
// 	lms := &LMSUser{User: *u}
// 	roles := u.Roles.String
// 	switch roles {
// 	case LMSRoleStudent:
// 		lms.StudentProps = GetStudentProps(u.Props)
// 	case LMSRoleTeacher:
// 		lms.TeacherProps = GetTeacherProps(u.Props)
// 	case LMSRoleParent:
// 		lms.ParentProps = GetParentProps(u.Props)
// 	}
// 	return lms
// }

// ============================================================================
// LMSResponse envelope — consistent {data, error} format matching Next.js
// ============================================================================

// LMSResponse is the standard API response envelope.
type LMSResponse struct {
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}
