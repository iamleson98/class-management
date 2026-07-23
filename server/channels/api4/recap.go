package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/app"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitRecap() {
	api.BaseRoutes.Recaps.Method(http.MethodPost, "/", api.APISessionRequired(createRecap))
	api.BaseRoutes.Recaps.Method(http.MethodGet, "/", api.APISessionRequired(getRecaps))
	api.BaseRoutes.Recaps.Method(http.MethodGet, "/{recap_id:[A-Za-z0-9]+}", api.APISessionRequired(getRecap))
	api.BaseRoutes.Recaps.Method(http.MethodPost, "/{recap_id:[A-Za-z0-9]+}/read", api.APISessionRequired(markRecapAsRead))
	api.BaseRoutes.Recaps.Method(http.MethodPost, "/{recap_id:[A-Za-z0-9]+}/regenerate", api.APISessionRequired(regenerateRecap))
	api.BaseRoutes.Recaps.Method(http.MethodDelete, "/{recap_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteRecap))
}

func requireRecapsEnabled(c *Context) {
	if !c.App.Config().FeatureFlags.EnableAIRecaps {
		c.Err = model.NewAppError("requireRecapsEnabled", "api.recap.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}
}

// addRecapChannelIDsToAuditRec extracts channel IDs from a recap and adds them to the audit record.
// This logs which channels' content was accessed through the recap operation.
func addRecapChannelIDsToAuditRec(auditRec *model.AuditRecord, recap *model.Recap) {
	if len(recap.Channels) == 0 {
		return
	}
	channelIDs := make([]string, 0, len(recap.Channels))
	for _, channel := range recap.Channels {
		channelIDs = append(channelIDs, channel.ChannelId)
	}
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", channelIDs)
}

func createRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	var req model.CreateRecapRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	if len(req.ChannelIds) == 0 {
		c.SetInvalidParam("channel_ids")
		return
	}

	if req.Title == "" {
		c.SetInvalidParam("title")
		return
	}

	if req.AgentID == "" {
		c.SetInvalidParam("agent_id")
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("recap")
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", req.ChannelIds)
	model.AddEventParameterToAuditRec(auditRec, "title", req.Title)
	model.AddEventParameterToAuditRec(auditRec, "agent_id", req.AgentID)

	recap, err := c.App.CreateRecap(c.AppContext, req.Title, req.ChannelIds, req.AgentID)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(recap)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(recap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func getRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	recapId := c.RequireParam("recap_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	recapIdStr := recapId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventGetRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("recap")
	model.AddEventParameterToAuditRec(auditRec, "recap_id", recapIdStr)

	recap, err := c.App.GetRecap(c.AppContext, recapIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if recap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("getRecap", "api.recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	// Log channel IDs accessed through viewing this recap summary
	addRecapChannelIDsToAuditRec(auditRec, recap)

	auditRec.Success()
	auditRec.AddEventResultState(recap)

	if err := json.NewEncoder(w).Encode(recap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func getRecaps(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetRecaps, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelAPI)
	model.AddEventParameterToAuditRec(auditRec, "page", c.Params["page"].(int))
	model.AddEventParameterToAuditRec(auditRec, "per_page", c.Params["per_page"].(int))

	recaps, err := c.App.GetRecapsForUser(c.AppContext, c.Params["page"].(int), c.Params["per_page"].(int))
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	if len(recaps) > 0 {
		auditRec.AddMeta("recap_count", len(recaps))
	}

	if err := json.NewEncoder(w).Encode(recaps); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func markRecapAsRead(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	recapId := c.RequireParam("recap_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	recapIdStr := recapId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventMarkRecapAsRead, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("recap")
	model.AddEventParameterToAuditRec(auditRec, "recap_id", recapIdStr)

	// Check permissions
	recap, err := c.App.GetRecap(c.AppContext, recapIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if recap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("markRecapAsRead", "api.recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	auditRec.AddEventPriorState(recap)

	updatedRecap, err := c.App.MarkRecapAsRead(c.AppContext, recap)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedRecap)

	if err := json.NewEncoder(w).Encode(updatedRecap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func regenerateRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	recapId := c.RequireParam("recap_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	recapIdStr := recapId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventRegenerateRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("recap")
	model.AddEventParameterToAuditRec(auditRec, "recap_id", recapIdStr)

	// Check permissions
	recap, err := c.App.GetRecap(c.AppContext, recapIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if recap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("regenerateRecap", "api.recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	// Log channel IDs that will be re-summarized
	addRecapChannelIDsToAuditRec(auditRec, recap)

	auditRec.AddEventPriorState(recap)

	updatedRecap, err := c.App.RegenerateRecap(c.AppContext, c.AppContext.Session().UserId, recap)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedRecap)

	if err := json.NewEncoder(w).Encode(updatedRecap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func deleteRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	recapId := c.RequireParam("recap_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	recapIdStr := recapId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("recap")
	model.AddEventParameterToAuditRec(auditRec, "recap_id", recapIdStr)

	// Check permissions
	recap, err := c.App.GetRecap(c.AppContext, recapIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if recap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("deleteRecap", "api.recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	auditRec.AddEventPriorState(recap)

	if err := c.App.DeleteRecap(c.AppContext, recapIdStr); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
