// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"strings"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/channels/app/platform"
)

// Native Calls websocket intake.
//
// The browser speaks the plugin-compatible protocol over the shared chat
// websocket: actions named custom_calls_<type> (join, leave, sdp, ice, mute,
// ...). platform.WebConn routes custom_-prefixed messages to plugins only,
// EXCEPT when a native handler is registered for the exact action (see
// platform/web_conn.go), which is what this file does: it registers a handler
// per action that resolves the connection + session and forwards to
// App.Calls().HandleClientMessage.
//
// Unlike APIWebSocketHandler (which drops the connection identity), the
// handler below receives the *platform.WebConn directly — the connection id
// IS the participant's call session id, so it must be preserved.

// callsActionPrefix is the product namespace the browser sends.
const callsActionPrefix = "custom_calls_"

// callsWSHandler serves one custom_calls_* action with full connection
// context (implements platform's unexported webSocketHandler interface).
type callsWSHandler struct {
	app *App
	fn  func(conn *platform.WebConn, req *model.WebSocketRequest)
}

func (h callsWSHandler) ServeWebSocket(conn *platform.WebConn, req *model.WebSocketRequest) {
	h.fn(conn, req)
}

func (api *API) InitCalls() {
	register := func(action string, fn func(conn *platform.WebConn, req *model.WebSocketRequest)) {
		api.Router.Handle(callsActionPrefix+action, callsWSHandler{app: api.App, fn: fn})
	}

	// Channel-scoped actions carry channelID; membership is verified here.
	register("join", api.callsWithChannelPermission(api.callsForward))
	register("call_state", api.callsWithChannelPermission(api.callsForward))

	// Connection-scoped actions resolve the (already-joined) session by
	// connection id inside the service.
	register("leave", api.callsForward)
	register("reconnect", api.callsForward)
	register("sdp", api.callsForward)
	register("ice", api.callsForward)
	register("mute", api.callsForward)
	register("unmute", api.callsForward)
	register("screen_on", api.callsForward)
	register("screen_off", api.callsForward)
	register("video_on", api.callsForward)
	register("video_off", api.callsForward)
	register("raise_hand", api.callsForward)
	register("unraise_hand", api.callsForward)
}

// callsForward resolves the connection's session and forwards the message to
// the native calls service with the custom_calls_ prefix stripped.
func (api *API) callsForward(conn *platform.WebConn, req *model.WebSocketRequest) {
	session := conn.GetSession()
	if session == nil {
		// Fall back to resolving via the connection's auth token.
		s, err := api.App.GetSession(conn.GetSessionToken())
		if err != nil {
			return
		}
		session = s
	}
	if session.UserId == "" {
		return
	}

	action := strings.TrimPrefix(req.Action, callsActionPrefix)
	data := req.Data
	if data == nil {
		data = map[string]any{}
	}

	api.App.Calls().HandleClientMessage(conn.GetConnectionID(), session.UserId, action, data)
}

// callsWithChannelPermission wraps a handler with a channel-membership check
// (the action's data carries channelID).
func (api *API) callsWithChannelPermission(next func(conn *platform.WebConn, req *model.WebSocketRequest)) func(conn *platform.WebConn, req *model.WebSocketRequest) {
	return func(conn *platform.WebConn, req *model.WebSocketRequest) {
		channelID, _ := req.Data["channelID"].(string)
		if channelID == "" {
			return
		}
		session := conn.GetSession()
		if session == nil {
			s, err := api.App.GetSession(conn.GetSessionToken())
			if err != nil {
				return
			}
			session = s
		}
		if session.UserId == "" {
			return
		}
		rctx := request.EmptyContext(api.App.Log())
		if hasPermission, _ := api.App.SessionHasPermissionToChannel(rctx, *session, channelID, model.PermissionCreatePost); !hasPermission {
			return
		}
		next(conn, req)
	}
}
