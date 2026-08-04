// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

// WebSocket event names broadcast by the calls service to call participants.
//
// These mirror the protocol spoken by the Mattermost Calls webapp frontend so
// the same client code can be reused. Events are published through the shared
// websocket hub with a "custom_calls_" prefix and scoped via
// model.WebsocketBroadcast (channel-scoped for group events, user/connection
// scoped for unicast signaling).
const (
	// eventSignal is the unicast SDP/ICE relay event.
	eventSignal = "signal"

	eventUserJoined      = "user_joined"
	eventUserLeft        = "user_left"
	eventUserMuted       = "user_muted"
	eventUserUnmuted     = "user_unmuted"
	eventUserVoiceOn     = "user_voice_on"
	eventUserVoiceOff    = "user_voice_off"
	eventUserScreenOn    = "user_screen_on"
	eventUserScreenOff   = "user_screen_off"
	eventUserVideoOn     = "user_video_on"
	eventUserVideoOff    = "user_video_off"
	eventCallStart       = "call_start"
	eventCallState       = "call_state"
	eventCallEnd         = "call_end"
	eventUserRaiseHand   = "user_raise_hand"
	eventUserUnraiseHand = "user_unraise_hand"
	eventUserReacted     = "user_reacted"
	eventJoin            = "join"
	eventError           = "error"
	eventCallHostChanged = "call_host_changed"
	eventCallJobState    = "call_job_state"
	eventHostMute        = "host_mute"
	eventHostScreenOff   = "host_screen_off"
	eventHostLowerHand   = "host_lower_hand"
	eventHostRemoved     = "host_removed"
)

// Incoming client message types — the actions a browser sends over its
// websocket to the calls service. These are the signaling protocol.
const (
	msgJoin        = "join"
	msgLeave       = "leave"
	msgReconnect   = "reconnect"
	msgSDP         = "sdp"
	msgICE         = "ice"
	msgMute        = "mute"
	msgUnmute      = "unmute"
	msgVoiceOn     = "voice_on"
	msgVoiceOff    = "voice_off"
	msgScreenOn    = "screen_on"
	msgScreenOff   = "screen_off"
	msgVideoOn     = "video_on"
	msgVideoOff    = "video_off"
	msgRaiseHand   = "raise_hand"
	msgUnraiseHand = "unraise_hand"
	msgReact       = "react"
	msgCaption     = "caption"
	msgMetric      = "metric"
	msgCallState   = "call_state"
)

// validMsgTypes is the set of recognized incoming message types.
var validMsgTypes = map[string]bool{
	msgJoin: true, msgLeave: true, msgReconnect: true,
	msgSDP: true, msgICE: true,
	msgMute: true, msgUnmute: true,
	msgVoiceOn: true, msgVoiceOff: true,
	msgScreenOn: true, msgScreenOff: true,
	msgVideoOn: true, msgVideoOff: true,
	msgRaiseHand: true, msgUnraiseHand: true,
	msgReact: true, msgCaption: true, msgMetric: true,
	msgCallState: true,
	"ping":       true, // standard keepalive
}

func isValidMsgType(t string) bool { return validMsgTypes[t] }

// wsReconnectionTimeout is how long a client may be transiently disconnected
// before its session is torn down.
const wsReconnectionTimeout = 10 // seconds; matches the plugin's constant
