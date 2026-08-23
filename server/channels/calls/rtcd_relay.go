// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"fmt"

	rtcd "github.com/mattermost/rtcd/service"
	"github.com/mattermost/rtcd/service/rtc"

	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

// handleRTCDMessage is the inbound relay for messages produced by the rtcd
// SFU pool (wired as the manager's onMessage handler in Start):
//
//   - rtc SDP/ICE messages  → unicast `signal` to the originating connection
//     (the browser feeds them straight into its RTCPeerConnection).
//   - rtc VoiceOn/VoiceOff  → channel-scoped user_voice_on/off presence (VAD
//     runs ON the SFU; the browser never reports its own voice).
//   - ClientMessageClose    → the SFU closed a session (peer timeout, SFU
//     restart); run the shared session teardown.
func (s *CallService) handleRTCDMessage(host string, msg rtcd.ClientMessage) {
	switch cm := msg; cm.Type {
	case rtcd.ClientMessageRTC:
		rtcMsg, ok := cm.Data.(rtc.Message)
		if !ok {
			s.log.Error("calls: unexpected rtc message data type", mlog.Any("type", fmt.Sprintf("%T", cm.Data)))
			return
		}
		s.relayRTCMessage(rtcMsg)

	case rtcd.ClientMessageClose:
		data, ok := cm.Data.(map[string]string)
		if !ok {
			// msgpack-decoded typed maps may surface as map[string]interface{}.
			if anyData, alt := cm.Data.(map[string]any); alt {
				data = map[string]string{}
				for k, v := range anyData {
					if sv, isStr := v.(string); isStr {
						data[k] = sv
					}
				}
				ok = true
			}
		}
		if !ok {
			s.log.Error("calls: unexpected close message data type", mlog.Any("type", fmt.Sprintf("%T", cm.Data)))
			return
		}
		sessionID := data["sessionID"]
		if sessionID == "" {
			return
		}
		s.log.Debug("calls: rtcd closed session", mlog.String("sessionID", sessionID))
		if cs := s.callStateForSession(sessionID); cs != nil {
			if sess, found := cs.get(sessionID); found {
				if sess.markRTCclosed() {
					s.removeSession(cs, sess, "rtc_closed")
				}
			}
		}

	case rtcd.ClientMessageHello, rtcd.ClientMessageJoin, rtcd.ClientMessageReconnect, rtcd.ClientMessageLeave:
		// Control-plane acknowledgements; nothing to relay to browsers.
	default:
		s.log.Debug("calls: ignoring unexpected rtcd message", mlog.String("type", cm.Type))
	}
}

// relayRTCMessage fans one SFU rtc message out to the browser(s).
func (s *CallService) relayRTCMessage(rtcMsg rtc.Message) {
	switch rtcMsg.Type {
	case rtc.VoiceOnMessage, rtc.VoiceOffMessage:
		cs := s.callStateForSession(rtcMsg.SessionID)
		if cs == nil {
			return
		}
		voiceOn := rtcMsg.Type == rtc.VoiceOnMessage
		cs.mutate(rtcMsg.SessionID, func(sess *session) { sess.voiceOn = voiceOn })
		evType := eventUserVoiceOff
		if voiceOn {
			evType = eventUserVoiceOn
		}
		s.publishChannel(cs.channelID, evType, map[string]any{
			"userID":     rtcMsg.UserID,
			"session_id": rtcMsg.SessionID,
		})
	default:
		// SDP answers / ICE candidates from the SFU: unicast to the session's
		// current connection as a `signal` event.
		cs := s.callStateForSession(rtcMsg.SessionID)
		if cs == nil {
			return
		}
		sess, ok := cs.get(rtcMsg.SessionID)
		if !ok {
			return
		}
		data := rtcMsg.Data
		if data == nil {
			return
		}
		s.publishTo(eventSignal, map[string]any{
			"data": string(data),
		}, sess.connID)
	}
}

// callStateForSession resolves the live call state owning a sessionID. Session
// ids are globally unique (websocket connection ids), so a reverse scan over
// live calls is correct; the live-call count per node is small.
func (s *CallService) callStateForSession(sessionID string) *callState {
	for _, cs := range s.allCallStates() {
		if _, ok := cs.get(sessionID); ok {
			return cs
		}
	}
	return nil
}
