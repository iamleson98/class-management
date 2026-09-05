// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package callsapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/calls"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

// InitCalls registers the call lifecycle routes on the Calls route group.
//
// Routes (all session-required):
//
//	GET    /calls/config                                client calls config
//	POST   /calls/channels/{channel_id}              start (or reuse) a call
//	GET    /calls/channels/{channel_id}              get active call for channel
//	GET    /calls/{call_id}                          get call state
//	DELETE /calls/{call_id}                          end a call
func (a *CallsAPI) InitCalls() {
	r := a.api
	base := a.routes.Calls

	base.Method(http.MethodGet, "/config", r.APISessionRequired(getCallsConfig))
	base.Method(http.MethodGet, "/channels", r.APISessionRequired(getCallStates))
	base.Method(http.MethodPost, "/channels/{channel_id:[A-Za-z0-9]+}", r.APISessionRequired(startCall))
	base.Method(http.MethodGet, "/channels/{channel_id:[A-Za-z0-9]+}", r.APISessionRequired(getCallByChannel))
	base.Method(http.MethodGet, "/channels/{channel_id:[A-Za-z0-9]+}/enabled", r.APISessionRequired(getCallsChannelEnabled))
	base.Method(http.MethodPost, "/channels/{channel_id:[A-Za-z0-9]+}/enabled", r.APISessionRequired(setCallsChannelEnabled))
	base.Method(http.MethodPost, "/channels/{channel_id:[A-Za-z0-9]+}/dismiss-notification", r.APISessionRequired(dismissNotification))
	base.Method(http.MethodGet, "/{call_id:[A-Za-z0-9:]+}", r.APISessionRequired(getCall))
	base.Method(http.MethodDelete, "/{call_id:[A-Za-z0-9:]+}", r.APISessionRequired(endCall))

	// Host controls (make host / mute / screen off / lower hand / remove / end)
	a.InitHostControls()
}

// getCallsConfig returns the client-facing calls configuration used for
// frontend feature gating (mirrors the plugin's GET /config).
func getCallsConfig(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if err := json.NewEncoder(w).Encode(c.App.Calls().GetConfig()); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// startCallRequest is the body for POST /calls/channels/{channel_id}.
type startCallRequest struct {
	PostID string `json:"post_id,omitempty"`
}

// requireCallID validates the {call_id} route param. Call ids are 26-char
// model.NewId()s — the same identity convention as every other model row —
// so the standard id validator applies directly.
var requireCallID web.RequireFunc[string] = func(value any) (string, bool) {
	strValue, ok := web.RequireString(value)
	if !ok {
		return "", false
	}
	if !model.IsValidId(strValue) {
		return "", false
	}
	return strValue, true
}

// getCallStates returns every in-progress call (one request seeds the webapp's
// join buttons and toasts for all channels).
func getCallStates(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	states := c.App.Calls().GetCallStates()
	if states == nil {
		states = []calls.CallStateView{}
	}
	if err := json.NewEncoder(w).Encode(states); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func startCall(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	channelID := c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelID, model.PermissionReadChannel); !ok {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	// Per-channel preference: respect a channel-admin's calls off toggle.
	if !c.App.Calls().GetCallsChannel(channelID).Enabled {
		c.Err = callsToAppError(calls.ErrChannelCallsDisabled)
		return
	}

	var body startCallRequest
	if err := decodeOptionalJSON(r, &body); err != nil {
		c.Err = model.NewAppError("startCall", "api.calls.invalid_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	res, err := c.App.Calls().StartCall(calls.StartCallOpts{
		ChannelID: channelID,
		OwnerID:   c.AppContext.Session().UserId,
		PostID:    body.PostID,
	})
	if err != nil {
		c.Err = callsToAppError(err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(res); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getCallByChannel(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	channelID := c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelID, model.PermissionReadChannel); !ok {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	// The channel -> live-call mapping is runtime state in the service
	// (fresh NewId identities; nothing derivable from the channel id).
	state, err := c.App.Calls().GetCallStateByChannel(channelID)
	if err != nil {
		c.Err = callsToAppError(err)
		return
	}

	if err := json.NewEncoder(w).Encode(state); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getCall(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	callID := c.RequireParam("call_id", requireCallID)
	if c.Err != nil {
		return
	}

	state, err := c.App.Calls().GetCallState(callID)
	if err != nil {
		c.Err = callsToAppError(err)
		return
	}

	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), state.ChannelID, model.PermissionReadChannel); !ok {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	if err := json.NewEncoder(w).Encode(state); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func endCall(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	callID := c.RequireParam("call_id", requireCallID)
	if c.Err != nil {
		return
	}

	state, err := c.App.Calls().GetCallState(callID)
	if err != nil {
		c.Err = callsToAppError(err)
		return
	}

	// Ending a call is restricted to the current host (or a sysadmin).
	// Fallback: when no host session exists (e.g. the host dropped and the
	// call lingers), any channel member may clean it up.
	requester := c.AppContext.Session().UserId
	isAdmin := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	isHost := false
	if state.HostSessionID != "" {
		for _, sess := range state.Sessions {
			if sess.ID == state.HostSessionID && sess.UserID == requester {
				isHost = true
				break
			}
		}
	}
	if !isAdmin && !isHost && state.Participants > 0 {
		c.Err = callsToAppError(calls.ErrNotCallHost)
		return
	}
	if !isAdmin && !isHost {
		// No host and no participants: require channel membership to clean up.
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), state.ChannelID, model.PermissionReadChannel); !ok {
			c.SetPermissionError(model.PermissionReadChannel)
			return
		}
	}

	if err := c.App.Calls().EndCall(callID); err != nil {
		c.Err = callsToAppError(err)
		return
	}

	api4.ReturnStatusOK(w)
}

// getCallsChannelEnabled returns the per-channel calls configuration.
func getCallsChannelEnabled(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	channelID := c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelID, model.PermissionReadChannel); !ok {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}
	if err := json.NewEncoder(w).Encode(c.App.Calls().GetCallsChannel(channelID)); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// setCallsChannelEnabledRequest is the body for POST /calls/channels/{id}/enabled.
type setCallsChannelEnabledRequest struct {
	Enabled bool `json:"enabled"`
}

// setCallsChannelEnabled enables/disables calls for one channel. Requires
// channel-management permission for public/private channels; DM/GM members
// may always toggle their own channel.
func setCallsChannelEnabled(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	channelID := c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	session := *c.AppContext.Session()
	ch, appErr := c.App.GetChannel(c.AppContext, channelID)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if ch.Type != model.ChannelTypeDirect && ch.Type != model.ChannelTypeGroup {
		hasManage := false
		for _, perm := range []*model.Permission{model.PermissionManagePublicChannelMembers, model.PermissionManagePrivateChannelMembers} {
			if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, session, channelID, perm); ok {
				hasManage = true
				break
			}
		}
		if !hasManage && !c.App.SessionHasPermissionTo(session, model.PermissionManageSystem) {
			c.SetPermissionError(model.PermissionManagePublicChannelMembers)
			return
		}
	} else {
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, session, channelID, model.PermissionReadChannel); !ok {
			c.SetPermissionError(model.PermissionReadChannel)
			return
		}
	}

	var body setCallsChannelEnabledRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		body.Enabled = true
	}

	if err := c.App.Calls().SetCallsChannelEnabled(channelID, body.Enabled, session.UserId); err != nil {
		c.Err = callsToAppError(err)
		return
	}
	returnStatusOK(w, c)
}

// dismissNotification syncs an incoming-call dismissal to the user's other
// connected devices (user_dismissed_notification broadcast).
func dismissNotification(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	channelID := c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	if err := c.App.Calls().DismissNotification(channelID, c.AppContext.Session().UserId); err != nil {
		c.Err = callsToAppError(err)
		return
	}
	returnStatusOK(w, c)
}

// decodeOptionalJSON decodes an optional JSON request body into v. An empty
// body (or none at all) leaves v untouched; malformed JSON is an error so
// callers never act on silently-swallowed input.
func decodeOptionalJSON(r *http.Request, v any) error {
	if r.Body == nil {
		return nil
	}
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(v); err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	return nil
}

// callsToAppError maps a calls service error to an AppError with an
// appropriate HTTP status.
func callsToAppError(err error) *model.AppError {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, calls.ErrCallsDisabled):
		return model.NewAppError("calls", "app.calls.disabled.app_error", nil, err.Error(), http.StatusForbidden)
	case errors.Is(err, calls.ErrCallNotFound):
		return model.NewAppError("calls", "app.calls.not_found.app_error", nil, err.Error(), http.StatusNotFound)
	case errors.Is(err, calls.ErrSessionNotFound):
		return model.NewAppError("calls", "app.calls.session_not_found.app_error", nil, err.Error(), http.StatusNotFound)
	case errors.Is(err, calls.ErrCallEnded):
		return model.NewAppError("calls", "app.calls.ended.app_error", nil, err.Error(), http.StatusBadRequest)
	case errors.Is(err, calls.ErrMaxParticipants):
		return model.NewAppError("calls", "app.calls.max_participants.app_error", nil, err.Error(), http.StatusForbidden)
	case errors.Is(err, calls.ErrChannelCallsDisabled):
		return model.NewAppError("calls", "app.calls.channel_disabled.app_error", nil, err.Error(), http.StatusForbidden)
	case errors.Is(err, calls.ErrNotCallHost):
		return model.NewAppError("calls", "app.calls.not_host.app_error", nil, err.Error(), http.StatusForbidden)
	case errors.Is(err, calls.ErrNoSFUHost):
		return model.NewAppError("calls", "app.calls.no_sfu_host.app_error", nil, err.Error(), http.StatusServiceUnavailable)
	case errors.Is(err, calls.ErrNotCallHost):
		return model.NewAppError("calls", "app.calls.not_host.app_error", nil, err.Error(), http.StatusForbidden)
	default:
		return model.NewAppError("calls", "app.calls.internal_error", nil, err.Error(), http.StatusInternalServerError)
	}
}
