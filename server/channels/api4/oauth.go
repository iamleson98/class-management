package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitOAuth() {
	api.BaseRoutes.OAuthApps.Method(http.MethodPost, "/", api.APISessionRequired(createOAuthApp))
	api.BaseRoutes.OAuthApp.Method(http.MethodPut, "/", api.APISessionRequired(updateOAuthApp))
	api.BaseRoutes.OAuthApps.Method(http.MethodGet, "/", api.APISessionRequired(getOAuthApps))
	api.BaseRoutes.OAuthApp.Method(http.MethodGet, "/", api.APISessionRequired(getOAuthApp))
	api.BaseRoutes.OAuthApp.Method(http.MethodGet, "/info", api.APISessionRequired(getOAuthAppInfo))
	api.BaseRoutes.OAuthApp.Method(http.MethodDelete, "/", api.APISessionRequired(deleteOAuthApp))
	api.BaseRoutes.OAuthApp.Method(http.MethodPost, "/regen_secret", api.APISessionRequired(regenerateOAuthAppSecret))

	// DCR (Dynamic Client Registration) endpoints as per RFC 7591
	api.BaseRoutes.OAuthApps.Method(http.MethodPost, "/register", api.RateLimitedHandler(api.APIHandler(registerOAuthClient), model.RateLimitSettings{PerSec: model.NewPointer(2), MaxBurst: model.NewPointer(1)}))

	api.BaseRoutes.User.Method(http.MethodGet, "/oauth/apps/authorized", api.APISessionRequired(getAuthorizedOAuthApps))
}

func createOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	var appRequest model.OAuthAppRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&appRequest); jsonErr != nil {
		c.SetInvalidParamWithErr("oauth_app", jsonErr)
		return
	}

	// Build OAuthApp from request
	oauthApp := model.OAuthApp{
		Name:         appRequest.Name,
		Description:  appRequest.Description,
		IconURL:      appRequest.IconURL,
		CallbackUrls: appRequest.CallbackUrls,
		Homepage:     appRequest.Homepage,
		IsTrusted:    appRequest.IsTrusted,
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateOAuthApp, model.AuditStatusFail)
	model.AddEventParameterAuditableToAuditRec(auditRec, "oauth_app", &oauthApp)

	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		oauthApp.IsTrusted = false
	}

	oauthApp.CreatorId = c.AppContext.Session().UserId
	oauthApp.IsDynamicallyRegistered = false

	// Use internal method to control secret generation
	// Public clients: generateSecret = false (keeps empty secret)
	// Confidential clients: generateSecret = true (auto-generates secret)
	generateSecret := !appRequest.IsPublic
	rapp, err := c.App.CreateOAuthAppInternal(&oauthApp, generateSecret)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(rapp)
	auditRec.AddEventObjectType("oauth_app")
	c.LogAudit("client_id=" + rapp.Id)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rapp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	appId := c.RequireParam("app_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	appIdStr := appId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateOAuthApp, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "oauth_app_id", appIdStr)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	var oauthApp model.OAuthApp
	if jsonErr := json.NewDecoder(r.Body).Decode(&oauthApp); jsonErr != nil {
		c.SetInvalidParamWithErr("oauth_app", jsonErr)
		return
	}
	model.AddEventParameterAuditableToAuditRec(auditRec, "oauth_app", &oauthApp)

	// The app being updated in the payload must be the same one as indicated in the URL.
	if oauthApp.Id != appIdStr {
		c.SetInvalidParam("app_id")
		return
	}

	oldOAuthApp, err := c.App.GetOAuthApp(appIdStr)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(oldOAuthApp)

	if c.AppContext.Session().UserId != oldOAuthApp.CreatorId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		c.SetPermissionError(model.PermissionManageSystemWideOAuth)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		oauthApp.IsTrusted = oldOAuthApp.IsTrusted
	}

	updatedOAuthApp, err := c.App.UpdateOAuthApp(oldOAuthApp, &oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(updatedOAuthApp)
	auditRec.AddEventObjectType("oauth_app")
	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(updatedOAuthApp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getOAuthApps(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.Err = model.NewAppError("getOAuthApps", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	var apps []*model.OAuthApp
	var appErr *model.AppError
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		apps, appErr = c.App.GetOAuthApps(c.Params["page"].(int), c.Params["per_page"].(int))
	} else if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		apps, appErr = c.App.GetOAuthAppsByCreator(c.AppContext.Session().UserId, c.Params["page"].(int), c.Params["per_page"].(int))
	} else {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(apps)
	if err != nil {
		c.Err = model.NewAppError("getOAuthApps", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	appId := c.RequireParam("app_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	appIdStr := appId.(string)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	oauthApp, err := c.App.GetOAuthApp(appIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if oauthApp.CreatorId != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		c.SetPermissionError(model.PermissionManageSystemWideOAuth)
		return
	}

	if err := json.NewEncoder(w).Encode(oauthApp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getOAuthAppInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	appId := c.RequireParam("app_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	appIdStr := appId.(string)

	oauthApp, err := c.App.GetOAuthApp(appIdStr)
	if err != nil {
		c.Err = err
		return
	}

	oauthApp.Sanitize()
	if err := json.NewEncoder(w).Encode(oauthApp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	appId := c.RequireParam("app_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	appIdStr := appId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteOAuthApp, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "oauth_app_id", appIdStr)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	oauthApp, err := c.App.GetOAuthApp(appIdStr)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(oauthApp)
	auditRec.AddEventObjectType("oauth_app")

	if c.AppContext.Session().UserId != oauthApp.CreatorId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		c.SetPermissionError(model.PermissionManageSystemWideOAuth)
		return
	}

	err = c.App.DeleteOAuthApp(c.AppContext, oauthApp.Id)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	ReturnStatusOK(w)
}

func regenerateOAuthAppSecret(c *Context, w http.ResponseWriter, r *http.Request) {
	appId := c.RequireParam("app_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	appIdStr := appId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventRegenerateOAuthAppSecret, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "oauth_app_id", appIdStr)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	oauthApp, err := c.App.GetOAuthApp(appIdStr)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(oauthApp)
	auditRec.AddEventObjectType("oauth_app")

	if oauthApp.CreatorId != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		c.SetPermissionError(model.PermissionManageSystemWideOAuth)
		return
	}

	// Prevent regenerating secrets for public clients
	if oauthApp.IsPublicClient() {
		c.Err = model.NewAppError("regenerateOAuthAppSecret", "api.oauth.regenerate_secret.public_client.app_error", nil, "app_id="+oauthApp.Id, http.StatusBadRequest)
		return
	}

	oauthApp, err = c.App.RegenerateOAuthAppSecret(oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(oauthApp)
	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(oauthApp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAuthorizedOAuthApps(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	apps, appErr := c.App.GetAuthorizedAppsForUser(userIdStr, c.Params["page"].(int), c.Params["per_page"].(int))
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(apps)
	if err != nil {
		c.Err = model.NewAppError("getAuthorizedOAuthApps", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// DCR (Dynamic Client Registration) endpoint handlers as per RFC 7591
func registerOAuthClient(c *Context, w http.ResponseWriter, r *http.Request) {
	// Session and permission checks removed for DCR endpoint to allow external client registration

	auditRec := c.MakeAuditRecord(model.AuditEventRegisterOAuthClient, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	var clientRequest model.ClientRegistrationRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&clientRequest); jsonErr != nil {
		dcrError := model.NewDCRError(model.DCRErrorInvalidClientMetadata, "Invalid JSON in request body")

		w.WriteHeader(http.StatusBadRequest)
		if err := json.NewEncoder(w).Encode(dcrError); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	// Add DCR request parameters to audit record
	model.AddEventParameterToAuditRec(auditRec, "redirect_uris", clientRequest.RedirectURIs)
	if clientRequest.ClientName != nil {
		model.AddEventParameterToAuditRec(auditRec, "client_name", *clientRequest.ClientName)
	}
	if clientRequest.TokenEndpointAuthMethod != nil {
		model.AddEventParameterToAuditRec(auditRec, "token_endpoint_auth_method", *clientRequest.TokenEndpointAuthMethod)
	}
	if clientRequest.ClientURI != nil {
		model.AddEventParameterToAuditRec(auditRec, "client_uri", *clientRequest.ClientURI)
	}

	// Check if OAuth service provider is enabled
	if !*c.App.Config().ServiceSettings.EnableOAuthServiceProvider {
		dcrError := model.NewDCRError(model.DCRErrorUnsupportedOperation, "OAuth service provider is disabled")

		w.WriteHeader(http.StatusBadRequest)
		if err := json.NewEncoder(w).Encode(dcrError); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	// Check if DCR is enabled
	if c.App.Config().ServiceSettings.EnableDynamicClientRegistration == nil || !*c.App.Config().ServiceSettings.EnableDynamicClientRegistration {
		dcrError := model.NewDCRError(model.DCRErrorUnsupportedOperation, "Dynamic client registration is disabled")

		w.WriteHeader(http.StatusBadRequest)
		if err := json.NewEncoder(w).Encode(dcrError); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	// Validate the request
	if err := clientRequest.IsValid(); err != nil {
		dcrError := model.NewDCRError(model.DCRErrorInvalidClientMetadata, err.Message)

		w.WriteHeader(http.StatusBadRequest)
		if err := json.NewEncoder(w).Encode(dcrError); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	// No user ID for DCR
	userID := ""

	app, appErr := c.App.RegisterOAuthClient(c.AppContext, &clientRequest, userID)
	if appErr != nil {
		dcrError := model.NewDCRError(model.DCRErrorInvalidClientMetadata, appErr.Message)

		w.WriteHeader(appErr.StatusCode)
		if err := json.NewEncoder(w).Encode(dcrError); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(app)
	auditRec.AddEventObjectType("oauth_app")
	c.LogAudit("client_id=" + app.Id)

	siteURL := *c.App.Config().ServiceSettings.SiteURL
	response := app.ToClientRegistrationResponse(siteURL)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error writing DCR response", mlog.Err(err))
	}
}
