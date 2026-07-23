package api4

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/app"
	"github.com/iamleson98/sitename/server/v8/channels/utils"
	"github.com/iamleson98/sitename/server/v8/channels/web"
	"github.com/iamleson98/sitename/server/v8/platform/services/remotecluster"
)

func (api *API) InitRemoteCluster() {
	api.BaseRoutes.RemoteCluster.Method(http.MethodPost, "/ping", api.RemoteClusterTokenRequired(remoteClusterPing))
	api.BaseRoutes.RemoteCluster.Method(http.MethodPost, "/msg", api.RemoteClusterTokenRequired(remoteClusterAcceptMessage))
	api.BaseRoutes.RemoteCluster.Method(http.MethodPost, "/confirm_invite", api.RemoteClusterTokenRequired(remoteClusterConfirmInvite))
	api.BaseRoutes.RemoteCluster.Method(http.MethodPost, "/upload/{upload_id:[A-Za-z0-9]+}", api.RemoteClusterTokenRequired(uploadRemoteData, handlerParamFileAPI))
	api.BaseRoutes.RemoteCluster.Method(http.MethodPost, "/{user_id:[A-Za-z0-9]+}/image", api.RemoteClusterTokenRequired(remoteSetProfileImage, handlerParamFileAPI))
	api.BaseRoutes.RemoteCluster.Method(http.MethodGet, "/", api.APISessionRequired(getRemoteClusters))
	api.BaseRoutes.RemoteCluster.Method(http.MethodPost, "/", api.APISessionRequired(createRemoteCluster))
	api.BaseRoutes.RemoteCluster.Method(http.MethodPost, "/accept_invite", api.APISessionRequired(remoteClusterAcceptInvite))
	api.BaseRoutes.RemoteCluster.Method(http.MethodPost, "/{remote_id:[A-Za-z0-9]+}/generate_invite", api.APISessionRequired(generateRemoteClusterInvite))
	api.BaseRoutes.RemoteCluster.Method(http.MethodGet, "/{remote_id:[A-Za-z0-9]+}", api.APISessionRequired(getRemoteCluster))
	api.BaseRoutes.RemoteCluster.Method(http.MethodPatch, "/{remote_id:[A-Za-z0-9]+}", api.APISessionRequired(patchRemoteCluster))
	api.BaseRoutes.RemoteCluster.Method(http.MethodDelete, "/{remote_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteRemoteCluster))
}

func remoteClusterPing(c *Context, w http.ResponseWriter, r *http.Request) {
	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	var frame model.RemoteClusterFrame
	if err := json.NewDecoder(r.Body).Decode(&frame); err != nil {
		c.Err = model.NewAppError("remoteClusterPing", "api.unmarshal_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	if appErr := frame.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	remoteId := c.GetRemoteID(r)
	if remoteId != frame.RemoteId {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	rc, appErr := c.App.GetRemoteCluster(frame.RemoteId, false)
	if appErr != nil {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	var ping model.RemoteClusterPing
	if err := json.Unmarshal(frame.Msg.Payload, &ping); err != nil {
		c.SetInvalidParamWithErr("msg.payload", err)
		return
	}
	ping.RecvAt = model.GetMillis()

	if metrics := c.App.Metrics(); metrics != nil {
		metrics.IncrementRemoteClusterMsgReceivedCounter(rc.RemoteId)
	}

	err := json.NewEncoder(w).Encode(ping)
	if err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func remoteClusterAcceptMessage(c *Context, w http.ResponseWriter, r *http.Request) {
	// make sure remote cluster service is running.
	service, appErr := c.App.GetRemoteClusterService()
	if appErr != nil {
		c.Err = appErr
		return
	}

	var frame model.RemoteClusterFrame
	if err := json.NewDecoder(r.Body).Decode(&frame); err != nil {
		c.Err = model.NewAppError("remoteClusterAcceptMessage", "api.unmarshal_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	appErr = frame.IsValid()
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventRemoteClusterAcceptMessage, model.AuditStatusFail)
	model.AddEventParameterAuditableToAuditRec(auditRec, "remote_cluster_frame", &frame)
	defer c.LogAuditRec(auditRec)

	remoteId := c.GetRemoteID(r)
	if remoteId != frame.RemoteId {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	rc, appErr := c.App.GetRemoteCluster(frame.RemoteId, false)
	if appErr != nil {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}
	model.AddEventParameterAuditableToAuditRec(auditRec, "remote_cluster", rc)

	// pass message to Remote Cluster Service and write response
	resp := service.ReceiveIncomingMsg(rc, frame.Msg)

	b, err := json.Marshal(resp)
	if err != nil {
		c.Err = model.NewAppError("remoteClusterAcceptMessage", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func remoteClusterConfirmInvite(c *Context, w http.ResponseWriter, r *http.Request) {
	// make sure remote cluster service is running.
	rcs, appErr := c.App.GetRemoteClusterService()
	if appErr != nil {
		c.Err = appErr
		return
	}

	var frame model.RemoteClusterFrame
	if jsonErr := json.NewDecoder(r.Body).Decode(&frame); jsonErr != nil {
		c.Err = model.NewAppError("remoteClusterConfirmInvite", "api.unmarshal_error", nil, "", http.StatusBadRequest).Wrap(jsonErr)
		return
	}

	if appErr := frame.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventRemoteClusterAcceptInvite, model.AuditStatusFail)
	model.AddEventParameterAuditableToAuditRec(auditRec, "remote_cluster_frame", &frame)
	defer c.LogAuditRec(auditRec)

	remoteId := c.GetRemoteID(r)
	if remoteId != frame.RemoteId {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	rc, err := c.App.GetRemoteCluster(frame.RemoteId, false)
	if err != nil {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}
	model.AddEventParameterAuditableToAuditRec(auditRec, "remote_cluster", rc)

	// check if the invitation has expired
	if time.Since(model.GetTimeForMillis(rc.CreateAt)) > remotecluster.InviteExpiresAfter {
		c.Err = model.NewAppError("remoteClusterAcceptMessage", "api.context.invitation_expired.error", nil, "", http.StatusBadRequest)
		return
	}

	var confirm model.RemoteClusterInvite
	if jsonErr := json.Unmarshal(frame.Msg.Payload, &confirm); jsonErr != nil {
		c.SetInvalidParam("msg.payload")
		return
	}

	if _, rcsErr := rcs.ReceiveInviteConfirmation(confirm); rcsErr != nil {
		c.Err = model.NewAppError("remoteClusterConfirmInvite", "api.command_remote.confirm_invitation.error",
			map[string]any{"Error": rcsErr.Error()}, "", http.StatusInternalServerError)
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func uploadRemoteData(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().FileSettings.EnableFileAttachments {
		c.Err = model.NewAppError("uploadRemoteData", "api.file.attachments.disabled.app_error",
			nil, "", http.StatusNotImplemented)
		return
	}

	uploadId := c.RequireParam("upload_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	uploadIdStr := uploadId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventUploadRemoteData, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "upload_id", uploadIdStr)

	c.AppContext = c.AppContext.With(app.RequestContextWithMaster)
	us, err := c.App.GetUploadSession(c.AppContext, uploadIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if us.RemoteId != c.GetRemoteID(r) {
		c.Err = model.NewAppError("uploadRemoteData", "api.context.remote_id_mismatch.app_error",
			nil, "", http.StatusUnauthorized)
		return
	}

	// Apply same security restrictions as normal upload API
	if us.Type == model.UploadTypeImport {
		c.Err = model.NewAppError("uploadRemoteData", "api.remote_cluster.import_not_allowed.app_error",
			nil, "", http.StatusBadRequest)
		return
	}

	info, err := doUploadData(c, us, r)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	if info == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if err := json.NewEncoder(w).Encode(info); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func remoteSetProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	defer func() {
		if _, err := io.Copy(io.Discard, r.Body); err != nil {
			c.Logger.Warn("Error while reading request body", mlog.Err(err))
		}
	}()
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if *c.App.Config().FileSettings.DriverName == "" {
		c.Err = model.NewAppError("remoteUploadProfileImage", "api.user.upload_profile_user.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if r.ContentLength > *c.App.Config().FileSettings.MaxFileSize {
		c.Err = model.NewAppError("remoteUploadProfileImage", "api.user.upload_profile_user.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	if err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize); err != nil {
		c.Err = model.NewAppError("remoteUploadProfileImage", "api.user.upload_profile_user.parse.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	m := r.MultipartForm
	imageArray, ok := m.File["image"]
	if !ok {
		c.Err = model.NewAppError("remoteUploadProfileImage", "api.user.upload_profile_user.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(imageArray) == 0 {
		c.Err = model.NewAppError("remoteUploadProfileImage", "api.user.upload_profile_user.array.app_error", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventRemoteUploadProfileImage, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	if imageArray[0] != nil {
		model.AddEventParameterToAuditRec(auditRec, "filename", imageArray[0].Filename)
	}

	user, err := c.App.GetUser(userIdStr)
	if err != nil || !user.IsRemote() {
		c.SetInvalidURLParam("user_id")
		return
	}

	// ensure the user being modified belongs to the remote requesting the change.
	requesterRemoteID := c.GetRemoteID(r)
	if user.GetRemoteID() != requesterRemoteID {
		c.Err = model.NewAppError("remoteSetProfileImage", "api.context.remote_id_mismatch.app_error",
			nil, "", http.StatusUnauthorized)
		return
	}

	model.AddEventParameterAuditableToAuditRec(auditRec, "user", user)

	imageData := imageArray[0]
	if err := c.App.SetProfileImage(c.AppContext, userIdStr, imageData); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}

func getRemoteClusters(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	filter := model.RemoteClusterQueryFilter{
		ExcludeOffline: c.Params["exclude_offline"].(bool),
		InChannel:      c.Params["in_channel"].(string),
		NotInChannel:   c.Params["not_in_channel"].(string),
		Topic:          c.Params["topic"].(string),
		CreatorId:      c.Params["creator_id"].(string),
		OnlyConfirmed:  c.Params["only_confirmed"].(bool),
		PluginID:       c.Params["plugin_id"].(string),
		OnlyPlugins:    c.Params["only_plugins"].(bool),
		ExcludePlugins: c.Params["exclude_plugins"].(bool),
		IncludeDeleted: c.Params["include_deleted"].(bool),
	}

	rcs, appErr := c.App.GetAllRemoteClusters(c.Params["page"].(int), c.Params["per_page"].(int), filter)
	if appErr != nil {
		c.Err = appErr
		return
	}

	for _, rc := range rcs {
		rc.Sanitize()
	}

	b, err := json.Marshal(rcs)
	if err != nil {
		c.Err = model.NewAppError("getRemoteClusters", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createRemoteCluster(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateRemoteCluster, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	var rcWithTeamAndPassword model.RemoteClusterWithPassword
	if jsonErr := json.NewDecoder(r.Body).Decode(&rcWithTeamAndPassword); jsonErr != nil {
		c.SetInvalidParamWithErr("remoteCluster", jsonErr)
		return
	}

	url := c.App.GetSiteURL()
	if url == "" {
		c.Err = model.NewAppError("createRemoteCluster", "api.get_site_url_error", nil, "", http.StatusUnprocessableEntity)
		return
	}

	if rcWithTeamAndPassword.DefaultTeamId == "" {
		c.SetInvalidParam("remote_cluster.default_team_id")
		return
	}

	if rcWithTeamAndPassword.DisplayName == "" {
		rcWithTeamAndPassword.DisplayName = rcWithTeamAndPassword.Name
	}

	token := model.NewId()
	rc := &model.RemoteCluster{
		Name:          rcWithTeamAndPassword.Name,
		DisplayName:   rcWithTeamAndPassword.DisplayName,
		SiteURL:       model.SiteURLPending + model.NewId(),
		DefaultTeamId: rcWithTeamAndPassword.DefaultTeamId,
		Token:         token,
		CreatorId:     c.AppContext.Session().UserId,
	}

	model.AddEventParameterAuditableToAuditRec(auditRec, "remotecluster", rc)

	rcSaved, appErr := c.App.AddRemoteCluster(rc)
	if appErr != nil {
		c.Err = appErr
		return
	}
	rcSaved.Sanitize()

	password := rcWithTeamAndPassword.Password
	if password == "" {
		password = utils.SecureRandString(16)
	}

	inviteCode, iErr := c.App.CreateRemoteClusterInvite(rcSaved.RemoteId, url, token, password)
	if iErr != nil {
		c.Err = iErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(rcSaved)
	auditRec.AddEventObjectType("remotecluster")

	resp := model.RemoteClusterWithInvite{RemoteCluster: rcSaved, Invite: inviteCode}
	if rcWithTeamAndPassword.Password == "" {
		resp.Password = password
	}

	b, err := json.Marshal(resp)
	if err != nil {
		c.Err = model.NewAppError("createRemoteCluster", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func remoteClusterAcceptInvite(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	// make sure remote cluster service is enabled.
	rcs, appErr := c.App.GetRemoteClusterService()
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventRemoteClusterAcceptInvite, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	var rcAcceptInvite model.RemoteClusterAcceptInvite
	if jsonErr := json.NewDecoder(r.Body).Decode(&rcAcceptInvite); jsonErr != nil {
		c.SetInvalidParamWithErr("remoteCluster", jsonErr)
		return
	}

	if rcAcceptInvite.DefaultTeamId == "" {
		c.SetInvalidParam("remoteCluster.default_team_id")
		return
	}

	if _, teamErr := c.App.GetTeam(rcAcceptInvite.DefaultTeamId); teamErr != nil {
		c.SetInvalidParamWithErr("remoteCluster.default_team_id", teamErr)
		return
	}

	model.AddEventParameterToAuditRec(auditRec, "name", rcAcceptInvite.Name)
	model.AddEventParameterToAuditRec(auditRec, "display_name", rcAcceptInvite.DisplayName)

	if rcAcceptInvite.DisplayName == "" {
		rcAcceptInvite.DisplayName = rcAcceptInvite.Name
	}

	invite, dErr := c.App.DecryptRemoteClusterInvite(rcAcceptInvite.Invite, rcAcceptInvite.Password)
	if dErr != nil {
		c.Err = dErr
		return
	}

	model.AddEventParameterToAuditRec(auditRec, "site_url", invite.SiteURL)

	url := c.App.GetSiteURL()
	if url == "" {
		c.Err = model.NewAppError("remoteClusterAcceptInvite", "api.get_site_url_error", nil, "", http.StatusUnprocessableEntity)
		return
	}

	rc, aErr := rcs.AcceptInvitation(invite, rcAcceptInvite.Name, rcAcceptInvite.DisplayName, c.AppContext.Session().UserId, url, rcAcceptInvite.DefaultTeamId)
	if aErr != nil {
		c.Err = model.NewAppError("remoteClusterAcceptInvite", "api.remote_cluster.accept_invitation_error", nil, "", http.StatusInternalServerError).Wrap(aErr)
		if appErr, ok := aErr.(*model.AppError); ok {
			c.Err = appErr
		}
		return
	}
	rc.Sanitize()

	auditRec.Success()
	auditRec.AddEventResultState(rc)
	auditRec.AddEventObjectType("remotecluster")

	b, err := json.Marshal(rc)
	if err != nil {
		c.Err = model.NewAppError("remoteClusterAcceptInvite", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func generateRemoteClusterInvite(c *Context, w http.ResponseWriter, r *http.Request) {
	remoteId := c.RequireParam("remote_id", web.RequireString)
	if c.Err != nil {
		return
	}
	remoteIdStr := remoteId.(string)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGenerateRemoteClusterInvite, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "remote_id", remoteIdStr)

	props := model.MapFromJSON(r.Body)
	password := props["password"]
	if password == "" {
		c.SetInvalidParam("password")
		return
	}

	url := c.App.GetSiteURL()
	if url == "" {
		c.Err = model.NewAppError("generateRemoteClusterInvite", "api.get_site_url_error", nil, "", http.StatusUnprocessableEntity)
		return
	}

	rc, appErr := c.App.GetRemoteCluster(remoteIdStr, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if rc.IsConfirmed() {
		c.Err = model.NewAppError("generateRemoteClusterInvite", "api.remote_cluster.generate_invite_cluster_is_confirmed", nil, "", http.StatusBadRequest)
		return
	}

	inviteCode, invErr := c.App.CreateRemoteClusterInvite(rc.RemoteId, url, rc.Token, password)
	if invErr != nil {
		c.Err = invErr
		return
	}

	auditRec.Success()

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(inviteCode); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getRemoteCluster(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	remoteId := c.RequireParam("remote_id", web.RequireString)
	if c.Err != nil {
		return
	}
	remoteIdStr := remoteId.(string)

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	rc, err := c.App.GetRemoteCluster(remoteIdStr, true)
	if err != nil {
		c.Err = err
		return
	}
	rc.Sanitize()

	if err := json.NewEncoder(w).Encode(rc); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchRemoteCluster(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	remoteId := c.RequireParam("remote_id", web.RequireString)
	if c.Err != nil {
		return
	}
	remoteIdStr := remoteId.(string)

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	var patch model.RemoteClusterPatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&patch); jsonErr != nil {
		c.SetInvalidParamWithErr("remotecluster", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchRemoteCluster, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "remote_id", remoteIdStr)
	model.AddEventParameterAuditableToAuditRec(auditRec, "remotecluster_patch", &patch)
	defer c.LogAuditRec(auditRec)

	orc, err := c.App.GetRemoteCluster(remoteIdStr, false)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventPriorState(orc)
	auditRec.AddEventObjectType("remotecluster")

	updatedRC, err := c.App.PatchRemoteCluster(remoteIdStr, &patch)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedRC)

	if err := json.NewEncoder(w).Encode(updatedRC); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteRemoteCluster(c *Context, w http.ResponseWriter, r *http.Request) {
	remoteId := c.RequireParam("remote_id", web.RequireString)
	if c.Err != nil {
		return
	}
	remoteIdStr := remoteId.(string)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteRemoteCluster, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "remote_id", remoteIdStr)
	defer c.LogAuditRec(auditRec)

	orc, err := c.App.GetRemoteCluster(remoteIdStr, false)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventPriorState(orc)
	auditRec.AddEventObjectType("remotecluster")

	deleted, err := c.App.DeleteRemoteCluster(remoteIdStr)
	if err != nil {
		c.Err = err
		return
	}
	if !deleted {
		c.Err = model.NewAppError("deleteRemoteCluster", "api.remote_cluster.cluster_not_deleted", nil, "", http.StatusInternalServerError)
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
