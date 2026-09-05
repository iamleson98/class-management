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
//   - "rtc" (SDP/ICE) and "vad" (voice-activity) messages → routed to the
//     relay: answers/candidates unicast to the originating connection, VAD
//     becomes user_voice_on/off presence. Both envelope types carry an
//     rtc.Message payload (see rtcd's client_msg codec).
//   - ClientMessageClose    → the SFU closed a session (peer timeout, SFU
//     restart); run the shared session teardown.
func (s *CallService) handleRTCDMessage(host string, msg rtcd.ClientMessage) {
	switch cm := msg; cm.Type {
	case rtcd.ClientMessageRTC, rtcd.ClientMessageVAD:
		rtcMsg, ok := cm.Data.(rtc.Message)
		if !ok {
			s.log.Error("calls: unexpected rtc message data type",
				mlog.String("host", host), mlog.String("type", fmt.Sprintf("%T", cm.Data)))
			return
		}
		s.relayRTCMessage(rtcMsg)

	case rtcd.ClientMessageClose:
		data, ok := closeMessageData(cm.Data)
		if !ok {
			s.log.Error("calls: unexpected close message data type",
				mlog.String("host", host), mlog.String("type", fmt.Sprintf("%T", cm.Data)))
			return
		}
		sessionID := data["sessionID"]
		if sessionID == "" {
			return
		}
		s.log.Debug("calls: rtcd closed session",
			mlog.String("host", host), mlog.String("sessionID", sessionID))
		if cs := s.index.bySessionID(sessionID); cs != nil {
			if sess, found := cs.get(sessionID); found {
				if sess.markRTCclosed() {
					s.teardownSession(cs, sess, reasonRTCClosed)
				}
			}
		}

	case rtcd.ClientMessageHello, rtcd.ClientMessageJoin, rtcd.ClientMessageReconnect, rtcd.ClientMessageLeave:
		// Control-plane acknowledgements; nothing to relay to browsers.
	default:
		s.log.Debug("calls: ignoring unexpected rtcd message",
			mlog.String("host", host), mlog.String("type", cm.Type))
	}
}

// closeMessageData extracts the sessionID map from a ClientMessageClose
// payload. Depending on the codec path the map arrives typed
// (map[string]string) or generic (map[string]any, e.g. msgpack-decoded).
func closeMessageData(data any) (map[string]string, bool) {
	switch v := data.(type) {
	case map[string]string:
		return v, true
	case map[string]any:
		out := make(map[string]string, len(v))
		for k, val := range v {
			if sv, isStr := val.(string); isStr {
				out[k] = sv
			}
		}
		return out, true
	default:
		return nil, false
	}
}

// relayRTCMessage fans one SFU rtc message out to the browser(s).
func (s *CallService) relayRTCMessage(rtcMsg rtc.Message) {
	switch rtcMsg.Type {
	case rtc.VoiceOnMessage, rtc.VoiceOffMessage:
		cs := s.index.bySessionID(rtcMsg.SessionID)
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
		// current connection as a `signal` event (payload keys match the
		// plugin contract: data blob + originating connID).
		cs := s.index.bySessionID(rtcMsg.SessionID)
		if cs == nil {
			return
		}
		if rtcMsg.Data == nil {
			return
		}
		s.publishTo(eventSignal, map[string]any{
			"data":   string(rtcMsg.Data),
			"connID": rtcMsg.SessionID,
		}, cs.connIDFor(rtcMsg.SessionID))
	}
}
