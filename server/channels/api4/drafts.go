package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitDrafts() {
	api.BaseRoutes.Drafts.Method(http.MethodPost, "/", api.APISessionRequired(upsertDraft))
	api.BaseRoutes.TeamForUser.Method(http.MethodGet, "/drafts", api.APISessionRequired(getDrafts))
	api.BaseRoutes.ChannelForUser.Method(http.MethodDelete, "/drafts/{thread_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteDraft))
	api.BaseRoutes.ChannelForUser.Method(http.MethodDelete, "/drafts", api.APISessionRequired(deleteDraft))
}

func upsertDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.AllowSyncedDrafts {
		c.Err = model.NewAppError("upsertDraft", "api.drafts.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	var draft model.Draft
	if jsonErr := json.NewDecoder(r.Body).Decode(&draft); jsonErr != nil {
		c.SetInvalidParam("draft")
		return
	}

	draft.DeleteAt = 0
	draft.UserId = c.AppContext.Session().UserId
	connectionID := r.Header.Get(model.ConnectionId)

	hasPermission := false

	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), draft.ChannelId, model.PermissionCreatePost); ok {
		hasPermission = true
	} else if channel, err := c.App.GetChannel(c.AppContext, draft.ChannelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.ChannelTypeOpen && c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionCreatePostPublic) {
			hasPermission = true
		}
	}

	if !hasPermission {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	dt, err := c.App.UpsertDraft(c.AppContext, &draft, connectionID)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)

	if err := json.NewEncoder(w).Encode(dt); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getDrafts(c *Context, w http.ResponseWriter, r *http.Request) {
	teamIdStr := c.RequireParam("team_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !*c.App.Config().ServiceSettings.AllowSyncedDrafts {
		c.Err = model.NewAppError("getDrafts", "api.drafts.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	hasPermission := false

	if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamIdStr, model.PermissionViewTeam) {
		hasPermission = true
	}

	if !hasPermission {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	drafts, err := c.App.GetDraftsForUser(c.AppContext, c.AppContext.Session().UserId, teamIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(drafts); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	channelIdStr := c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	if !*c.App.Config().ServiceSettings.AllowSyncedDrafts {
		c.Err = model.NewAppError("deleteDraft", "api.drafts.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)
	rootId := ""

	userID := c.AppContext.Session().UserId

	if threadId, ok := c.Params["thread_id"]; ok && threadId.(string) != "" {
		rootId = threadId.(string)
	}

	draft, err := c.App.GetDraft(userID, channelIdStr, rootId)
	if err != nil {
		switch err.StatusCode {
		case http.StatusNotFound:
			// If the draft doesn't exist in the server, we don't need to delete.
			ReturnStatusOK(w)
		default:
			c.Err = err
		}
		return
	}

	if c.AppContext.Session().UserId != draft.UserId {
		c.SetPermissionError(model.PermissionDeletePost)
		return
	}

	if err := c.App.DeleteDraft(c.AppContext, draft, connectionID); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
