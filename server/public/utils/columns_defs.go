// Code automatically generated;
// DO NOT EDIT

package utils

type UserColumn string

const (
	UserID                 UserColumn = "id"
	UserCreateat           UserColumn = "createat"
	UserUpdateat           UserColumn = "updateat"
	UserDeleteat           UserColumn = "deleteat"
	UserUsername           UserColumn = "username"
	UserPassword           UserColumn = "password"
	UserAuthdata           UserColumn = "authdata"
	UserAuthservice        UserColumn = "authservice"
	UserEmail              UserColumn = "email"
	UserEmailverified      UserColumn = "emailverified"
	UserNickname           UserColumn = "nickname"
	UserFirstname          UserColumn = "firstname"
	UserLastname           UserColumn = "lastname"
	UserRoles              UserColumn = "roles"
	UserAllowmarketing     UserColumn = "allowmarketing"
	UserProps              UserColumn = "props"
	UserNotifyprops        UserColumn = "notifyprops"
	UserLastpasswordupdate UserColumn = "lastpasswordupdate"
	UserLastpictureupdate  UserColumn = "lastpictureupdate"
	UserFailedattempts     UserColumn = "failedattempts"
	UserLocale             UserColumn = "locale"
	UserMfaactive          UserColumn = "mfaactive"
	UserMfasecret          UserColumn = "mfasecret"
	UserPosition           UserColumn = "position"
	UserTimezone           UserColumn = "timezone"
	UserRemoteid           UserColumn = "remoteid"
	UserLastlogin          UserColumn = "lastlogin"
	UserMfausedtimestamps  UserColumn = "mfausedtimestamps"
	UserPhone              UserColumn = "phone"
	UserParentID           UserColumn = "parent_id"
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

type ChannelColumn string

const (
	ChannelId                  ChannelColumn = "id"
	ChannelCreateAt            ChannelColumn = "create_at"
	ChannelUpdateAt            ChannelColumn = "update_at"
	ChannelDeleteAt            ChannelColumn = "delete_at"
	ChannelTeamId              ChannelColumn = "team_id"
	ChannelType                ChannelColumn = "type"
	ChannelDisplayName         ChannelColumn = "display_name"
	ChannelName                ChannelColumn = "name"
	ChannelHeader              ChannelColumn = "header"
	ChannelPurpose             ChannelColumn = "purpose"
	ChannelLastPostAt          ChannelColumn = "last_post_at"
	ChannelTotalMsgCount       ChannelColumn = "total_msg_count"
	ChannelExtraUpdateAt       ChannelColumn = "extra_update_at"
	ChannelCreatorId           ChannelColumn = "creator_id"
	ChannelSchemeId            ChannelColumn = "scheme_id"
	ChannelProps               ChannelColumn = "props"
	ChannelGroupConstrained    ChannelColumn = "group_constrained"
	ChannelAutoTranslation     ChannelColumn = "autotranslation"
	ChannelShared              ChannelColumn = "shared"
	ChannelTotalMsgCountRoot   ChannelColumn = "total_msg_count_root"
	ChannelPolicyID            ChannelColumn = "policy_id"
	ChannelLastRootPostAt      ChannelColumn = "last_root_post_at"
	ChannelBannerInfo          ChannelColumn = "banner_info"
	ChannelPolicyEnforced      ChannelColumn = "policy_enforced"
	ChannelPolicyIsActive      ChannelColumn = "policy_is_active"
	ChannelDefaultCategoryName ChannelColumn = "default_category_name"
)

func (c ChannelColumn) IsValid() bool {
	switch c {
	case ChannelId:
		return true
	case ChannelCreateAt:
		return true
	case ChannelUpdateAt:
		return true
	case ChannelDeleteAt:
		return true
	case ChannelTeamId:
		return true
	case ChannelType:
		return true
	case ChannelDisplayName:
		return true
	case ChannelName:
		return true
	case ChannelHeader:
		return true
	case ChannelPurpose:
		return true
	case ChannelLastPostAt:
		return true
	case ChannelTotalMsgCount:
		return true
	case ChannelExtraUpdateAt:
		return true
	case ChannelCreatorId:
		return true
	case ChannelSchemeId:
		return true
	case ChannelProps:
		return true
	case ChannelGroupConstrained:
		return true
	case ChannelAutoTranslation:
		return true
	case ChannelShared:
		return true
	case ChannelTotalMsgCountRoot:
		return true
	case ChannelPolicyID:
		return true
	case ChannelLastRootPostAt:
		return true
	case ChannelBannerInfo:
		return true
	case ChannelPolicyEnforced:
		return true
	case ChannelPolicyIsActive:
		return true
	case ChannelDefaultCategoryName:
		return true
	default:
		return false
	}
}

type PostColumn string

const (
	PostId            PostColumn = "id"
	PostCreateAt      PostColumn = "create_at"
	PostUpdateAt      PostColumn = "update_at"
	PostEditAt        PostColumn = "edit_at"
	PostDeleteAt      PostColumn = "delete_at"
	PostIsPinned      PostColumn = "is_pinned"
	PostUserId        PostColumn = "user_id"
	PostChannelId     PostColumn = "channel_id"
	PostRootId        PostColumn = "root_id"
	PostOriginalId    PostColumn = "original_id"
	PostMessage       PostColumn = "message"
	PostMessageSource PostColumn = "message_source"
	PostType          PostColumn = "type"
	PostProps         PostColumn = "props"
	PostHashtags      PostColumn = "hashtags"
	PostFileIds       PostColumn = "file_ids"
	PostPendingPostId PostColumn = "pending_post_id"
	PostHasReactions  PostColumn = "has_reactions"
	PostRemoteId      PostColumn = "remote_id"
	PostReplyCount    PostColumn = "reply_count"
	PostLastReplyAt   PostColumn = "last_reply_at"
	PostParticipants  PostColumn = "participants"
	PostIsFollowing   PostColumn = "is_following"
	PostMetadata      PostColumn = "metadata"
)

func (c PostColumn) IsValid() bool {
	switch c {
	case PostId:
		return true
	case PostCreateAt:
		return true
	case PostUpdateAt:
		return true
	case PostEditAt:
		return true
	case PostDeleteAt:
		return true
	case PostIsPinned:
		return true
	case PostUserId:
		return true
	case PostChannelId:
		return true
	case PostRootId:
		return true
	case PostOriginalId:
		return true
	case PostMessage:
		return true
	case PostMessageSource:
		return true
	case PostType:
		return true
	case PostProps:
		return true
	case PostHashtags:
		return true
	case PostFileIds:
		return true
	case PostPendingPostId:
		return true
	case PostHasReactions:
		return true
	case PostRemoteId:
		return true
	case PostReplyCount:
		return true
	case PostLastReplyAt:
		return true
	case PostParticipants:
		return true
	case PostIsFollowing:
		return true
	case PostMetadata:
		return true
	default:
		return false
	}
}

type ThreadColumn string

const (
	ThreadPostId       ThreadColumn = "id"
	ThreadChannelId    ThreadColumn = "channel_id"
	ThreadReplyCount   ThreadColumn = "reply_count"
	ThreadLastReplyAt  ThreadColumn = "last_reply_at"
	ThreadParticipants ThreadColumn = "participants"
	ThreadDeleteAt     ThreadColumn = "delete_at"
	ThreadTeamId       ThreadColumn = "team_id"
)

func (c ThreadColumn) IsValid() bool {
	switch c {
	case ThreadPostId:
		return true
	case ThreadChannelId:
		return true
	case ThreadReplyCount:
		return true
	case ThreadLastReplyAt:
		return true
	case ThreadParticipants:
		return true
	case ThreadDeleteAt:
		return true
	case ThreadTeamId:
		return true
	default:
		return false
	}
}

type StatusColumn string

const (
	StatusUserId         StatusColumn = "user_id"
	StatusStatus         StatusColumn = "status"
	StatusManual         StatusColumn = "manual"
	StatusLastActivityAt StatusColumn = "last_activity_at"
	StatusActiveChannel  StatusColumn = "active_channel"
	StatusDNDEndTime     StatusColumn = "dnd_end_time"
)

func (c StatusColumn) IsValid() bool {
	switch c {
	case StatusUserId:
		return true
	case StatusStatus:
		return true
	case StatusManual:
		return true
	case StatusLastActivityAt:
		return true
	case StatusActiveChannel:
		return true
	case StatusDNDEndTime:
		return true
	default:
		return false
	}
}

type SessionColumn string

const (
	SessionId             SessionColumn = "id"
	SessionToken          SessionColumn = "token"
	SessionCreateAt       SessionColumn = "create_at"
	SessionExpiresAt      SessionColumn = "expires_at"
	SessionLastActivityAt SessionColumn = "last_activity_at"
	SessionUserId         SessionColumn = "user_id"
	SessionDeviceId       SessionColumn = "device_id"
	SessionRoles          SessionColumn = "roles"
	SessionIsOAuth        SessionColumn = "is_oauth"
	SessionExpiredNotify  SessionColumn = "expired_notify"
	SessionProps          SessionColumn = "props"
	SessionTeamMembers    SessionColumn = "team_members"
	SessionLocal          SessionColumn = "local"
)

func (c SessionColumn) IsValid() bool {
	switch c {
	case SessionId:
		return true
	case SessionToken:
		return true
	case SessionCreateAt:
		return true
	case SessionExpiresAt:
		return true
	case SessionLastActivityAt:
		return true
	case SessionUserId:
		return true
	case SessionDeviceId:
		return true
	case SessionRoles:
		return true
	case SessionIsOAuth:
		return true
	case SessionExpiredNotify:
		return true
	case SessionProps:
		return true
	case SessionTeamMembers:
		return true
	case SessionLocal:
		return true
	default:
		return false
	}
}

type RoleColumn string

const (
	RoleId            RoleColumn = "id"
	RoleName          RoleColumn = "name"
	RoleDisplayName   RoleColumn = "display_name"
	RoleDescription   RoleColumn = "description"
	RoleCreateAt      RoleColumn = "create_at"
	RoleUpdateAt      RoleColumn = "update_at"
	RoleDeleteAt      RoleColumn = "delete_at"
	RolePermissions   RoleColumn = "permissions"
	RoleSchemeManaged RoleColumn = "scheme_managed"
	RoleBuiltIn       RoleColumn = "built_in"
)

func (c RoleColumn) IsValid() bool {
	switch c {
	case RoleId:
		return true
	case RoleName:
		return true
	case RoleDisplayName:
		return true
	case RoleDescription:
		return true
	case RoleCreateAt:
		return true
	case RoleUpdateAt:
		return true
	case RoleDeleteAt:
		return true
	case RolePermissions:
		return true
	case RoleSchemeManaged:
		return true
	case RoleBuiltIn:
		return true
	default:
		return false
	}
}

type ReactionColumn string

const (
	ReactionUserId    ReactionColumn = "user_id"
	ReactionPostId    ReactionColumn = "post_id"
	ReactionEmojiName ReactionColumn = "emoji_name"
	ReactionCreateAt  ReactionColumn = "create_at"
	ReactionUpdateAt  ReactionColumn = "update_at"
	ReactionDeleteAt  ReactionColumn = "delete_at"
	ReactionRemoteId  ReactionColumn = "remote_id"
	ReactionChannelId ReactionColumn = "channel_id"
)

func (c ReactionColumn) IsValid() bool {
	switch c {
	case ReactionUserId:
		return true
	case ReactionPostId:
		return true
	case ReactionEmojiName:
		return true
	case ReactionCreateAt:
		return true
	case ReactionUpdateAt:
		return true
	case ReactionDeleteAt:
		return true
	case ReactionRemoteId:
		return true
	case ReactionChannelId:
		return true
	default:
		return false
	}
}

type JobColumn string

const (
	JobId             JobColumn = "id"
	JobType           JobColumn = "type"
	JobPriority       JobColumn = "priority"
	JobCreateAt       JobColumn = "create_at"
	JobStartAt        JobColumn = "start_at"
	JobLastActivityAt JobColumn = "last_activity_at"
	JobStatus         JobColumn = "status"
	JobProgress       JobColumn = "progress"
	JobData           JobColumn = "data"
)

func (c JobColumn) IsValid() bool {
	switch c {
	case JobId:
		return true
	case JobType:
		return true
	case JobPriority:
		return true
	case JobCreateAt:
		return true
	case JobStartAt:
		return true
	case JobLastActivityAt:
		return true
	case JobStatus:
		return true
	case JobProgress:
		return true
	case JobData:
		return true
	default:
		return false
	}
}

type LMSSessionColumn string

const (
	LMSSessionID        LMSSessionColumn = "id"
	LMSSessionTitle     LMSSessionColumn = "title"
	LMSSessionClassID   LMSSessionColumn = "class_id"
	LMSSessionStartTime LMSSessionColumn = "start_time"
	LMSSessionEndTime   LMSSessionColumn = "end_time"
	LMSSessionRoom      LMSSessionColumn = "room"
	LMSSessionTeacherID LMSSessionColumn = "teacher_id"
	LMSSessionLessonID  LMSSessionColumn = "lesson_id"
	LMSSessionStatus    LMSSessionColumn = "status"
	LMSSessionDate      LMSSessionColumn = "date"
	LMSSessionCreateat  LMSSessionColumn = "createat"
	LMSSessionUpdateat  LMSSessionColumn = "updateat"
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
	ClassID        ClassColumn = "id"
	ClassCourseID  ClassColumn = "course_id"
	ClassBranchID  ClassColumn = "branch_id"
	ClassName      ClassColumn = "name"
	ClassCode      ClassColumn = "code"
	ClassTeacherID ClassColumn = "teacher_id"
	ClassStatus    ClassColumn = "status"
	ClassRoom      ClassColumn = "room"
	ClassStartDate ClassColumn = "start_date"
	ClassCreateat  ClassColumn = "createat"
	ClassUpdateat  ClassColumn = "updateat"
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
	StudentClassID           StudentClassColumn = "id"
	StudentClassStudentID    StudentClassColumn = "student_id"
	StudentClassClassID      StudentClassColumn = "class_id"
	StudentClassEnrollmentAt StudentClassColumn = "enrollment_at"
	StudentClassStatus       StudentClassColumn = "status"
	StudentClassCreateat     StudentClassColumn = "createat"
	StudentClassUpdateat     StudentClassColumn = "updateat"
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
	BranchID       BranchColumn = "id"
	BranchName     BranchColumn = "name"
	BranchAddress  BranchColumn = "address"
	BranchPhone    BranchColumn = "phone"
	BranchCreateat BranchColumn = "createat"
	BranchUpdateat BranchColumn = "updateat"
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
	AttendanceID        AttendanceColumn = "id"
	AttendanceSessionID AttendanceColumn = "session_id"
	AttendanceStudentID AttendanceColumn = "student_id"
	AttendanceStatus    AttendanceColumn = "status"
	AttendanceNote      AttendanceColumn = "note"
	AttendanceLocked    AttendanceColumn = "locked"
	AttendanceCreateat  AttendanceColumn = "createat"
	AttendanceUpdateat  AttendanceColumn = "updateat"
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
	AdditionalFeeID        AdditionalFeeColumn = "id"
	AdditionalFeeTuitionID AdditionalFeeColumn = "tuition_id"
	AdditionalFeeLabel     AdditionalFeeColumn = "label"
	AdditionalFeeAmount    AdditionalFeeColumn = "amount"
	AdditionalFeeCreateat  AdditionalFeeColumn = "createat"
	AdditionalFeeUpdateat  AdditionalFeeColumn = "updateat"
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
	BannerID       BannerColumn = "id"
	BannerTitle    BannerColumn = "title"
	BannerImageURL BannerColumn = "image_url"
	BannerLinkURL  BannerColumn = "link_url"
	BannerPosition BannerColumn = "position"
	BannerIsActive BannerColumn = "is_active"
	BannerCreateat BannerColumn = "createat"
	BannerUpdateat BannerColumn = "updateat"
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
	BlogPostID             BlogPostColumn = "id"
	BlogPostTitle          BlogPostColumn = "title"
	BlogPostSlug           BlogPostColumn = "slug"
	BlogPostContent        BlogPostColumn = "content"
	BlogPostExcerpt        BlogPostColumn = "excerpt"
	BlogPostCategoryID     BlogPostColumn = "category_id"
	BlogPostAuthorID       BlogPostColumn = "author_id"
	BlogPostStatus         BlogPostColumn = "status"
	BlogPostSeoTitle       BlogPostColumn = "seo_title"
	BlogPostSeoDescription BlogPostColumn = "seo_description"
	BlogPostSeoKeywords    BlogPostColumn = "seo_keywords"
	BlogPostPublishedAt    BlogPostColumn = "published_at"
	BlogPostCreateat       BlogPostColumn = "createat"
	BlogPostUpdateat       BlogPostColumn = "updateat"
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
	ClassMediumID           ClassMediumColumn = "id"
	ClassMediumClassID      ClassMediumColumn = "class_id"
	ClassMediumSessionID    ClassMediumColumn = "session_id"
	ClassMediumTitle        ClassMediumColumn = "title"
	ClassMediumFileURL      ClassMediumColumn = "file_url"
	ClassMediumFileType     ClassMediumColumn = "file_type"
	ClassMediumUploadedByID ClassMediumColumn = "uploaded_by_id"
	ClassMediumFileID       ClassMediumColumn = "file_id"
	ClassMediumCreateat     ClassMediumColumn = "createat"
	ClassMediumUpdateat     ClassMediumColumn = "updateat"
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
	CourseLessonID            CourseLessonColumn = "id"
	CourseLessonCourseID      CourseLessonColumn = "course_id"
	CourseLessonSessionNumber CourseLessonColumn = "session_number"
	CourseLessonTitle         CourseLessonColumn = "title"
	CourseLessonUnit          CourseLessonColumn = "unit"
	CourseLessonPages         CourseLessonColumn = "pages"
	CourseLessonObjectives    CourseLessonColumn = "objectives"
	CourseLessonCreateat      CourseLessonColumn = "createat"
	CourseLessonUpdateat      CourseLessonColumn = "updateat"
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
	CourseID                 CourseColumn = "id"
	CourseName               CourseColumn = "name"
	CourseCode               CourseColumn = "code"
	CourseLevel              CourseColumn = "level"
	CourseAgeRange           CourseColumn = "age_range"
	CourseTotalSessions      CourseColumn = "total_sessions"
	CourseDurationPerSession CourseColumn = "duration_per_session"
	CourseFee                CourseColumn = "fee"
	CourseDescription        CourseColumn = "description"
	CourseCurriculum         CourseColumn = "curriculum"
	CourseCreateat           CourseColumn = "createat"
	CourseUpdateat           CourseColumn = "updateat"
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
	FeePackageID               FeePackageColumn = "id"
	FeePackageName             FeePackageColumn = "name"
	FeePackageTotalFee         FeePackageColumn = "total_fee"
	FeePackageCourseID         FeePackageColumn = "course_id"
	FeePackageSessionsIncluded FeePackageColumn = "sessions_included"
	FeePackageDiscountPercent  FeePackageColumn = "discount_percent"
	FeePackageIsActive         FeePackageColumn = "is_active"
	FeePackageCreateat         FeePackageColumn = "createat"
	FeePackageUpdateat         FeePackageColumn = "updateat"
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
	FeeRefundID           FeeRefundColumn = "id"
	FeeRefundTuitionID    FeeRefundColumn = "tuition_id"
	FeeRefundAmount       FeeRefundColumn = "amount"
	FeeRefundRefundDate   FeeRefundColumn = "refund_date"
	FeeRefundReason       FeeRefundColumn = "reason"
	FeeRefundStatus       FeeRefundColumn = "status"
	FeeRefundApprovedByID FeeRefundColumn = "approved_by_id"
	FeeRefundCreateat     FeeRefundColumn = "createat"
	FeeRefundUpdateat     FeeRefundColumn = "updateat"
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
	FileinfoID              FileinfoColumn = "id"
	FileinfoCreatorid       FileinfoColumn = "creatorid"
	FileinfoPostid          FileinfoColumn = "postid"
	FileinfoCreateat        FileinfoColumn = "createat"
	FileinfoUpdateat        FileinfoColumn = "updateat"
	FileinfoDeleteat        FileinfoColumn = "deleteat"
	FileinfoPath            FileinfoColumn = "path"
	FileinfoThumbnailpath   FileinfoColumn = "thumbnailpath"
	FileinfoPreviewpath     FileinfoColumn = "previewpath"
	FileinfoName            FileinfoColumn = "name"
	FileinfoExtension       FileinfoColumn = "extension"
	FileinfoSize            FileinfoColumn = "size"
	FileinfoMimetype        FileinfoColumn = "mimetype"
	FileinfoWidth           FileinfoColumn = "width"
	FileinfoHeight          FileinfoColumn = "height"
	FileinfoHaspreviewimage FileinfoColumn = "haspreviewimage"
	FileinfoMinipreview     FileinfoColumn = "minipreview"
	FileinfoContent         FileinfoColumn = "content"
	FileinfoRemoteid        FileinfoColumn = "remoteid"
	FileinfoArchived        FileinfoColumn = "archived"
	FileinfoChannelid       FileinfoColumn = "channelid"
	FileinfoCourseID        FileinfoColumn = "course_id"
	FileinfoVersion         FileinfoColumn = "version"
	FileinfoVisibility      FileinfoColumn = "visibility"
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
	HomeworkID          HomeworkColumn = "id"
	HomeworkTitle       HomeworkColumn = "title"
	HomeworkDescription HomeworkColumn = "description"
	HomeworkSessionID   HomeworkColumn = "session_id"
	HomeworkClassID     HomeworkColumn = "class_id"
	HomeworkCourseID    HomeworkColumn = "course_id"
	HomeworkTeacherID   HomeworkColumn = "teacher_id"
	HomeworkDeadline    HomeworkColumn = "deadline"
	HomeworkCreateat    HomeworkColumn = "createat"
	HomeworkFileID      HomeworkColumn = "file_id"
	HomeworkUpdateat    HomeworkColumn = "updateat"
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
	LeadActivityID           LeadActivityColumn = "id"
	LeadActivityLeadID       LeadActivityColumn = "lead_id"
	LeadActivityType         LeadActivityColumn = "type"
	LeadActivityContent      LeadActivityColumn = "content"
	LeadActivityNextFollowUp LeadActivityColumn = "next_follow_up"
	LeadActivityCreateat     LeadActivityColumn = "createat"
	LeadActivityUpdateat     LeadActivityColumn = "updateat"
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
	LeadID          LeadColumn = "id"
	LeadName        LeadColumn = "name"
	LeadEmail       LeadColumn = "email"
	LeadPhone       LeadColumn = "phone"
	LeadAge         LeadColumn = "age"
	LeadSchool      LeadColumn = "school"
	LeadSource      LeadColumn = "source"
	LeadNeed        LeadColumn = "need"
	LeadStatus      LeadColumn = "status"
	LeadStudentID   LeadColumn = "student_id"
	LeadNotes       LeadColumn = "notes"
	LeadTestDate    LeadColumn = "test_date"
	LeadTestResult  LeadColumn = "test_result"
	LeadTestScore   LeadColumn = "test_score"
	LeadCounselorID LeadColumn = "counselor_id"
	LeadCreateat    LeadColumn = "createat"
	LeadUpdateat    LeadColumn = "updateat"
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
	MaterialID           MaterialColumn = "id"
	MaterialTitle        MaterialColumn = "title"
	MaterialDescription  MaterialColumn = "description"
	MaterialCourseID     MaterialColumn = "course_id"
	MaterialUnit         MaterialColumn = "unit"
	MaterialVisibility   MaterialColumn = "visibility"
	MaterialFileID       MaterialColumn = "file_id"
	MaterialUploadedByID MaterialColumn = "uploaded_by_id"
	MaterialVersion      MaterialColumn = "version"
	MaterialCreateat     MaterialColumn = "createat"
	MaterialUpdateat     MaterialColumn = "updateat"
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
	NotificationID       NotificationColumn = "id"
	NotificationUserID   NotificationColumn = "user_id"
	NotificationTitle    NotificationColumn = "title"
	NotificationMessage  NotificationColumn = "message"
	NotificationType     NotificationColumn = "type"
	NotificationIsRead   NotificationColumn = "is_read"
	NotificationLinkURL  NotificationColumn = "link_url"
	NotificationCreateat NotificationColumn = "createat"
	NotificationUpdateat NotificationColumn = "updateat"
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
	PaymentID            PaymentColumn = "id"
	PaymentTuitionID     PaymentColumn = "tuition_id"
	PaymentAmount        PaymentColumn = "amount"
	PaymentPaymentDate   PaymentColumn = "payment_date"
	PaymentMethod        PaymentColumn = "method"
	PaymentReceiptNumber PaymentColumn = "receipt_number"
	PaymentPaidByID      PaymentColumn = "paid_by_id"
	PaymentNote          PaymentColumn = "note"
	PaymentCreateat      PaymentColumn = "createat"
	PaymentUpdateat      PaymentColumn = "updateat"
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
	PostCategoryID       PostCategoryColumn = "id"
	PostCategoryName     PostCategoryColumn = "name"
	PostCategorySlug     PostCategoryColumn = "slug"
	PostCategoryCreateat PostCategoryColumn = "createat"
	PostCategoryUpdateat PostCategoryColumn = "updateat"
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
	SubmissionID          SubmissionColumn = "id"
	SubmissionTitle       SubmissionColumn = "title"
	SubmissionStudentID   SubmissionColumn = "student_id"
	SubmissionHomeworkID  SubmissionColumn = "homework_id"
	SubmissionDescription SubmissionColumn = "description"
	SubmissionFileID      SubmissionColumn = "file_id"
	SubmissionFeedback    SubmissionColumn = "feedback"
	SubmissionCreateat    SubmissionColumn = "createat"
	SubmissionUpdateat    SubmissionColumn = "updateat"
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
	TaskID          TaskColumn = "id"
	TaskTitle       TaskColumn = "title"
	TaskDescription TaskColumn = "description"
	TaskAssigneeID  TaskColumn = "assignee_id"
	TaskCreatorID   TaskColumn = "creator_id"
	TaskDeadline    TaskColumn = "deadline"
	TaskPriority    TaskColumn = "priority"
	TaskStatus      TaskColumn = "status"
	TaskNotes       TaskColumn = "notes"
	TaskCreateat    TaskColumn = "createat"
	TaskUpdateat    TaskColumn = "updateat"
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
	TuitionID              TuitionColumn = "id"
	TuitionStudentID       TuitionColumn = "student_id"
	TuitionClassID         TuitionColumn = "class_id"
	TuitionFeePackageID    TuitionColumn = "fee_package_id"
	TuitionTotalAmount     TuitionColumn = "total_amount"
	TuitionDiscountAmount  TuitionColumn = "discount_amount"
	TuitionPaidAmount      TuitionColumn = "paid_amount"
	TuitionRemainingAmount TuitionColumn = "remaining_amount"
	TuitionStatus          TuitionColumn = "status"
	TuitionDueDate         TuitionColumn = "due_date"
	TuitionNote            TuitionColumn = "note"
	TuitionPromotionalFee  TuitionColumn = "promotional_fee"
	TuitionDiscountValue   TuitionColumn = "discount_value"
	TuitionDiscountType    TuitionColumn = "discount_type"
	TuitionCreateat        TuitionColumn = "createat"
	TuitionUpdateat        TuitionColumn = "updateat"
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
	WeeklyReviewID         WeeklyReviewColumn = "id"
	WeeklyReviewStudentID  WeeklyReviewColumn = "student_id"
	WeeklyReviewClassID    WeeklyReviewColumn = "class_id"
	WeeklyReviewWeekNumber WeeklyReviewColumn = "week_number"
	WeeklyReviewContent    WeeklyReviewColumn = "content"
	WeeklyReviewRating     WeeklyReviewColumn = "rating"
	WeeklyReviewCreatedBy  WeeklyReviewColumn = "created_by"
	WeeklyReviewCreateat   WeeklyReviewColumn = "createat"
	WeeklyReviewUpdateat   WeeklyReviewColumn = "updateat"
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
