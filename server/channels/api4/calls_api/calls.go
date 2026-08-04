// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package callsapi

import (
	"encoding/json"
	"errors"
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
//	POST   /calls/channels/{channel_id}              start (or reuse) a call
//	GET    /calls/channels/{channel_id}              get active call for channel
//	GET    /calls/{call_id}                          get call state
//	DELETE /calls/{call_id}                          end a call
func (a *CallsAPI) InitCalls() {
	r := a.api
	base := a.routes.Calls

	base.Method(http.MethodPost, "/channels/{channel_id:[A-Za-z0-9]+}", r.APISessionRequired(startCall))
	base.Method(http.MethodGet, "/channels/{channel_id:[A-Za-z0-9]+}", r.APISessionRequired(getCallByChannel))
	base.Method(http.MethodGet, "/{call_id:[A-Za-z0-9]+}", r.APISessionRequired(getCall))
	base.Method(http.MethodDelete, "/{call_id:[A-Za-z0-9]+}", r.APISessionRequired(endCall))
}

// startCallRequest is the body for POST /calls/channels/{channel_id}.
type startCallRequest struct {
	PostID string `json:"post_id,omitempty"`
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

	var body startCallRequest
	_ = json.NewDecoder(r.Body).Decode(&body) // body optional

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

	// The active call for a channel is keyed by channel; reuse StartCall's keying.
	callID := calls.CallIDForChannel(channelID)
	state, err := c.App.Calls().GetCallState(callID)
	if err != nil {
		c.Err = callsToAppError(err)
		return
	}

	if err := json.NewEncoder(w).Encode(state); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getCall(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	callID := c.RequireParam("call_id", web.RequireValidId)
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
	callID := c.RequireParam("call_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	// Resolve the channel to check the caller may end the call. Channel members
	// can end; in production you may restrict this to the call owner/host.
	state, err := c.App.Calls().GetCallState(callID)
	if err != nil {
		c.Err = callsToAppError(err)
		return
	}
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), state.ChannelID, model.PermissionReadChannel); !ok {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	if err := c.App.Calls().EndCall(callID); err != nil {
		c.Err = callsToAppError(err)
		return
	}

	api4.ReturnStatusOK(w)
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
	case errors.Is(err, calls.ErrCallEnded):
		return model.NewAppError("calls", "app.calls.ended.app_error", nil, err.Error(), http.StatusBadRequest)
	case errors.Is(err, calls.ErrMaxParticipants):
		return model.NewAppError("calls", "app.calls.max_participants.app_error", nil, err.Error(), http.StatusForbidden)
	case errors.Is(err, calls.ErrNoSFUHost):
		return model.NewAppError("calls", "app.calls.no_sfu_host.app_error", nil, err.Error(), http.StatusServiceUnavailable)
	default:
		return model.NewAppError("calls", "app.calls.internal_error", nil, err.Error(), http.StatusInternalServerError)
	}
}
