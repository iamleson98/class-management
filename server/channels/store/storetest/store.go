package storetest

import (
	"database/sql"
	"time"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/stretchr/testify/mock"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/iamleson98/sitename/server/v8/channels/store/storetest/mocks"
)

// Store can be used to provide mock stores for testing.
type Store struct {
	TeamStore                       mocks.TeamStore
	ChannelStore                    mocks.ChannelStore
	PostStore                       mocks.PostStore
	UserStore                       mocks.UserStore
	RetentionPolicyStore            mocks.RetentionPolicyStore
	BotStore                        mocks.BotStore
	AuditStore                      mocks.AuditStore
	ClusterDiscoveryStore           mocks.ClusterDiscoveryStore
	RemoteClusterStore              mocks.RemoteClusterStore
	ComplianceStore                 mocks.ComplianceStore
	SessionStore                    mocks.SessionStore
	OAuthStore                      mocks.OAuthStore
	OutgoingOAuthConnectionStore    mocks.OutgoingOAuthConnectionStore
	SystemStore                     mocks.SystemStore
	WebhookStore                    mocks.WebhookStore
	CommandStore                    mocks.CommandStore
	CommandWebhookStore             mocks.CommandWebhookStore
	PreferenceStore                 mocks.PreferenceStore
	TokenStore                      mocks.TokenStore
	EmojiStore                      mocks.EmojiStore
	ThreadStore                     mocks.ThreadStore
	StatusStore                     mocks.StatusStore
	FileInfoStore                   mocks.FileInfoStore
	UploadSessionStore              mocks.UploadSessionStore
	ReactionStore                   mocks.ReactionStore
	JobStore                        mocks.JobStore
	UserAccessTokenStore            mocks.UserAccessTokenStore
	PluginStore                     mocks.PluginStore
	ChannelMemberHistoryStore       mocks.ChannelMemberHistoryStore
	RoleStore                       mocks.RoleStore
	SchemeStore                     mocks.SchemeStore
	TermsOfServiceStore             mocks.TermsOfServiceStore
	GroupStore                      mocks.GroupStore
	UserTermsOfServiceStore         mocks.UserTermsOfServiceStore
	LinkMetadataStore               mocks.LinkMetadataStore
	SharedChannelStore              mocks.SharedChannelStore
	ProductNoticesStore             mocks.ProductNoticesStore
	DraftStore                      mocks.DraftStore
	logger                          mlog.LoggerIFace
	NotifyAdminStore                mocks.NotifyAdminStore
	PostPriorityStore               mocks.PostPriorityStore
	PostAcknowledgementStore        mocks.PostAcknowledgementStore
	PostPersistentNotificationStore mocks.PostPersistentNotificationStore
	DesktopTokensStore              mocks.DesktopTokensStore
	ChannelBookmarkStore            mocks.ChannelBookmarkStore
	ScheduledPostStore              mocks.ScheduledPostStore
	PropertyGroupStore              mocks.PropertyGroupStore
	PropertyFieldStore              mocks.PropertyFieldStore
	PropertyValueStore              mocks.PropertyValueStore
	AccessControlPolicyStore        mocks.AccessControlPolicyStore
	AttributesStore                 mocks.AttributesStore
	AutoTranslationStore            mocks.AutoTranslationStore
	ContentFlaggingStore            mocks.ContentFlaggingStore
	RecapStore                      mocks.RecapStore
	ReadReceiptStore                mocks.ReadReceiptStore
	TemporaryPostStore              mocks.TemporaryPostStore
	// LMS stores
	BranchStore        mocks.BranchStore
	CourseStore        mocks.CourseStore
	CourseLessonStore  mocks.CourseLessonStore
	ClassStore         mocks.ClassStore
	StudentClassStore  mocks.StudentClassStore
	LMSSessionStore    mocks.LMSSessionStore
	AttendanceStore    mocks.AttendanceStore
	LeadStore          mocks.LeadStore
	LeadActivityStore  mocks.LeadActivityStore
	FeePackageStore    mocks.FeePackageStore
	TuitionStore       mocks.TuitionStore
	PaymentStore       mocks.PaymentStore
	FeeRefundStore     mocks.FeeRefundStore
	AdditionalFeeStore mocks.AdditionalFeeStore
	PostCategoryStore  mocks.PostCategoryStore
	BlogPostStore      mocks.BlogPostStore
	WeeklyReviewStore  mocks.WeeklyReviewStore
	HomeworkStore      mocks.HomeworkStore
	SubmissionStore    mocks.SubmissionStore
	ClassMediaStore    mocks.ClassMediaStore
	TaskStore          mocks.TaskStore
	BannerStore        mocks.BannerStore
	NotificationStore  mocks.NotificationStore
	MaterialStore      mocks.MaterialStore
	DashboardStore     mocks.DashboardStore
	// Calls stores
	CallStore         mocks.CallStore
	CallSessionStore  mocks.CallSessionStore
	CallJobStore      mocks.CallJobStore
	CallStatStore     mocks.CallStatStore
	CallsChannelStore mocks.CallsChannelStore
}

func (s *Store) Logger() mlog.LoggerIFace                      { return s.logger }
func (s *Store) Team() store.TeamStore                         { return &s.TeamStore }
func (s *Store) Channel() store.ChannelStore                   { return &s.ChannelStore }
func (s *Store) Post() store.PostStore                         { return &s.PostStore }
func (s *Store) User() store.UserStore                         { return &s.UserStore }
func (s *Store) RetentionPolicy() store.RetentionPolicyStore   { return &s.RetentionPolicyStore }
func (s *Store) Bot() store.BotStore                           { return &s.BotStore }
func (s *Store) ProductNotices() store.ProductNoticesStore     { return &s.ProductNoticesStore }
func (s *Store) Audit() store.AuditStore                       { return &s.AuditStore }
func (s *Store) ClusterDiscovery() store.ClusterDiscoveryStore { return &s.ClusterDiscoveryStore }
func (s *Store) RemoteCluster() store.RemoteClusterStore       { return &s.RemoteClusterStore }
func (s *Store) Compliance() store.ComplianceStore             { return &s.ComplianceStore }
func (s *Store) Session() store.SessionStore                   { return &s.SessionStore }
func (s *Store) OAuth() store.OAuthStore                       { return &s.OAuthStore }
func (s *Store) OutgoingOAuthConnection() store.OutgoingOAuthConnectionStore {
	return &s.OutgoingOAuthConnectionStore
}
func (s *Store) System() store.SystemStore                         { return &s.SystemStore }
func (s *Store) Webhook() store.WebhookStore                       { return &s.WebhookStore }
func (s *Store) Command() store.CommandStore                       { return &s.CommandStore }
func (s *Store) CommandWebhook() store.CommandWebhookStore         { return &s.CommandWebhookStore }
func (s *Store) Preference() store.PreferenceStore                 { return &s.PreferenceStore }
func (s *Store) Token() store.TokenStore                           { return &s.TokenStore }
func (s *Store) Emoji() store.EmojiStore                           { return &s.EmojiStore }
func (s *Store) Thread() store.ThreadStore                         { return &s.ThreadStore }
func (s *Store) Status() store.StatusStore                         { return &s.StatusStore }
func (s *Store) FileInfo() store.FileInfoStore                     { return &s.FileInfoStore }
func (s *Store) UploadSession() store.UploadSessionStore           { return &s.UploadSessionStore }
func (s *Store) Reaction() store.ReactionStore                     { return &s.ReactionStore }
func (s *Store) Job() store.JobStore                               { return &s.JobStore }
func (s *Store) UserAccessToken() store.UserAccessTokenStore       { return &s.UserAccessTokenStore }
func (s *Store) Plugin() store.PluginStore                         { return &s.PluginStore }
func (s *Store) Role() store.RoleStore                             { return &s.RoleStore }
func (s *Store) Scheme() store.SchemeStore                         { return &s.SchemeStore }
func (s *Store) TermsOfService() store.TermsOfServiceStore         { return &s.TermsOfServiceStore }
func (s *Store) UserTermsOfService() store.UserTermsOfServiceStore { return &s.UserTermsOfServiceStore }
func (s *Store) Draft() store.DraftStore                           { return &s.DraftStore }
func (s *Store) ChannelMemberHistory() store.ChannelMemberHistoryStore {
	return &s.ChannelMemberHistoryStore
}

func (s *Store) ChannelBookmark() store.ChannelBookmarkStore { return &s.ChannelBookmarkStore }
func (s *Store) DesktopTokens() store.DesktopTokensStore     { return &s.DesktopTokensStore }
func (s *Store) NotifyAdmin() store.NotifyAdminStore         { return &s.NotifyAdminStore }
func (s *Store) Group() store.GroupStore                     { return &s.GroupStore }
func (s *Store) LinkMetadata() store.LinkMetadataStore       { return &s.LinkMetadataStore }
func (s *Store) SharedChannel() store.SharedChannelStore     { return &s.SharedChannelStore }
func (s *Store) PostPriority() store.PostPriorityStore       { return &s.PostPriorityStore }
func (s *Store) ScheduledPost() store.ScheduledPostStore     { return &s.ScheduledPostStore }
func (s *Store) PropertyGroup() store.PropertyGroupStore     { return &s.PropertyGroupStore }
func (s *Store) PropertyField() store.PropertyFieldStore     { return &s.PropertyFieldStore }
func (s *Store) PropertyValue() store.PropertyValueStore     { return &s.PropertyValueStore }
func (s *Store) PostAcknowledgement() store.PostAcknowledgementStore {
	return &s.PostAcknowledgementStore
}
func (s *Store) PostPersistentNotification() store.PostPersistentNotificationStore {
	return &s.PostPersistentNotificationStore
}
func (s *Store) MarkSystemRanUnitTests()             { /* do nothing */ }
func (s *Store) Close()                              { /* do nothing */ }
func (s *Store) LockToMaster()                       { /* do nothing */ }
func (s *Store) UnlockFromMaster()                   { /* do nothing */ }
func (s *Store) DropAllTables()                      { /* do nothing */ }
func (s *Store) GetDbVersion(bool) (string, error)   { return "", nil }
func (s *Store) GetInternalMasterDB() *sql.DB        { return nil }
func (s *Store) GetInternalReplicaDB() *sql.DB       { return nil }
func (s *Store) GetMasterExecuter() boil.Executor    { return nil }
func (s *Store) GetReplicaExecuter() boil.Executor   { return nil }
func (s *Store) GetInternalReplicaDBs() []*sql.DB    { return nil }
func (s *Store) RecycleDBConnections(time.Duration)  {}
func (s *Store) GetDBSchemaVersion() (int, error)    { return 1, nil }
func (s *Store) GetLocalSchemaVersion() (int, error) { return 1, nil }
func (s *Store) GetAppliedMigrations() ([]model.AppliedMigration, error) {
	return []model.AppliedMigration{}, nil
}
func (s *Store) TotalMasterDbConnections() int { return 1 }
func (s *Store) TotalReadDbConnections() int   { return 1 }
func (s *Store) TotalSearchDbConnections() int { return 1 }
func (s *Store) CheckIntegrity() <-chan model.IntegrityCheckResult {
	return make(chan model.IntegrityCheckResult)
}
func (s *Store) ReplicaLagAbs() error  { return nil }
func (s *Store) ReplicaLagTime() error { return nil }
func (s *Store) AccessControlPolicy() store.AccessControlPolicyStore {
	return &s.AccessControlPolicyStore
}
func (s *Store) Attributes() store.AttributesStore {
	return &s.AttributesStore
}
func (s *Store) AutoTranslation() store.AutoTranslationStore {
	return &s.AutoTranslationStore
}

func (s *Store) ContentFlagging() store.ContentFlaggingStore {
	return &s.ContentFlaggingStore
}
func (s *Store) Recap() store.RecapStore {
	return &s.RecapStore
}
func (s *Store) ReadReceipt() store.ReadReceiptStore {
	return &s.ReadReceiptStore
}
func (s *Store) TemporaryPost() store.TemporaryPostStore {
	return &s.TemporaryPostStore
}

// LMS store accessors
func (s *Store) Branch() store.BranchStore               { return &s.BranchStore }
func (s *Store) Course() store.CourseStore               { return &s.CourseStore }
func (s *Store) CourseLesson() store.CourseLessonStore   { return &s.CourseLessonStore }
func (s *Store) Class() store.ClassStore                 { return &s.ClassStore }
func (s *Store) StudentClass() store.StudentClassStore   { return &s.StudentClassStore }
func (s *Store) LMSSession() store.LMSSessionStore       { return &s.LMSSessionStore }
func (s *Store) Attendance() store.AttendanceStore       { return &s.AttendanceStore }
func (s *Store) Lead() store.LeadStore                   { return &s.LeadStore }
func (s *Store) LeadActivity() store.LeadActivityStore   { return &s.LeadActivityStore }
func (s *Store) FeePackage() store.FeePackageStore       { return &s.FeePackageStore }
func (s *Store) Tuition() store.TuitionStore             { return &s.TuitionStore }
func (s *Store) Payment() store.PaymentStore             { return &s.PaymentStore }
func (s *Store) FeeRefund() store.FeeRefundStore         { return &s.FeeRefundStore }
func (s *Store) AdditionalFee() store.AdditionalFeeStore { return &s.AdditionalFeeStore }
func (s *Store) PostCategory() store.PostCategoryStore   { return &s.PostCategoryStore }
func (s *Store) BlogPost() store.BlogPostStore           { return &s.BlogPostStore }
func (s *Store) WeeklyReview() store.WeeklyReviewStore   { return &s.WeeklyReviewStore }
func (s *Store) Homework() store.HomeworkStore           { return &s.HomeworkStore }
func (s *Store) Submission() store.SubmissionStore       { return &s.SubmissionStore }
func (s *Store) ClassMedia() store.ClassMediaStore       { return &s.ClassMediaStore }
func (s *Store) Task() store.TaskStore                   { return &s.TaskStore }
func (s *Store) Banner() store.BannerStore               { return &s.BannerStore }
func (s *Store) Notification() store.NotificationStore   { return &s.NotificationStore }
func (s *Store) Material() store.MaterialStore           { return &s.MaterialStore }
func (s *Store) Dashboard() store.DashboardStore         { return &s.DashboardStore }

// Calls store accessors
func (s *Store) Call() store.CallStore                 { return &s.CallStore }
func (s *Store) CallSession() store.CallSessionStore   { return &s.CallSessionStore }
func (s *Store) CallJob() store.CallJobStore           { return &s.CallJobStore }
func (s *Store) CallStat() store.CallStatStore         { return &s.CallStatStore }
func (s *Store) CallsChannel() store.CallsChannelStore { return &s.CallsChannelStore }
func (s *Store) GetSchemaDefinition() (*model.SupportPacketDatabaseSchema, error) {
	return &model.SupportPacketDatabaseSchema{
		Tables: []model.DatabaseTable{},
	}, nil
}

func (s *Store) AssertExpectations(t mock.TestingT) bool {
	return mock.AssertExpectationsForObjects(t,
		&s.TeamStore,
		&s.ChannelStore,
		&s.PostStore,
		&s.UserStore,
		&s.BotStore,
		&s.AuditStore,
		&s.ClusterDiscoveryStore,
		&s.RemoteClusterStore,
		&s.ComplianceStore,
		&s.SessionStore,
		&s.OAuthStore,
		&s.SystemStore,
		&s.WebhookStore,
		&s.CommandStore,
		&s.CommandWebhookStore,
		&s.PreferenceStore,
		&s.TokenStore,
		&s.EmojiStore,
		&s.StatusStore,
		&s.FileInfoStore,
		&s.UploadSessionStore,
		&s.ReactionStore,
		&s.JobStore,
		&s.UserAccessTokenStore,
		&s.ChannelMemberHistoryStore,
		&s.PluginStore,
		&s.RoleStore,
		&s.SchemeStore,
		&s.ThreadStore,
		&s.ProductNoticesStore,
		&s.SharedChannelStore,
		&s.DraftStore,
		&s.NotifyAdminStore,
		&s.PostPriorityStore,
		&s.PostAcknowledgementStore,
		&s.PostPersistentNotificationStore,
		&s.DesktopTokensStore,
		&s.ChannelBookmarkStore,
		&s.ScheduledPostStore,
		&s.AccessControlPolicyStore,
		&s.AttributesStore,
		&s.AutoTranslationStore,
		&s.ContentFlaggingStore,
		&s.RecapStore,
		&s.ReadReceiptStore,
		&s.TemporaryPostStore,
		// LMS stores
		&s.BranchStore,
		&s.CourseStore,
		&s.CourseLessonStore,
		&s.ClassStore,
		&s.StudentClassStore,
		&s.LMSSessionStore,
		&s.AttendanceStore,
		&s.LeadStore,
		&s.LeadActivityStore,
		&s.FeePackageStore,
		&s.TuitionStore,
		&s.PaymentStore,
		&s.FeeRefundStore,
		&s.AdditionalFeeStore,
		&s.PostCategoryStore,
		&s.BlogPostStore,
		&s.WeeklyReviewStore,
		&s.HomeworkStore,
		&s.SubmissionStore,
		&s.ClassMediaStore,
		&s.TaskStore,
		&s.BannerStore,
		&s.NotificationStore,
		&s.MaterialStore,
		&s.DashboardStore,
		// Calls stores
		&s.CallStore,
		&s.CallSessionStore,
		&s.CallJobStore,
		&s.CallStatStore,
		&s.CallsChannelStore,
	)
}
