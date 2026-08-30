// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package callsapi

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
)

// InitHostControls registers the host-control routes on the Calls route group.
//
// Routes (all session-required; the requester must be the current call host
// or a system admin):
//
//	POST /calls/{call_id}/host/make         {new_host_id}  transfer host role
//	POST /calls/{call_id}/host/mute         {session_id}   mute a participant
//	POST /calls/{call_id}/host/mute-others                 mute everyone else
//	POST /calls/{call_id}/host/screen-off   {session_id}   stop a screen share
//	POST /calls/{call_id}/host/lower-hand   {session_id}   lower a raised hand
//	POST /calls/{call_id}/host/remove       {session_id}   remove a participant
//	POST /calls/{call_id}/host/end                         end call for all
func (a *CallsAPI) InitHostControls() {
	r := a.api
	base := a.routes.Calls

	base.Method(http.MethodPost, "/{call_id:[A-Za-z0-9:]+}/host/make", r.APISessionRequired(hostMake))
	base.Method(http.MethodPost, "/{call_id:[A-Za-z0-9:]+}/host/mute", r.APISessionRequired(hostMute))
	base.Method(http.MethodPost, "/{call_id:[A-Za-z0-9:]+}/host/mute-others", r.APISessionRequired(hostMuteOthers))
	base.Method(http.MethodPost, "/{call_id:[A-Za-z0-9:]+}/host/screen-off", r.APISessionRequired(hostScreenOff))
	base.Method(http.MethodPost, "/{call_id:[A-Za-z0-9:]+}/host/lower-hand", r.APISessionRequired(hostLowerHand))
	base.Method(http.MethodPost, "/{call_id:[A-Za-z0-9:]+}/host/remove", r.APISessionRequired(hostRemove))
	base.Method(http.MethodPost, "/{call_id:[A-Za-z0-9:]+}/host/end", r.APISessionRequired(hostEnd))
}

// hostControlRequest is the shared body for host-control actions.
type hostControlRequest struct {
	SessionID string `json:"sessionID,omitempty"`
	NewHostID string `json:"newHostID,omitempty"`
}

// resolveHostAction parses the call id and optional body. Authorization is
// enforced by the service (current host) — with a system-admin bypass
// resolved via requesterFor below. A malformed body is rejected.
func resolveHostAction(c *api4.Context, r *http.Request) (string, hostControlRequest, bool) {
	callID := c.RequireParam("call_id", requireCallID)
	if c.Err != nil {
		return "", hostControlRequest{}, false
	}

	var body hostControlRequest
	if err := decodeOptionalJSON(r, &body); err != nil {
		c.Err = model.NewAppError("resolveHostAction", "api.calls.invalid_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return "", hostControlRequest{}, false
	}
	return callID, body, true
}

func hostMake(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	callID, body, ok := resolveHostAction(c, r)
	if !ok {
		return
	}

	if err := c.App.Calls().MakeHost(callID, requesterFor(c, callID), body.NewHostID); err != nil {
		c.Err = callsToAppError(err)
		return
	}
	returnStatusOK(w, c)
}

func hostMute(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	callID, body, ok := resolveHostAction(c, r)
	if !ok {
		return
	}

	if err := c.App.Calls().MuteSession(callID, requesterFor(c, callID), body.SessionID); err != nil {
		c.Err = callsToAppError(err)
		return
	}
	returnStatusOK(w, c)
}

func hostMuteOthers(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	callID, _, ok := resolveHostAction(c, r)
	if !ok {
		return
	}

	if err := c.App.Calls().MuteOthers(callID, requesterFor(c, callID)); err != nil {
		c.Err = callsToAppError(err)
		return
	}
	returnStatusOK(w, c)
}

func hostScreenOff(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	callID, body, ok := resolveHostAction(c, r)
	if !ok {
		return
	}

	if err := c.App.Calls().ScreenOff(callID, requesterFor(c, callID), body.SessionID); err != nil {
		c.Err = callsToAppError(err)
		return
	}
	returnStatusOK(w, c)
}

func hostLowerHand(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	callID, body, ok := resolveHostAction(c, r)
	if !ok {
		return
	}

	if err := c.App.Calls().LowerHand(callID, requesterFor(c, callID), body.SessionID); err != nil {
		c.Err = callsToAppError(err)
		return
	}
	returnStatusOK(w, c)
}

func hostRemove(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	callID, body, ok := resolveHostAction(c, r)
	if !ok {
		return
	}

	if err := c.App.Calls().RemoveSession(callID, requesterFor(c, callID), body.SessionID); err != nil {
		c.Err = callsToAppError(err)
		return
	}
	returnStatusOK(w, c)
}

func hostEnd(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	callID, _, ok := resolveHostAction(c, r)
	if !ok {
		return
	}

	if err := c.App.Calls().EndCallByHost(callID, requesterFor(c, callID)); err != nil {
		c.Err = callsToAppError(err)
		return
	}
	returnStatusOK(w, c)
}

// requesterFor returns the acting user id. System admins may act on any
// call: when the admin is not the host, the service admits them via the
// call's current host id resolved from state.
func requesterFor(c *api4.Context, callID string) string {
	userID := c.AppContext.Session().UserId
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		if state, err := c.App.Calls().GetCallState(callID); err == nil && state != nil && state.HostSessionID != "" {
			for _, sess := range state.Sessions {
				if sess.ID == state.HostSessionID {
					return sess.UserID
				}
			}
		}
	}
	return userID
}

// returnStatusOK writes the standard {"status": "OK"} response.
func returnStatusOK(w http.ResponseWriter, c *api4.Context) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]string{"status": "OK"}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
