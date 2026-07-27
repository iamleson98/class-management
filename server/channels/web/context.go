package web

import (
	"cmp"
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

type RequireFunc[T cmp.Ordered | ~bool] func(value any) (T, bool)

// Value must be a non-empty string
var RequireString RequireFunc[string] = func(value any) (string, bool) {
	str, ok := value.(string)
	if !ok || str == "" {
		return "", false
	}
	return str, true
}

// Value must be an int
var RequireInt RequireFunc[int] = func(value any) (int, bool) {
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
var RequireValidId RequireFunc[string] = func(value any) (string, bool) {
	strValue, ok := RequireString(value)
	if !ok || !model.IsValidId(strValue) {
		return "", false
	}
	return strValue, true
}

// value must be a string and [model.IsValidUsername]
var RequireValidUsername RequireFunc[string] = func(value any) (string, bool) {
	strValue, ok := RequireString(value)
	if !ok || !model.IsValidUsername(strValue) {
		return "", false
	}
	return strValue, true
}

// value must be a boolean
var RequireBool RequireFunc[bool] = func(value any) (bool, bool) {
	boolValue, ok := value.(bool)
	if !ok {
		return false, false
	}
	return boolValue, true
}

// value must be a string and a valid channel name [model.IsValidChannelIdentifier]
var RequireChannelName RequireFunc[string] = func(value any) (string, bool) {
	strValue, ok := RequireString(value)
	if !ok || !model.IsValidChannelIdentifier(strValue) {
		return "", false
	}
	return strValue, true
}

// value must be a string and a valid team name [model.IsValidTeamName]
var RequireTeamName RequireFunc[string] = func(value any) (string, bool) {
	strValue, ok := RequireString(value)
	if !ok || !model.IsValidTeamName(strValue) {
		return "", false
	}
	return strValue, true
}

var ValidName = regexp.MustCompile(`^[a-zA-Z0-9\-\+_]+$`)

// value must be a string, non-empty, less than [model.EmojiNameMaxLength] and match ValidName regex
var RequireEmojiName RequireFunc[string] = func(value any) (string, bool) {
	strValue, ok := RequireString(value)
	if !ok {
		return "", false
	}
	if strValue == "" || len(strValue) > model.EmojiNameMaxLength || !ValidName.MatchString(strValue) {
		return "", false
	}
	return strValue, true
}

// value must be a string and match [model.IsValidAlphaNumHyphenUnderscore] with case insensitive
var RequireValidName RequireFunc[string] = func(value any) (string, bool) {
	strValue, ok := RequireString(value)
	if !ok {
		return "", false
	}
	if !model.IsValidAlphaNumHyphenUnderscore(strValue, true) {
		return "", false
	}
	return strValue, true
}

func (c *Context) RequireParam[T cmp.Ordered | ~bool](parameter string, require RequireFunc[T]) T {
	var zeroT T
	if c.Err != nil {
		return zeroT
	}
	value, ok := c.Params[parameter]
	if !ok {
		c.SetInvalidURLParam(parameter)
		return zeroT
	}
	result, ok := require(value)
	if !ok {
		c.SetInvalidURLParam(parameter)
		return zeroT
	}

	return result
}

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

func (c *Context) RequireService() *Context {
	if c.Err != nil {
		return c
	}

	if service, ok := c.Params["service"].(string); !ok || service == "" {
		c.SetInvalidURLParam("service")
	}

	return c
}

func (c *Context) RequireHookId() *Context {
	if c.Err != nil {
		return c
	}

	if hookId, ok := c.Params["hook_id"].(string); !ok || !model.IsValidId(hookId) {
		c.SetInvalidURLParam("hook_id")
	}

	return c
}

func (c *Context) GetRemoteID(r *http.Request) string {
	return r.Header.Get(model.HeaderRemoteclusterId)
}
