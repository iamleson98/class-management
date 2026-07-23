package web

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/i18n"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/channels/app"
	"github.com/iamleson98/sitename/server/v8/channels/utils"
)

type Context struct {
	App           *app.App
	AppContext    request.CTX
	Logger        *mlog.Logger
	Params        Params
	Err           *model.AppError
	siteURLHeader string
}

// LogAuditRec logs an audit record using default LevelAPI.
func (c *Context) LogAuditRec(rec *model.AuditRecord) {
	// finish populating the context data, in case the session wasn't available during MakeAuditRecord
	// (e.g., api4/user.go login)
	if rec.Actor.UserId == "" {
		rec.Actor.UserId = c.AppContext.Session().UserId
	}
	if rec.Actor.SessionId == "" {
		rec.Actor.SessionId = c.AppContext.Session().Id
	}

	c.LogAuditRecWithLevel(rec, app.LevelAPI)
}

// LogAuditRecWithLevel logs an audit record using specified Level.
// If the context is flagged with a permissions error then `level`
// is ignored and the audit record is emitted with `LevelPerms`.
func (c *Context) LogAuditRecWithLevel(rec *model.AuditRecord, level mlog.Level) {
	if rec == nil {
		return
	}
	if c.Err != nil {
		rec.AddErrorCode(c.Err.StatusCode)
		rec.AddErrorDesc(c.Err.Error())
		if c.Err.Id == "api.context.permissions.app_error" {
			level = app.LevelPerms
		}
		rec.Fail()
	}
	c.App.Srv().Audit.LogRecord(level, *rec)
}

// MakeAuditRecord creates an audit record pre-populated with data from this context.
func (c *Context) MakeAuditRecord(event string, initialStatus string) *model.AuditRecord {
	rec := &model.AuditRecord{
		EventName: event,
		Status:    initialStatus,
		Actor: model.AuditEventActor{
			UserId:        c.AppContext.Session().UserId,
			SessionId:     c.AppContext.Session().Id,
			Client:        c.AppContext.UserAgent(),
			IpAddress:     c.AppContext.IPAddress(),
			XForwardedFor: c.AppContext.XForwardedFor(),
		},
		Meta: map[string]any{
			model.AuditKeyAPIPath:   c.AppContext.Path(),
			model.AuditKeyClusterID: c.App.GetClusterId(),
		},
		EventData: model.AuditEventData{
			Parameters:  map[string]any{},
			PriorState:  map[string]any{},
			ResultState: map[string]any{},
			ObjectType:  "",
		},
	}

	return rec
}

func (c *Context) LogAudit(extraInfo string) {
	audit := &model.Audit{UserId: c.AppContext.Session().UserId, IpAddress: c.AppContext.IPAddress(), Action: c.AppContext.Path(), ExtraInfo: extraInfo, SessionId: c.AppContext.Session().Id}
	if err := c.App.Srv().Store().Audit().Save(audit); err != nil {
		appErr := model.NewAppError("LogAudit", "app.audit.save.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		c.LogErrorByCode(appErr)
	}
}

func (c *Context) LogAuditWithUserId(userId, extraInfo string) {
	if c.AppContext.Session().UserId != "" {
		extraInfo = strings.TrimSpace(extraInfo + " session_user=" + c.AppContext.Session().UserId)
	}

	audit := &model.Audit{UserId: userId, IpAddress: c.AppContext.IPAddress(), Action: c.AppContext.Path(), ExtraInfo: extraInfo, SessionId: c.AppContext.Session().Id}
	if err := c.App.Srv().Store().Audit().Save(audit); err != nil {
		appErr := model.NewAppError("LogAuditWithUserId", "app.audit.save.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		c.LogErrorByCode(appErr)
	}
}

func (c *Context) LogErrorByCode(err *model.AppError) {
	code := err.StatusCode
	msg := err.SystemMessage(i18n.TDefault)
	fields := []mlog.Field{
		mlog.String("err_where", err.Where),
		mlog.Int("http_code", err.StatusCode),
		mlog.String("error", err.Error()),
	}
	switch {
	case (code >= http.StatusBadRequest && code < http.StatusInternalServerError) ||
		err.Id == "web.check_browser_compatibility.app_error":
		c.Logger.Debug(msg, fields...)
	case code == http.StatusNotImplemented:
		c.Logger.Info(msg, fields...)
	default:
		c.Logger.Error(msg, fields...)
	}
}

func (c *Context) IsSystemAdmin() bool {
	return c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
}

func (c *Context) SessionRequired() {
	if !*c.App.Config().ServiceSettings.EnableUserAccessTokens &&
		c.AppContext.Session().Props[model.SessionPropType] == model.SessionTypeUserAccessToken &&
		c.AppContext.Session().Props[model.SessionPropIsBot] != model.SessionPropIsBotValue {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "UserAccessToken", http.StatusUnauthorized)
		return
	}

	if c.AppContext.Session().UserId == "" {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "UserRequired", http.StatusUnauthorized)
		return
	}
}

func (c *Context) CloudKeyRequired() {
	if c.AppContext.Session().Props[model.SessionPropType] != model.SessionTypeCloudKey {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "TokenRequired", http.StatusUnauthorized)
		return
	}
}

func (c *Context) RemoteClusterTokenRequired() {
	if c.AppContext.Session().Props[model.SessionPropType] != model.SessionTypeRemoteclusterToken {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "TokenRequired", http.StatusUnauthorized)
		return
	}
}

func (c *Context) MfaRequired() {
	if appErr := c.App.MFARequired(c.AppContext); appErr != nil {
		c.Err = appErr
	}
}

// ExtendSessionExpiryIfNeeded will update Session.ExpiresAt based on session lengths in config.
// Session cookies will be resent to the client with updated max age.
func (c *Context) ExtendSessionExpiryIfNeeded(w http.ResponseWriter, r *http.Request) {
	if ok := c.App.ExtendSessionExpiryIfNeeded(c.AppContext, c.AppContext.Session()); ok {
		c.App.AttachSessionCookies(c.AppContext, w, r)
	}
}

func (c *Context) RemoveSessionCookie(w http.ResponseWriter, r *http.Request) {
	subpath, _ := utils.GetSubpathFromConfig(c.App.Config())

	cookie := &http.Cookie{
		Name:     model.SessionCookieToken,
		Value:    "",
		Path:     subpath,
		MaxAge:   -1,
		HttpOnly: true,
	}

	http.SetCookie(w, cookie)
}

func (c *Context) SetInvalidParam(parameter string) {
	c.Err = NewInvalidParamError(parameter)
}

func (c *Context) SetInvalidParamWithDetails(parameter string, details string) {
	c.Err = NewInvalidParamDetailedError(parameter, details)
}

func (c *Context) SetInvalidParamWithErr(parameter string, err error) {
	c.Err = NewInvalidParamError(parameter).Wrap(err)
}

func (c *Context) SetInvalidURLParam(parameter string) {
	c.Err = NewInvalidURLParamError(parameter)
}

func (c *Context) SetServerBusyError() {
	c.Err = NewServerBusyError()
}

func (c *Context) SetInvalidRemoteIdError(id string) {
	c.Err = NewInvalidRemoteIdError(id)
}

func (c *Context) SetInvalidRemoteClusterTokenError() {
	c.Err = NewInvalidRemoteClusterTokenError()
}

func (c *Context) SetJSONEncodingError(err error) {
	c.Err = NewJSONEncodingError(err)
}

func (c *Context) SetCommandNotFoundError() {
	c.Err = model.NewAppError("GetCommand", "store.sql_command.save.get.app_error", nil, "", http.StatusNotFound)
}

func (c *Context) HandleEtag(etag string, routeName string, w http.ResponseWriter, r *http.Request) bool {
	metrics := c.App.Metrics()
	if et := r.Header.Get(model.HeaderEtagClient); etag != "" {
		if et == etag {
			w.Header().Set(model.HeaderEtagServer, etag)
			w.WriteHeader(http.StatusNotModified)
			if metrics != nil {
				metrics.IncrementEtagHitCounter(routeName)
			}
			return true
		}
	}

	if metrics != nil {
		metrics.IncrementEtagMissCounter(routeName)
	}

	return false
}

func NewInvalidParamDetailedError(parameter string, details string) *model.AppError {
	err := model.NewAppError("Context", "api.context.invalid_body_param.app_error", map[string]any{"Name": parameter}, details, http.StatusBadRequest)
	return err
}

func NewInvalidParamError(parameter string) *model.AppError {
	err := model.NewAppError("Context", "api.context.invalid_body_param.app_error", map[string]any{"Name": parameter}, "", http.StatusBadRequest)
	return err
}

func NewInvalidURLParamError(parameter string) *model.AppError {
	err := model.NewAppError("Context", "api.context.invalid_url_param.app_error", map[string]any{"Name": parameter}, "", http.StatusBadRequest)
	return err
}

func NewServerBusyError() *model.AppError {
	err := model.NewAppError("Context", "api.context.server_busy.app_error", nil, "", http.StatusServiceUnavailable)
	return err
}

func NewInvalidRemoteIdError(parameter string) *model.AppError {
	err := model.NewAppError("Context", "api.context.remote_id_invalid.app_error", map[string]any{"RemoteId": parameter}, "", http.StatusBadRequest)
	return err
}

func NewInvalidRemoteClusterTokenError() *model.AppError {
	err := model.NewAppError("Context", "api.context.remote_id_invalid.app_error", nil, "", http.StatusUnauthorized)
	return err
}

func NewJSONEncodingError(err error) *model.AppError {
	appErr := model.NewAppError("Context", "api.context.json_encoding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	return appErr
}

func (c *Context) SetPermissionError(permissions ...*model.Permission) {
	c.Err = model.MakePermissionError(c.AppContext.Session(), permissions)
}

func (c *Context) SetSiteURLHeader(url string) {
	c.siteURLHeader = strings.TrimRight(url, "/")
}

func (c *Context) GetSiteURLHeader() string {
	return c.siteURLHeader
}

func (c *Context) RequireUserId() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params["user_id"] == model.Me {
		c.Params["user_id"] = c.AppContext.Session().UserId
	}

	if uid, ok := c.Params["user_id"].(string); !ok || !model.IsValidId(uid) {
		c.SetInvalidURLParam("user_id")
	}
	return c
}

// func (c *Context) RequireOtherUserId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if uid, ok := c.Params["other_user_id"].(string); !ok || !model.IsValidId(uid) {
// 		c.SetInvalidURLParam("other_user_id")
// 	}
// 	return c
// }

// func (c *Context) RequireTeamId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if tid, ok := c.Params["team_id"].(string); !ok || !model.IsValidId(tid) {
// 		c.SetInvalidURLParam("team_id")
// 	}
// 	return c
// }

// func (c *Context) RequireCategoryId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if cid, ok := c.Params["category_id"].(string); !ok || !model.IsValidCategoryId(cid) {
// 		c.SetInvalidURLParam("category_id")
// 	}
// 	return c
// }

type RequireFunc func(value any) (any, bool)

// Value must be a non-empty string
var RequireString RequireFunc = func(value any) (any, bool) {
	str, ok := value.(string)
	if !ok || str == "" {
		return "", false
	}
	return str, true
}

// Value must be an int
var RequireInt RequireFunc = func(value any) (any, bool) {
	in, ok := value.(int)
	if !ok {
		return 0, false
	}
	return in, true
}

// value must be:
//
// 1) a string
//
// 2) a valid id
var RequireValidId RequireFunc = func(value any) (any, bool) {
	strValue, ok := RequireString(value)
	if !ok || !model.IsValidId(strValue.(string)) {
		return "", false
	}
	return strValue, true
}

// value must be a string and [model.IsValidUsername]
var RequireValidUsername RequireFunc = func(value any) (any, bool) {
	strValue, ok := RequireString(value)
	if !ok || !model.IsValidUsername(strValue.(string)) {
		return "", false
	}
	return strValue, true
}

// value must be a boolean
var RequireBool RequireFunc = func(value any) (any, bool) {
	boolValue, ok := value.(bool)
	if !ok {
		return false, false
	}
	return boolValue, true
}

// value must be a string and a valid channel name [model.IsValidChannelIdentifier]
var RequireChannelName RequireFunc = func(value any) (any, bool) {
	strValue, ok := RequireString(value)
	if !ok || !model.IsValidChannelIdentifier(strValue.(string)) {
		return "", false
	}
	return strValue, true
}

// value must be a string and a valid team name [model.IsValidTeamName]
var RequireTeamName RequireFunc = func(value any) (any, bool) {
	strValue, ok := RequireString(value)
	if !ok || !model.IsValidTeamName(strValue.(string)) {
		return "", false
	}
	return strValue, true
}

var ValidName = regexp.MustCompile(`^[a-zA-Z0-9\-\+_]+$`)

// value must be a string, non-empty, less than [model.EmojiNameMaxLength] and match ValidName regex
var RequireEmojiName RequireFunc = func(value any) (any, bool) {
	strValue, ok := RequireString(value)
	if !ok {
		return "", false
	}
	if strValue == "" || len(strValue.(string)) > model.EmojiNameMaxLength || !ValidName.MatchString(strValue.(string)) {
		return "", false
	}
	return strValue, true
}

// value must be a string and match [model.IsValidAlphaNumHyphenUnderscore] with case insensitive
var RequireValidName RequireFunc = func(value any) (any, bool) {
	strValue, ok := RequireString(value)
	if !ok {
		return "", false
	}
	if !model.IsValidAlphaNumHyphenUnderscore(strValue.(string), true) {
		return "", false
	}
	return strValue, true
}

func (c *Context) RequireParam(parameter string, require RequireFunc) any {
	if c.Err != nil {
		return nil
	}
	value, ok := c.Params[parameter]
	if !ok {
		c.SetInvalidURLParam(parameter)
		return nil
	}
	result, ok := require(value)
	if !ok {
		c.SetInvalidURLParam(parameter)
		return nil
	}

	return result
}

// func (c *Context) RequireInviteId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if inviteId, ok := c.Params["invite_id"].(string); !ok || inviteId == "" {
// 		c.SetInvalidURLParam("invite_id")
// 	}
// 	return c
// }

// func (c *Context) RequireTokenId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if tokenId, ok := c.Params["token_id"].(string); !ok || !model.IsValidId(tokenId) {
// 		c.SetInvalidURLParam("token_id")
// 	}
// 	return c
// }

// func (c *Context) RequireThreadId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if threadId, ok := c.Params["thread_id"].(string); !ok || !model.IsValidId(threadId) {
// 		c.SetInvalidURLParam("thread_id")
// 	}
// 	return c
// }

// func (c *Context) RequireTimestamp() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if timestamp, ok := c.Params["timestamp"].(int64); !ok || timestamp == 0 {
// 		c.SetInvalidURLParam("timestamp")
// 	}
// 	return c
// }

// func (c *Context) RequireChannelId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if channelId, ok := c.Params["channel_id"].(string); !ok || !model.IsValidId(channelId) {
// 		c.SetInvalidURLParam("channel_id")
// 	}
// 	return c
// }

// func (c *Context) RequireUsername() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if username, ok := c.Params["username"].(string); !ok || !model.IsValidUsername(username) {
// 		c.SetInvalidParam("username")
// 	}

// 	return c
// }

// func (c *Context) RequirePostId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if postId, ok := c.Params["post_id"].(string); !ok || !model.IsValidId(postId) {
// 		c.SetInvalidURLParam("post_id")
// 	}
// 	return c
// }

// func (c *Context) RequirePolicyId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if policyId, ok := c.Params["policy_id"].(string); !ok || !model.IsValidId(policyId) {
// 		c.SetInvalidURLParam("policy_id")
// 	}
// 	return c
// }

// func (c *Context) RequireAppId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if appId, ok := c.Params["app_id"].(string); !ok || !model.IsValidId(appId) {
// 		c.SetInvalidURLParam("app_id")
// 	}
// 	return c
// }

// func (c *Context) RequireOutgoingOAuthConnectionId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if outgoingOAuthConnectionId, ok := c.Params["outgoing_oauth_connection_id"].(string); !ok || !model.IsValidId(outgoingOAuthConnectionId) {
// 		c.SetInvalidURLParam("outgoing_oauth_connection_id")
// 	}
// 	return c
// }

// func (c *Context) RequireFileId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if fileId, ok := c.Params["file_id"].(string); !ok || !model.IsValidId(fileId) {
// 		c.SetInvalidURLParam("file_id")
// 	}

// 	return c
// }

// func (c *Context) RequireUploadId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if uploadId, ok := c.Params["upload_id"].(string); !ok || !model.IsValidId(uploadId) {
// 		c.SetInvalidURLParam("upload_id")
// 	}

// 	return c
// }

// func (c *Context) RequireFilename() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if filename, ok := c.Params["filename"].(string); !ok || filename == "" {
// 		c.SetInvalidURLParam("filename")
// 	}

// 	return c
// }

// func (c *Context) RequirePluginId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if pluginId, ok := c.Params["plugin_id"].(string); !ok || pluginId == "" {
// 		c.SetInvalidURLParam("plugin_id")
// 	}

// 	return c
// }

// func (c *Context) RequireReportId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if reportId, ok := c.Params["report_id"].(string); !ok || !model.IsValidId(reportId) {
// 		c.SetInvalidURLParam("report_id")
// 	}
// 	return c
// }

// func (c *Context) RequireEmojiId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if emojiId, ok := c.Params["emoji_id"].(string); !ok || !model.IsValidId(emojiId) {
// 		c.SetInvalidURLParam("emoji_id")
// 	}
// 	return c
// }

// func (c *Context) RequireTeamName() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if teamName, ok := c.Params["team_name"].(string); !ok || !model.IsValidTeamName(teamName) {
// 		c.SetInvalidURLParam("team_name")
// 	}

// 	return c
// }

// func (c *Context) RequireChannelName() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if channelName, ok := c.Params["channel_name"].(string); !ok || !model.IsValidChannelIdentifier(channelName) {
// 		c.SetInvalidURLParam("channel_name")
// 	}

// 	return c
// }

func (c *Context) SanitizeEmail() *Context {
	if c.Err != nil {
		return c
	}
	if email, ok := c.Params["email"].(string); ok {
		c.Params["email"] = strings.ToLower(email)
		if !model.IsValidEmail(c.Params["email"].(string)) {
			c.SetInvalidURLParam("email")
		}
	} else {
		c.SetInvalidURLParam("email")
	}

	return c
}

// func (c *Context) RequireCategory() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if category, ok := c.Params["category"].(string); !ok || !model.IsValidAlphaNumHyphenUnderscore(category, true) {
// 		c.SetInvalidURLParam("category")
// 	}

// 	return c
// }

func (c *Context) RequireService() *Context {
	if c.Err != nil {
		return c
	}

	if service, ok := c.Params["service"].(string); !ok || service == "" {
		c.SetInvalidURLParam("service")
	}

	return c
}

// func (c *Context) RequirePreferenceName() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if preferenceName, ok := c.Params["preference_name"].(string); !ok || !model.IsValidAlphaNumHyphenUnderscore(preferenceName, true) {
// 		c.SetInvalidURLParam("preference_name")
// 	}

// 	return c
// }

// func (c *Context) RequireEmojiName() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	validName := regexp.MustCompile(`^[a-zA-Z0-9\-\+_]+$`)

// 	if emojiName, ok := c.Params["emoji_name"].(string); !ok || emojiName == "" || len(emojiName) > model.EmojiNameMaxLength || !validName.MatchString(emojiName) {
// 		c.SetInvalidURLParam("emoji_name")
// 	}

// 	return c
// }

func (c *Context) RequireHookId() *Context {
	if c.Err != nil {
		return c
	}

	if hookId, ok := c.Params["hook_id"].(string); !ok || !model.IsValidId(hookId) {
		c.SetInvalidURLParam("hook_id")
	}

	return c
}

// func (c *Context) RequireCommandId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if commandId, ok := c.Params["command_id"].(string); !ok || !model.IsValidId(commandId) {
// 		c.SetInvalidURLParam("command_id")
// 	}
// 	return c
// }

// func (c *Context) RequireJobId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if jobId, ok := c.Params["job_id"].(string); !ok || !model.IsValidId(jobId) {
// 		c.SetInvalidURLParam("job_id")
// 	}
// 	return c
// }

// func (c *Context) RequireJobType() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if jobType, ok := c.Params["job_type"].(string); !ok || jobType == "" || len(jobType) > 32 {
// 		c.SetInvalidURLParam("job_type")
// 	}
// 	return c
// }

// func (c *Context) RequireRoleId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if roleId, ok := c.Params["role_id"].(string); !ok || !model.IsValidId(roleId) {
// 		c.SetInvalidURLParam("role_id")
// 	}
// 	return c
// }

// func (c *Context) RequireFieldId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if fieldId, ok := c.Params["field_id"].(string); !ok || !model.IsValidId(fieldId) {
// 		c.SetInvalidURLParam("field_id")
// 	}
// 	return c
// }

// func (c *Context) RequireSchemeId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if schemeId, ok := c.Params["scheme_id"].(string); !ok || !model.IsValidId(schemeId) {
// 		c.SetInvalidURLParam("scheme_id")
// 	}
// 	return c
// }

// func (c *Context) RequireRoleName() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if roleName, ok := c.Params["role_name"].(string); !ok || !model.IsValidRoleName(roleName) {
// 		c.SetInvalidURLParam("role_name")
// 	}

// 	return c
// }

// func (c *Context) RequireGroupId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if groupId, ok := c.Params["group_id"].(string); !ok || !model.IsValidId(groupId) {
// 		c.SetInvalidURLParam("group_id")
// 	}
// 	return c
// }

// func (c *Context) RequireRemoteId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if remoteId, ok := c.Params["remote_id"].(string); !ok || remoteId == "" {
// 		c.SetInvalidURLParam("remote_id")
// 	}
// 	return c
// }

// func (c *Context) RequireSyncableId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if syncableId, ok := c.Params["syncable_id"].(string); !ok || !model.IsValidId(syncableId) {
// 		c.SetInvalidURLParam("syncable_id")
// 	}
// 	return c
// }

// func (c *Context) RequireSyncableType() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if syncableType, ok := c.Params["syncable_type"].(string); !ok || (syncableType != string(model.GroupSyncableTypeTeam) && syncableType != string(model.GroupSyncableTypeChannel)) {
// 		c.SetInvalidURLParam("syncable_type")
// 	}
// 	return c
// }

// func (c *Context) RequireBotUserId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if botUserId, ok := c.Params["bot_user_id"].(string); !ok || !model.IsValidId(botUserId) {
// 		c.SetInvalidURLParam("bot_user_id")
// 	}
// 	return c
// }

// func (c *Context) RequireInvoiceId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if invoiceId, ok := c.Params["invoice_id"].(string); !ok || (len(invoiceId) != 27 && invoiceId != model.UpcomingInvoice) {
// 		c.SetInvalidURLParam("invoice_id")
// 	}

// 	return c
// }

// func (c *Context) RequireContentReviewerId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if contentReviewerId, ok := c.Params["content_reviewer_id"].(string); !ok || !model.IsValidId(contentReviewerId) {
// 		c.SetInvalidURLParam("content_reviewer_id")
// 	}
// 	return c
// }

// func (c *Context) RequireRecapId() *Context {
// 	if c.Err != nil {
// 		return c
// 	}

// 	if recapId, ok := c.Params["recap_id"].(string); !ok || !model.IsValidId(recapId) {
// 		c.SetInvalidURLParam("recap_id")
// 	}
// 	return c
// }

func (c *Context) GetRemoteID(r *http.Request) string {
	return r.Header.Get(model.HeaderRemoteclusterId)
}
