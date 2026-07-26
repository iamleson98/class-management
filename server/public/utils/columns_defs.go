// Code automatically generated;
// DO NOT EDIT

package utils

type UserColumn string

const (
	UserID                 UserColumn = "users.id"
	UserCreateat           UserColumn = "users.createat"
	UserUpdateat           UserColumn = "users.updateat"
	UserDeleteat           UserColumn = "users.deleteat"
	UserUsername           UserColumn = "users.username"
	UserPassword           UserColumn = "users.password"
	UserAuthdata           UserColumn = "users.authdata"
	UserAuthservice        UserColumn = "users.authservice"
	UserEmail              UserColumn = "users.email"
	UserEmailverified      UserColumn = "users.emailverified"
	UserNickname           UserColumn = "users.nickname"
	UserFirstname          UserColumn = "users.firstname"
	UserLastname           UserColumn = "users.lastname"
	UserRoles              UserColumn = "users.roles"
	UserAllowmarketing     UserColumn = "users.allowmarketing"
	UserProps              UserColumn = "users.props"
	UserNotifyprops        UserColumn = "users.notifyprops"
	UserLastpasswordupdate UserColumn = "users.lastpasswordupdate"
	UserLastpictureupdate  UserColumn = "users.lastpictureupdate"
	UserFailedattempts     UserColumn = "users.failedattempts"
	UserLocale             UserColumn = "users.locale"
	UserMfaactive          UserColumn = "users.mfaactive"
	UserMfasecret          UserColumn = "users.mfasecret"
	UserPosition           UserColumn = "users.position"
	UserTimezone           UserColumn = "users.timezone"
	UserRemoteid           UserColumn = "users.remoteid"
	UserLastlogin          UserColumn = "users.lastlogin"
	UserMfausedtimestamps  UserColumn = "users.mfausedtimestamps"
	UserPhone              UserColumn = "users.phone"
	UserParentID           UserColumn = "users.parent_id"
)

func (c UserColumn) IsValid() bool {
	switch c {
	case UserID:
		return true
	case UserCreateat:
		return true
	case UserUpdateat:
		return true
	case UserDeleteat:
		return true
	case UserUsername:
		return true
	case UserPassword:
		return true
	case UserAuthdata:
		return true
	case UserAuthservice:
		return true
	case UserEmail:
		return true
	case UserEmailverified:
		return true
	case UserNickname:
		return true
	case UserFirstname:
		return true
	case UserLastname:
		return true
	case UserRoles:
		return true
	case UserAllowmarketing:
		return true
	case UserProps:
		return true
	case UserNotifyprops:
		return true
	case UserLastpasswordupdate:
		return true
	case UserLastpictureupdate:
		return true
	case UserFailedattempts:
		return true
	case UserLocale:
		return true
	case UserMfaactive:
		return true
	case UserMfasecret:
		return true
	case UserPosition:
		return true
	case UserTimezone:
		return true
	case UserRemoteid:
		return true
	case UserLastlogin:
		return true
	case UserMfausedtimestamps:
		return true
	case UserPhone:
		return true
	case UserParentID:
		return true
	default:
		return false
	}
}

type LMSSessionColumn string

const (
	LMSSessionID        LMSSessionColumn = "lms_sessions.id"
	LMSSessionTitle     LMSSessionColumn = "lms_sessions.title"
	LMSSessionClassID   LMSSessionColumn = "lms_sessions.class_id"
	LMSSessionStartTime LMSSessionColumn = "lms_sessions.start_time"
	LMSSessionEndTime   LMSSessionColumn = "lms_sessions.end_time"
	LMSSessionRoom      LMSSessionColumn = "lms_sessions.room"
	LMSSessionTeacherID LMSSessionColumn = "lms_sessions.teacher_id"
	LMSSessionLessonID  LMSSessionColumn = "lms_sessions.lesson_id"
	LMSSessionStatus    LMSSessionColumn = "lms_sessions.status"
	LMSSessionDate      LMSSessionColumn = "lms_sessions.date"
	LMSSessionCreateat  LMSSessionColumn = "lms_sessions.createat"
	LMSSessionUpdateat  LMSSessionColumn = "lms_sessions.updateat"
)

func (c LMSSessionColumn) IsValid() bool {
	switch c {
	case LMSSessionID:
		return true
	case LMSSessionTitle:
		return true
	case LMSSessionClassID:
		return true
	case LMSSessionStartTime:
		return true
	case LMSSessionEndTime:
		return true
	case LMSSessionRoom:
		return true
	case LMSSessionTeacherID:
		return true
	case LMSSessionLessonID:
		return true
	case LMSSessionStatus:
		return true
	case LMSSessionDate:
		return true
	case LMSSessionCreateat:
		return true
	case LMSSessionUpdateat:
		return true
	default:
		return false
	}
}

type ClassColumn string

const (
	ClassID        ClassColumn = "classes.id"
	ClassCourseID  ClassColumn = "classes.course_id"
	ClassBranchID  ClassColumn = "classes.branch_id"
	ClassName      ClassColumn = "classes.name"
	ClassCode      ClassColumn = "classes.code"
	ClassTeacherID ClassColumn = "classes.teacher_id"
	ClassStatus    ClassColumn = "classes.status"
	ClassRoom      ClassColumn = "classes.room"
	ClassStartDate ClassColumn = "classes.start_date"
	ClassCreateat  ClassColumn = "classes.createat"
	ClassUpdateat  ClassColumn = "classes.updateat"
)

func (c ClassColumn) IsValid() bool {
	switch c {
	case ClassID:
		return true
	case ClassCourseID:
		return true
	case ClassBranchID:
		return true
	case ClassName:
		return true
	case ClassCode:
		return true
	case ClassTeacherID:
		return true
	case ClassStatus:
		return true
	case ClassRoom:
		return true
	case ClassStartDate:
		return true
	case ClassCreateat:
		return true
	case ClassUpdateat:
		return true
	default:
		return false
	}
}

type StudentClassColumn string

const (
	StudentClassID           StudentClassColumn = "student_classes.id"
	StudentClassStudentID    StudentClassColumn = "student_classes.student_id"
	StudentClassClassID      StudentClassColumn = "student_classes.class_id"
	StudentClassEnrollmentAt StudentClassColumn = "student_classes.enrollment_at"
	StudentClassStatus       StudentClassColumn = "student_classes.status"
	StudentClassCreateat     StudentClassColumn = "student_classes.createat"
	StudentClassUpdateat     StudentClassColumn = "student_classes.updateat"
)

func (c StudentClassColumn) IsValid() bool {
	switch c {
	case StudentClassID:
		return true
	case StudentClassStudentID:
		return true
	case StudentClassClassID:
		return true
	case StudentClassEnrollmentAt:
		return true
	case StudentClassStatus:
		return true
	case StudentClassCreateat:
		return true
	case StudentClassUpdateat:
		return true
	default:
		return false
	}
}

type BranchColumn string

const (
	BranchID       BranchColumn = "branches.id"
	BranchName     BranchColumn = "branches.name"
	BranchAddress  BranchColumn = "branches.address"
	BranchPhone    BranchColumn = "branches.phone"
	BranchCreateat BranchColumn = "branches.createat"
	BranchUpdateat BranchColumn = "branches.updateat"
)

func (c BranchColumn) IsValid() bool {
	switch c {
	case BranchID:
		return true
	case BranchName:
		return true
	case BranchAddress:
		return true
	case BranchPhone:
		return true
	case BranchCreateat:
		return true
	case BranchUpdateat:
		return true
	default:
		return false
	}
}

type AttendanceColumn string

const (
	AttendanceID        AttendanceColumn = "attendances.id"
	AttendanceSessionID AttendanceColumn = "attendances.session_id"
	AttendanceStudentID AttendanceColumn = "attendances.student_id"
	AttendanceStatus    AttendanceColumn = "attendances.status"
	AttendanceNote      AttendanceColumn = "attendances.note"
	AttendanceLocked    AttendanceColumn = "attendances.locked"
	AttendanceCreateat  AttendanceColumn = "attendances.createat"
	AttendanceUpdateat  AttendanceColumn = "attendances.updateat"
)

func (c AttendanceColumn) IsValid() bool {
	switch c {
	case AttendanceID:
		return true
	case AttendanceSessionID:
		return true
	case AttendanceStudentID:
		return true
	case AttendanceStatus:
		return true
	case AttendanceNote:
		return true
	case AttendanceLocked:
		return true
	case AttendanceCreateat:
		return true
	case AttendanceUpdateat:
		return true
	default:
		return false
	}
}

type AdditionalFeeColumn string

const (
	AdditionalFeeID        AdditionalFeeColumn = "additional_fees.id"
	AdditionalFeeTuitionID AdditionalFeeColumn = "additional_fees.tuition_id"
	AdditionalFeeLabel     AdditionalFeeColumn = "additional_fees.label"
	AdditionalFeeAmount    AdditionalFeeColumn = "additional_fees.amount"
	AdditionalFeeCreateat  AdditionalFeeColumn = "additional_fees.createat"
	AdditionalFeeUpdateat  AdditionalFeeColumn = "additional_fees.updateat"
)

func (c AdditionalFeeColumn) IsValid() bool {
	switch c {
	case AdditionalFeeID:
		return true
	case AdditionalFeeTuitionID:
		return true
	case AdditionalFeeLabel:
		return true
	case AdditionalFeeAmount:
		return true
	case AdditionalFeeCreateat:
		return true
	case AdditionalFeeUpdateat:
		return true
	default:
		return false
	}
}

type BannerColumn string

const (
	BannerID       BannerColumn = "banners.id"
	BannerTitle    BannerColumn = "banners.title"
	BannerImageURL BannerColumn = "banners.image_url"
	BannerLinkURL  BannerColumn = "banners.link_url"
	BannerPosition BannerColumn = "banners.position"
	BannerIsActive BannerColumn = "banners.is_active"
	BannerCreateat BannerColumn = "banners.createat"
	BannerUpdateat BannerColumn = "banners.updateat"
)

func (c BannerColumn) IsValid() bool {
	switch c {
	case BannerID:
		return true
	case BannerTitle:
		return true
	case BannerImageURL:
		return true
	case BannerLinkURL:
		return true
	case BannerPosition:
		return true
	case BannerIsActive:
		return true
	case BannerCreateat:
		return true
	case BannerUpdateat:
		return true
	default:
		return false
	}
}

type BlogPostColumn string

const (
	BlogPostID             BlogPostColumn = "blog_posts.id"
	BlogPostTitle          BlogPostColumn = "blog_posts.title"
	BlogPostSlug           BlogPostColumn = "blog_posts.slug"
	BlogPostContent        BlogPostColumn = "blog_posts.content"
	BlogPostExcerpt        BlogPostColumn = "blog_posts.excerpt"
	BlogPostCategoryID     BlogPostColumn = "blog_posts.category_id"
	BlogPostAuthorID       BlogPostColumn = "blog_posts.author_id"
	BlogPostStatus         BlogPostColumn = "blog_posts.status"
	BlogPostSeoTitle       BlogPostColumn = "blog_posts.seo_title"
	BlogPostSeoDescription BlogPostColumn = "blog_posts.seo_description"
	BlogPostSeoKeywords    BlogPostColumn = "blog_posts.seo_keywords"
	BlogPostPublishedAt    BlogPostColumn = "blog_posts.published_at"
	BlogPostCreateat       BlogPostColumn = "blog_posts.createat"
	BlogPostUpdateat       BlogPostColumn = "blog_posts.updateat"
)

func (c BlogPostColumn) IsValid() bool {
	switch c {
	case BlogPostID:
		return true
	case BlogPostTitle:
		return true
	case BlogPostSlug:
		return true
	case BlogPostContent:
		return true
	case BlogPostExcerpt:
		return true
	case BlogPostCategoryID:
		return true
	case BlogPostAuthorID:
		return true
	case BlogPostStatus:
		return true
	case BlogPostSeoTitle:
		return true
	case BlogPostSeoDescription:
		return true
	case BlogPostSeoKeywords:
		return true
	case BlogPostPublishedAt:
		return true
	case BlogPostCreateat:
		return true
	case BlogPostUpdateat:
		return true
	default:
		return false
	}
}

type ClassMediumColumn string

const (
	ClassMediumID           ClassMediumColumn = "class_media.id"
	ClassMediumClassID      ClassMediumColumn = "class_media.class_id"
	ClassMediumSessionID    ClassMediumColumn = "class_media.session_id"
	ClassMediumTitle        ClassMediumColumn = "class_media.title"
	ClassMediumFileURL      ClassMediumColumn = "class_media.file_url"
	ClassMediumFileType     ClassMediumColumn = "class_media.file_type"
	ClassMediumUploadedByID ClassMediumColumn = "class_media.uploaded_by_id"
	ClassMediumFileID       ClassMediumColumn = "class_media.file_id"
	ClassMediumCreateat     ClassMediumColumn = "class_media.createat"
	ClassMediumUpdateat     ClassMediumColumn = "class_media.updateat"
)

func (c ClassMediumColumn) IsValid() bool {
	switch c {
	case ClassMediumID:
		return true
	case ClassMediumClassID:
		return true
	case ClassMediumSessionID:
		return true
	case ClassMediumTitle:
		return true
	case ClassMediumFileURL:
		return true
	case ClassMediumFileType:
		return true
	case ClassMediumUploadedByID:
		return true
	case ClassMediumFileID:
		return true
	case ClassMediumCreateat:
		return true
	case ClassMediumUpdateat:
		return true
	default:
		return false
	}
}

type CourseLessonColumn string

const (
	CourseLessonID            CourseLessonColumn = "course_lessons.id"
	CourseLessonCourseID      CourseLessonColumn = "course_lessons.course_id"
	CourseLessonSessionNumber CourseLessonColumn = "course_lessons.session_number"
	CourseLessonTitle         CourseLessonColumn = "course_lessons.title"
	CourseLessonUnit          CourseLessonColumn = "course_lessons.unit"
	CourseLessonPages         CourseLessonColumn = "course_lessons.pages"
	CourseLessonObjectives    CourseLessonColumn = "course_lessons.objectives"
	CourseLessonCreateat      CourseLessonColumn = "course_lessons.createat"
	CourseLessonUpdateat      CourseLessonColumn = "course_lessons.updateat"
)

func (c CourseLessonColumn) IsValid() bool {
	switch c {
	case CourseLessonID:
		return true
	case CourseLessonCourseID:
		return true
	case CourseLessonSessionNumber:
		return true
	case CourseLessonTitle:
		return true
	case CourseLessonUnit:
		return true
	case CourseLessonPages:
		return true
	case CourseLessonObjectives:
		return true
	case CourseLessonCreateat:
		return true
	case CourseLessonUpdateat:
		return true
	default:
		return false
	}
}

type CourseColumn string

const (
	CourseID                 CourseColumn = "courses.id"
	CourseName               CourseColumn = "courses.name"
	CourseCode               CourseColumn = "courses.code"
	CourseLevel              CourseColumn = "courses.level"
	CourseAgeRange           CourseColumn = "courses.age_range"
	CourseTotalSessions      CourseColumn = "courses.total_sessions"
	CourseDurationPerSession CourseColumn = "courses.duration_per_session"
	CourseFee                CourseColumn = "courses.fee"
	CourseDescription        CourseColumn = "courses.description"
	CourseCurriculum         CourseColumn = "courses.curriculum"
	CourseCreateat           CourseColumn = "courses.createat"
	CourseUpdateat           CourseColumn = "courses.updateat"
)

func (c CourseColumn) IsValid() bool {
	switch c {
	case CourseID:
		return true
	case CourseName:
		return true
	case CourseCode:
		return true
	case CourseLevel:
		return true
	case CourseAgeRange:
		return true
	case CourseTotalSessions:
		return true
	case CourseDurationPerSession:
		return true
	case CourseFee:
		return true
	case CourseDescription:
		return true
	case CourseCurriculum:
		return true
	case CourseCreateat:
		return true
	case CourseUpdateat:
		return true
	default:
		return false
	}
}

type FeePackageColumn string

const (
	FeePackageID               FeePackageColumn = "fee_packages.id"
	FeePackageName             FeePackageColumn = "fee_packages.name"
	FeePackageTotalFee         FeePackageColumn = "fee_packages.total_fee"
	FeePackageCourseID         FeePackageColumn = "fee_packages.course_id"
	FeePackageSessionsIncluded FeePackageColumn = "fee_packages.sessions_included"
	FeePackageDiscountPercent  FeePackageColumn = "fee_packages.discount_percent"
	FeePackageIsActive         FeePackageColumn = "fee_packages.is_active"
	FeePackageCreateat         FeePackageColumn = "fee_packages.createat"
	FeePackageUpdateat         FeePackageColumn = "fee_packages.updateat"
)

func (c FeePackageColumn) IsValid() bool {
	switch c {
	case FeePackageID:
		return true
	case FeePackageName:
		return true
	case FeePackageTotalFee:
		return true
	case FeePackageCourseID:
		return true
	case FeePackageSessionsIncluded:
		return true
	case FeePackageDiscountPercent:
		return true
	case FeePackageIsActive:
		return true
	case FeePackageCreateat:
		return true
	case FeePackageUpdateat:
		return true
	default:
		return false
	}
}

type FeeRefundColumn string

const (
	FeeRefundID           FeeRefundColumn = "fee_refunds.id"
	FeeRefundTuitionID    FeeRefundColumn = "fee_refunds.tuition_id"
	FeeRefundAmount       FeeRefundColumn = "fee_refunds.amount"
	FeeRefundRefundDate   FeeRefundColumn = "fee_refunds.refund_date"
	FeeRefundReason       FeeRefundColumn = "fee_refunds.reason"
	FeeRefundStatus       FeeRefundColumn = "fee_refunds.status"
	FeeRefundApprovedByID FeeRefundColumn = "fee_refunds.approved_by_id"
	FeeRefundCreateat     FeeRefundColumn = "fee_refunds.createat"
	FeeRefundUpdateat     FeeRefundColumn = "fee_refunds.updateat"
)

func (c FeeRefundColumn) IsValid() bool {
	switch c {
	case FeeRefundID:
		return true
	case FeeRefundTuitionID:
		return true
	case FeeRefundAmount:
		return true
	case FeeRefundRefundDate:
		return true
	case FeeRefundReason:
		return true
	case FeeRefundStatus:
		return true
	case FeeRefundApprovedByID:
		return true
	case FeeRefundCreateat:
		return true
	case FeeRefundUpdateat:
		return true
	default:
		return false
	}
}

type FileinfoColumn string

const (
	FileinfoID              FileinfoColumn = "fileinfos.id"
	FileinfoCreatorid       FileinfoColumn = "fileinfos.creatorid"
	FileinfoPostid          FileinfoColumn = "fileinfos.postid"
	FileinfoCreateat        FileinfoColumn = "fileinfos.createat"
	FileinfoUpdateat        FileinfoColumn = "fileinfos.updateat"
	FileinfoDeleteat        FileinfoColumn = "fileinfos.deleteat"
	FileinfoPath            FileinfoColumn = "fileinfos.path"
	FileinfoThumbnailpath   FileinfoColumn = "fileinfos.thumbnailpath"
	FileinfoPreviewpath     FileinfoColumn = "fileinfos.previewpath"
	FileinfoName            FileinfoColumn = "fileinfos.name"
	FileinfoExtension       FileinfoColumn = "fileinfos.extension"
	FileinfoSize            FileinfoColumn = "fileinfos.size"
	FileinfoMimetype        FileinfoColumn = "fileinfos.mimetype"
	FileinfoWidth           FileinfoColumn = "fileinfos.width"
	FileinfoHeight          FileinfoColumn = "fileinfos.height"
	FileinfoHaspreviewimage FileinfoColumn = "fileinfos.haspreviewimage"
	FileinfoMinipreview     FileinfoColumn = "fileinfos.minipreview"
	FileinfoContent         FileinfoColumn = "fileinfos.content"
	FileinfoRemoteid        FileinfoColumn = "fileinfos.remoteid"
	FileinfoArchived        FileinfoColumn = "fileinfos.archived"
	FileinfoChannelid       FileinfoColumn = "fileinfos.channelid"
	FileinfoCourseID        FileinfoColumn = "fileinfos.course_id"
	FileinfoVersion         FileinfoColumn = "fileinfos.version"
	FileinfoVisibility      FileinfoColumn = "fileinfos.visibility"
)

func (c FileinfoColumn) IsValid() bool {
	switch c {
	case FileinfoID:
		return true
	case FileinfoCreatorid:
		return true
	case FileinfoPostid:
		return true
	case FileinfoCreateat:
		return true
	case FileinfoUpdateat:
		return true
	case FileinfoDeleteat:
		return true
	case FileinfoPath:
		return true
	case FileinfoThumbnailpath:
		return true
	case FileinfoPreviewpath:
		return true
	case FileinfoName:
		return true
	case FileinfoExtension:
		return true
	case FileinfoSize:
		return true
	case FileinfoMimetype:
		return true
	case FileinfoWidth:
		return true
	case FileinfoHeight:
		return true
	case FileinfoHaspreviewimage:
		return true
	case FileinfoMinipreview:
		return true
	case FileinfoContent:
		return true
	case FileinfoRemoteid:
		return true
	case FileinfoArchived:
		return true
	case FileinfoChannelid:
		return true
	case FileinfoCourseID:
		return true
	case FileinfoVersion:
		return true
	case FileinfoVisibility:
		return true
	default:
		return false
	}
}

type HomeworkColumn string

const (
	HomeworkID          HomeworkColumn = "homeworks.id"
	HomeworkTitle       HomeworkColumn = "homeworks.title"
	HomeworkDescription HomeworkColumn = "homeworks.description"
	HomeworkSessionID   HomeworkColumn = "homeworks.session_id"
	HomeworkClassID     HomeworkColumn = "homeworks.class_id"
	HomeworkCourseID    HomeworkColumn = "homeworks.course_id"
	HomeworkTeacherID   HomeworkColumn = "homeworks.teacher_id"
	HomeworkDeadline    HomeworkColumn = "homeworks.deadline"
	HomeworkCreateat    HomeworkColumn = "homeworks.createat"
	HomeworkFileID      HomeworkColumn = "homeworks.file_id"
	HomeworkUpdateat    HomeworkColumn = "homeworks.updateat"
)

func (c HomeworkColumn) IsValid() bool {
	switch c {
	case HomeworkID:
		return true
	case HomeworkTitle:
		return true
	case HomeworkDescription:
		return true
	case HomeworkSessionID:
		return true
	case HomeworkClassID:
		return true
	case HomeworkCourseID:
		return true
	case HomeworkTeacherID:
		return true
	case HomeworkDeadline:
		return true
	case HomeworkCreateat:
		return true
	case HomeworkFileID:
		return true
	case HomeworkUpdateat:
		return true
	default:
		return false
	}
}

type LeadActivityColumn string

const (
	LeadActivityID           LeadActivityColumn = "lead_activities.id"
	LeadActivityLeadID       LeadActivityColumn = "lead_activities.lead_id"
	LeadActivityType         LeadActivityColumn = "lead_activities.type"
	LeadActivityContent      LeadActivityColumn = "lead_activities.content"
	LeadActivityNextFollowUp LeadActivityColumn = "lead_activities.next_follow_up"
	LeadActivityCreateat     LeadActivityColumn = "lead_activities.createat"
	LeadActivityUpdateat     LeadActivityColumn = "lead_activities.updateat"
)

func (c LeadActivityColumn) IsValid() bool {
	switch c {
	case LeadActivityID:
		return true
	case LeadActivityLeadID:
		return true
	case LeadActivityType:
		return true
	case LeadActivityContent:
		return true
	case LeadActivityNextFollowUp:
		return true
	case LeadActivityCreateat:
		return true
	case LeadActivityUpdateat:
		return true
	default:
		return false
	}
}

type LeadColumn string

const (
	LeadID          LeadColumn = "leads.id"
	LeadName        LeadColumn = "leads.name"
	LeadEmail       LeadColumn = "leads.email"
	LeadPhone       LeadColumn = "leads.phone"
	LeadAge         LeadColumn = "leads.age"
	LeadSchool      LeadColumn = "leads.school"
	LeadSource      LeadColumn = "leads.source"
	LeadNeed        LeadColumn = "leads.need"
	LeadStatus      LeadColumn = "leads.status"
	LeadStudentID   LeadColumn = "leads.student_id"
	LeadNotes       LeadColumn = "leads.notes"
	LeadTestDate    LeadColumn = "leads.test_date"
	LeadTestResult  LeadColumn = "leads.test_result"
	LeadTestScore   LeadColumn = "leads.test_score"
	LeadCounselorID LeadColumn = "leads.counselor_id"
	LeadCreateat    LeadColumn = "leads.createat"
	LeadUpdateat    LeadColumn = "leads.updateat"
)

func (c LeadColumn) IsValid() bool {
	switch c {
	case LeadID:
		return true
	case LeadName:
		return true
	case LeadEmail:
		return true
	case LeadPhone:
		return true
	case LeadAge:
		return true
	case LeadSchool:
		return true
	case LeadSource:
		return true
	case LeadNeed:
		return true
	case LeadStatus:
		return true
	case LeadStudentID:
		return true
	case LeadNotes:
		return true
	case LeadTestDate:
		return true
	case LeadTestResult:
		return true
	case LeadTestScore:
		return true
	case LeadCounselorID:
		return true
	case LeadCreateat:
		return true
	case LeadUpdateat:
		return true
	default:
		return false
	}
}

type MaterialColumn string

const (
	MaterialID           MaterialColumn = "materials.id"
	MaterialTitle        MaterialColumn = "materials.title"
	MaterialDescription  MaterialColumn = "materials.description"
	MaterialCourseID     MaterialColumn = "materials.course_id"
	MaterialUnit         MaterialColumn = "materials.unit"
	MaterialVisibility   MaterialColumn = "materials.visibility"
	MaterialFileID       MaterialColumn = "materials.file_id"
	MaterialUploadedByID MaterialColumn = "materials.uploaded_by_id"
	MaterialVersion      MaterialColumn = "materials.version"
	MaterialCreateat     MaterialColumn = "materials.createat"
	MaterialUpdateat     MaterialColumn = "materials.updateat"
)

func (c MaterialColumn) IsValid() bool {
	switch c {
	case MaterialID:
		return true
	case MaterialTitle:
		return true
	case MaterialDescription:
		return true
	case MaterialCourseID:
		return true
	case MaterialUnit:
		return true
	case MaterialVisibility:
		return true
	case MaterialFileID:
		return true
	case MaterialUploadedByID:
		return true
	case MaterialVersion:
		return true
	case MaterialCreateat:
		return true
	case MaterialUpdateat:
		return true
	default:
		return false
	}
}

type NotificationColumn string

const (
	NotificationID       NotificationColumn = "notifications.id"
	NotificationUserID   NotificationColumn = "notifications.user_id"
	NotificationTitle    NotificationColumn = "notifications.title"
	NotificationMessage  NotificationColumn = "notifications.message"
	NotificationType     NotificationColumn = "notifications.type"
	NotificationIsRead   NotificationColumn = "notifications.is_read"
	NotificationLinkURL  NotificationColumn = "notifications.link_url"
	NotificationCreateat NotificationColumn = "notifications.createat"
	NotificationUpdateat NotificationColumn = "notifications.updateat"
)

func (c NotificationColumn) IsValid() bool {
	switch c {
	case NotificationID:
		return true
	case NotificationUserID:
		return true
	case NotificationTitle:
		return true
	case NotificationMessage:
		return true
	case NotificationType:
		return true
	case NotificationIsRead:
		return true
	case NotificationLinkURL:
		return true
	case NotificationCreateat:
		return true
	case NotificationUpdateat:
		return true
	default:
		return false
	}
}

type PaymentColumn string

const (
	PaymentID            PaymentColumn = "payments.id"
	PaymentTuitionID     PaymentColumn = "payments.tuition_id"
	PaymentAmount        PaymentColumn = "payments.amount"
	PaymentPaymentDate   PaymentColumn = "payments.payment_date"
	PaymentMethod        PaymentColumn = "payments.method"
	PaymentReceiptNumber PaymentColumn = "payments.receipt_number"
	PaymentPaidByID      PaymentColumn = "payments.paid_by_id"
	PaymentNote          PaymentColumn = "payments.note"
	PaymentCreateat      PaymentColumn = "payments.createat"
	PaymentUpdateat      PaymentColumn = "payments.updateat"
)

func (c PaymentColumn) IsValid() bool {
	switch c {
	case PaymentID:
		return true
	case PaymentTuitionID:
		return true
	case PaymentAmount:
		return true
	case PaymentPaymentDate:
		return true
	case PaymentMethod:
		return true
	case PaymentReceiptNumber:
		return true
	case PaymentPaidByID:
		return true
	case PaymentNote:
		return true
	case PaymentCreateat:
		return true
	case PaymentUpdateat:
		return true
	default:
		return false
	}
}

type PostCategoryColumn string

const (
	PostCategoryID       PostCategoryColumn = "post_categories.id"
	PostCategoryName     PostCategoryColumn = "post_categories.name"
	PostCategorySlug     PostCategoryColumn = "post_categories.slug"
	PostCategoryCreateat PostCategoryColumn = "post_categories.createat"
	PostCategoryUpdateat PostCategoryColumn = "post_categories.updateat"
)

func (c PostCategoryColumn) IsValid() bool {
	switch c {
	case PostCategoryID:
		return true
	case PostCategoryName:
		return true
	case PostCategorySlug:
		return true
	case PostCategoryCreateat:
		return true
	case PostCategoryUpdateat:
		return true
	default:
		return false
	}
}

type SubmissionColumn string

const (
	SubmissionID          SubmissionColumn = "submissions.id"
	SubmissionTitle       SubmissionColumn = "submissions.title"
	SubmissionStudentID   SubmissionColumn = "submissions.student_id"
	SubmissionHomeworkID  SubmissionColumn = "submissions.homework_id"
	SubmissionDescription SubmissionColumn = "submissions.description"
	SubmissionFileID      SubmissionColumn = "submissions.file_id"
	SubmissionFeedback    SubmissionColumn = "submissions.feedback"
	SubmissionCreateat    SubmissionColumn = "submissions.createat"
	SubmissionUpdateat    SubmissionColumn = "submissions.updateat"
)

func (c SubmissionColumn) IsValid() bool {
	switch c {
	case SubmissionID:
		return true
	case SubmissionTitle:
		return true
	case SubmissionStudentID:
		return true
	case SubmissionHomeworkID:
		return true
	case SubmissionDescription:
		return true
	case SubmissionFileID:
		return true
	case SubmissionFeedback:
		return true
	case SubmissionCreateat:
		return true
	case SubmissionUpdateat:
		return true
	default:
		return false
	}
}

type TaskColumn string

const (
	TaskID          TaskColumn = "tasks.id"
	TaskTitle       TaskColumn = "tasks.title"
	TaskDescription TaskColumn = "tasks.description"
	TaskAssigneeID  TaskColumn = "tasks.assignee_id"
	TaskCreatorID   TaskColumn = "tasks.creator_id"
	TaskDeadline    TaskColumn = "tasks.deadline"
	TaskPriority    TaskColumn = "tasks.priority"
	TaskStatus      TaskColumn = "tasks.status"
	TaskNotes       TaskColumn = "tasks.notes"
	TaskCreateat    TaskColumn = "tasks.createat"
	TaskUpdateat    TaskColumn = "tasks.updateat"
)

func (c TaskColumn) IsValid() bool {
	switch c {
	case TaskID:
		return true
	case TaskTitle:
		return true
	case TaskDescription:
		return true
	case TaskAssigneeID:
		return true
	case TaskCreatorID:
		return true
	case TaskDeadline:
		return true
	case TaskPriority:
		return true
	case TaskStatus:
		return true
	case TaskNotes:
		return true
	case TaskCreateat:
		return true
	case TaskUpdateat:
		return true
	default:
		return false
	}
}

type TuitionColumn string

const (
	TuitionID              TuitionColumn = "tuitions.id"
	TuitionStudentID       TuitionColumn = "tuitions.student_id"
	TuitionClassID         TuitionColumn = "tuitions.class_id"
	TuitionFeePackageID    TuitionColumn = "tuitions.fee_package_id"
	TuitionTotalAmount     TuitionColumn = "tuitions.total_amount"
	TuitionDiscountAmount  TuitionColumn = "tuitions.discount_amount"
	TuitionPaidAmount      TuitionColumn = "tuitions.paid_amount"
	TuitionRemainingAmount TuitionColumn = "tuitions.remaining_amount"
	TuitionStatus          TuitionColumn = "tuitions.status"
	TuitionDueDate         TuitionColumn = "tuitions.due_date"
	TuitionNote            TuitionColumn = "tuitions.note"
	TuitionPromotionalFee  TuitionColumn = "tuitions.promotional_fee"
	TuitionDiscountValue   TuitionColumn = "tuitions.discount_value"
	TuitionDiscountType    TuitionColumn = "tuitions.discount_type"
	TuitionCreateat        TuitionColumn = "tuitions.createat"
	TuitionUpdateat        TuitionColumn = "tuitions.updateat"
)

func (c TuitionColumn) IsValid() bool {
	switch c {
	case TuitionID:
		return true
	case TuitionStudentID:
		return true
	case TuitionClassID:
		return true
	case TuitionFeePackageID:
		return true
	case TuitionTotalAmount:
		return true
	case TuitionDiscountAmount:
		return true
	case TuitionPaidAmount:
		return true
	case TuitionRemainingAmount:
		return true
	case TuitionStatus:
		return true
	case TuitionDueDate:
		return true
	case TuitionNote:
		return true
	case TuitionPromotionalFee:
		return true
	case TuitionDiscountValue:
		return true
	case TuitionDiscountType:
		return true
	case TuitionCreateat:
		return true
	case TuitionUpdateat:
		return true
	default:
		return false
	}
}

type WeeklyReviewColumn string

const (
	WeeklyReviewID         WeeklyReviewColumn = "weekly_reviews.id"
	WeeklyReviewStudentID  WeeklyReviewColumn = "weekly_reviews.student_id"
	WeeklyReviewClassID    WeeklyReviewColumn = "weekly_reviews.class_id"
	WeeklyReviewWeekNumber WeeklyReviewColumn = "weekly_reviews.week_number"
	WeeklyReviewContent    WeeklyReviewColumn = "weekly_reviews.content"
	WeeklyReviewRating     WeeklyReviewColumn = "weekly_reviews.rating"
	WeeklyReviewCreatedBy  WeeklyReviewColumn = "weekly_reviews.created_by"
	WeeklyReviewCreateat   WeeklyReviewColumn = "weekly_reviews.createat"
	WeeklyReviewUpdateat   WeeklyReviewColumn = "weekly_reviews.updateat"
)

func (c WeeklyReviewColumn) IsValid() bool {
	switch c {
	case WeeklyReviewID:
		return true
	case WeeklyReviewStudentID:
		return true
	case WeeklyReviewClassID:
		return true
	case WeeklyReviewWeekNumber:
		return true
	case WeeklyReviewContent:
		return true
	case WeeklyReviewRating:
		return true
	case WeeklyReviewCreatedBy:
		return true
	case WeeklyReviewCreateat:
		return true
	case WeeklyReviewUpdateat:
		return true
	default:
		return false
	}
}

type ColumnValidator interface {
	IsValid() bool
}
