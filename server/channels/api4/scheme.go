package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitScheme() {
	api.BaseRoutes.Schemes.Method(http.MethodGet, "/", api.APISessionRequired(getSchemes))
	api.BaseRoutes.Schemes.Method(http.MethodPost, "/", api.APISessionRequired(createScheme))
	api.BaseRoutes.Schemes.Method(http.MethodDelete, "/{scheme_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteScheme))
	api.BaseRoutes.Schemes.Method(http.MethodGet, "/{scheme_id:[A-Za-z0-9]+}", api.APISessionRequiredTrustRequester(getScheme))
	api.BaseRoutes.Schemes.Method(http.MethodPut, "/{scheme_id:[A-Za-z0-9]+}/patch", api.APISessionRequired(patchScheme))
	api.BaseRoutes.Schemes.Method(http.MethodGet, "/{scheme_id:[A-Za-z0-9]+}/teams", api.APISessionRequiredTrustRequester(getTeamsForScheme))
	api.BaseRoutes.Schemes.Method(http.MethodGet, "/{scheme_id:[A-Za-z0-9]+}/channels", api.APISessionRequiredTrustRequester(getChannelsForScheme))
}

func createScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	var scheme model.Scheme
	if jsonErr := json.NewDecoder(r.Body).Decode(&scheme); jsonErr != nil {
		c.SetInvalidParamWithErr("scheme", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateScheme, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "scheme", &scheme)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementPermissions) {
		c.SetPermissionError(model.PermissionSysconsoleWriteUserManagementPermissions)
		return
	}

	returnedScheme, err := c.App.CreateScheme(&scheme)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(returnedScheme)
	auditRec.AddEventObjectType("scheme")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(returnedScheme); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	schemeIdStr := c.RequireParam("scheme_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementPermissions) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementPermissions)
		return
	}

	scheme, err := c.App.GetScheme(schemeIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(scheme); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getSchemes(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementPermissions) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementPermissions)
		return
	}

	scope, _ := c.Params["scope"].(string)
	if scope != "" && scope != model.SchemeScopeTeam && scope != model.SchemeScopeChannel {
		c.SetInvalidParam("scope")
		return
	}

	schemes, appErr := c.App.GetSchemesPage(scope, c.Params["page"].(int), c.Params["per_page"].(int))
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(schemes)
	if err != nil {
		c.Err = model.NewAppError("getSchemes", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getTeamsForScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	schemeIdStr := c.RequireParam("scheme_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementTeams) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementTeams)
		return
	}

	scheme, appErr := c.App.GetScheme(schemeIdStr)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if scheme.Scope != model.SchemeScopeTeam {
		c.Err = model.NewAppError("Api4.GetTeamsForScheme", "api.scheme.get_teams_for_scheme.scope.error", nil, "", http.StatusBadRequest)
		return
	}

	teams, appErr := c.App.GetTeamsForSchemePage(scheme, c.Params["page"].(int), c.Params["per_page"].(int))
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(teams)
	if err != nil {
		c.Err = model.NewAppError("getTeamsForScheme", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelsForScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	schemeIdStr := c.RequireParam("scheme_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementChannels) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementChannels)
		return
	}

	scheme, err := c.App.GetScheme(schemeIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if scheme.Scope != model.SchemeScopeChannel {
		c.Err = model.NewAppError("Api4.GetChannelsForScheme", "api.scheme.get_channels_for_scheme.scope.error", nil, "", http.StatusBadRequest)
		return
	}

	channels, err := c.App.GetChannelsForSchemePage(scheme, c.Params["page"].(int), c.Params["per_page"].(int))
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	schemeIdStr := c.RequireParam("scheme_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var patch model.SchemePatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&patch); jsonErr != nil {
		c.SetInvalidParamWithErr("scheme", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchScheme, model.AuditStatusFail)
	model.AddEventParameterAuditableToAuditRec(auditRec, "scheme_patch", &patch)
	defer c.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "scheme_id", schemeIdStr)

	scheme, err := c.App.GetScheme(schemeIdStr)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(scheme)
	auditRec.AddEventObjectType("scheme")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementPermissions) {
		c.SetPermissionError(model.PermissionSysconsoleWriteUserManagementPermissions)
		return
	}

	scheme, err = c.App.PatchScheme(scheme, &patch)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventResultState(scheme)

	auditRec.Success()
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(scheme); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	schemeIdStr := c.RequireParam("scheme_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteScheme, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "scheme_id", schemeIdStr)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementPermissions) {
		c.SetPermissionError(model.PermissionSysconsoleWriteUserManagementPermissions)
		return
	}

	scheme, err := c.App.DeleteScheme(schemeIdStr)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(scheme)
	auditRec.AddEventObjectType("scheme")
	auditRec.Success()

	ReturnStatusOK(w)
}
