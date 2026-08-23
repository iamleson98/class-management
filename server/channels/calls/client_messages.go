// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	rtcd "github.com/mattermost/rtcd/service"
	"github.com/mattermost/rtcd/service/rtc"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

// HandleClientMessage processes one inbound custom_calls_* websocket action
// from a browser connection. The action arrives WITHOUT the custom_calls_
// prefix (stripped by the wsapi layer). Errors are reported to the calling
// connection as a unicast `error` event, matching the plugin contract.
func (s *CallService) HandleClientMessage(connID, userID, action string, data map[string]any) {
	if userID == "" || connID == "" {
		return
	}

	if !isValidMsgType(action) {
		s.sendError(connID, fmt.Sprintf("calls: unknown message type %q", action))
		return
	}

	var err error
	switch action {
	case msgJoin:
		err = s.handleJoin(connID, userID, data)
	case msgLeave:
		err = s.handleLeave(connID, userID, data)
	case msgReconnect:
		err = s.handleReconnect(connID, userID, data)
	case msgSDP:
		err = s.handleRTCRelay(connID, userID, rtc.SDPMessage, data)
	case msgICE:
		err = s.handleRTCRelay(connID, userID, rtc.ICEMessage, data)
	case msgMute:
		err = s.handleMuteToggle(connID, userID, false)
	case msgUnmute:
		err = s.handleMuteToggle(connID, userID, true)
	case msgScreenOn:
		err = s.handleScreenToggle(connID, userID, true, data)
	case msgScreenOff:
		err = s.handleScreenToggle(connID, userID, false, nil)
	case msgVideoOn, msgVideoOff:
		err = s.handleVideoToggle(connID, userID, action == msgVideoOn, data)
	case msgRaiseHand, msgUnraiseHand:
		err = s.handleRaiseHand(connID, userID, action == msgRaiseHand)
	case msgCallState:
		err = s.handleCallStateRequest(connID, userID, data)
	default:
		// voice_on/voice_off originate from the SFU's VAD, never from the
		// browser; react/caption/metric are accepted and ignored for now.
		return
	}

	if err != nil {
		s.log.Debug("calls: client message handling failed",
			mlog.String("action", action), mlog.String("userID", userID), mlog.Err(err))
		s.sendError(connID, err.Error())
	}
}

// ─── Event helpers ──────────────────────────────────────────────────

// sendError reports an error to a single connection (unicast).
func (s *CallService) sendError(connID, msg string) {
	s.hub.Publish(eventError, map[string]any{
		"data":   msg,
		"connID": connID,
	}, &model.WebsocketBroadcast{ConnectionId: connID, ReliableClusterSend: true})
}

// publishTo sends an event to a single connection (unicast).
func (s *CallService) publishTo(event string, data map[string]any, connID string) {
	s.hub.Publish(event, data, &model.WebsocketBroadcast{ConnectionId: connID, ReliableClusterSend: true})
}

// publishChannel fans an event out to everyone viewing the call's channel.
func (s *CallService) publishChannel(channelID, event string, data map[string]any) {
	s.hub.Publish(event, data, &model.WebsocketBroadcast{ChannelId: channelID, ReliableClusterSend: true})
}

// sendCallState unicasts the full call state to one connection. The `call`
// payload is a JSON string, matching the plugin webapp contract.
func (s *CallService) sendCallState(cs *callState, connID string) {
	views, _ := cs.snapshot()
	state := &CallStateView{
		CallID:        cs.callID,
		ChannelID:     cs.channelID,
		StartAt:       cs.startAt,
		RTCDHost:      cs.rtcdHost,
		Sessions:      views,
		Participants:  len(views),
	}
	if hs, hostID := cs.hostSession(); hs != nil {
		state.HostSessionID = hostID
	}
	encoded, err := json.Marshal(state)
	if err != nil {
		s.log.Error("calls: failed to encode call state", mlog.Err(err))
		return
	}
	s.publishTo(eventCallState, map[string]any{"call": string(encoded)}, connID)
}

// iceServersForHost builds the ICE server list for a browser joining through a
// given rtcd host: admin-configured URLs (CallsSettings.ICEServers csv) with a
// stun:<rtcd host> fallback (rtcd runs a STUN listener).
func (s *CallService) iceServersForHost(host string) []map[string]any {
	var urls []string
	if cfg := s.callsConfig(); cfg.ICEServers != nil && *cfg.ICEServers != "" {
		for _, u := range strings.Split(*cfg.ICEServers, ",") {
			if u = strings.TrimSpace(u); u != "" {
				urls = append(urls, u)
			}
		}
	}
	if len(urls) == 0 && host != "" {
		urls = []string{"stun:" + host}
	}
	if len(urls) == 0 {
		return nil
	}
	return []map[string]any{{"urls": urls}}
}

// ─── join / leave / reconnect ───────────────────────────────────────

// handleJoin attaches a websocket connection to the channel's call. The first
// participant starts the call (persisting it and broadcasting call_start, see
// StartCall); the SFU session is registered and the joiner receives the join
// ack (with ICE servers), the full call state, and — for everyone else — a
// user_joined presence event.
func (s *CallService) handleJoin(connID, userID string, data map[string]any) error {
	channelID, _ := data["channelID"].(string)
	if channelID == "" {
		return errors.New("calls: channelID is required")
	}
	if !s.Enabled() {
		return errors.New("calls: feature is disabled")
	}

	s.mut.RLock()
	hasRTCD := s.rtcd != nil
	s.mut.RUnlock()
	if !hasRTCD {
		return errors.New("calls: rtcd service is not configured")
	}

	callID := callIDForChannel(channelID)

	if max := s.callsConfig().maxParticipants(); max > 0 {
		if existing, ok := s.shards.get(callID); ok && existing.participants() >= max {
			return ErrMaxParticipants
		}
	}

	// Reuse the in-progress call or start one (idempotent per channel).
	res, err := s.StartCall(StartCallOpts{ChannelID: channelID, OwnerID: userID})
	if err != nil {
		return err
	}
	callID = res.CallID

	cs, ok := s.shards.get(callID)
	if !ok {
		return ErrCallNotFound
	}

	// Register the participant. sessionID = the connection id at join time and
	// stays stable across websocket reconnects.
	now := model.GetMillis()
	sess := &session{
		userID:    userID,
		channelID: channelID,
		callID:    callID,
		sessionID: connID,
		connID:    connID,
		unmuted:   true,
		startAt:   now,
	}
	cs.addSession(connID, sess)

	// Persist the join boundary.
	if _, serr := s.store.CallSession().Save(&model.CallSession{
		ID:       model.NewId(),
		CallID:   callID,
		UserID:   userID,
		ConnID:   connID,
		StartAt:  now,
		CreateAt: now,
		UpdateAt: now,
	}); serr != nil {
		s.log.Warn("calls: failed to persist call session", mlog.Err(serr))
	}

	// Register the SFU session (rtcd InitSession).
	if serr := s.sendToHost(cs, rtcd.ClientMessage{
		Type: rtcd.ClientMessageJoin,
		Data: map[string]any{
			"callID":      callID,
			"userID":      userID,
			"sessionID":   connID,
			"channelID":   channelID,
			"av1Support":  false,
			"dcSignaling": false,
		},
	}); serr != nil {
		s.log.Error("calls: failed to register SFU session", mlog.Err(serr))
	}

	// Join ack (unicast) — carries the ICE servers for the browser's
	// RTCPeerConnection, matching the plugin's config delivery.
	s.publishTo(eventJoin, map[string]any{
		"connID":     connID,
		"iceServers": s.iceServersForHost(cs.rtcdHost),
	}, connID)

	// Presence fan-out (channel-scoped).
	s.publishChannel(channelID, eventUserJoined, map[string]any{
		"user_id":    userID,
		"session_id": connID,
	})

	// Full state to the joiner.
	s.sendCallState(cs, connID)
	return nil
}

// handleLeave detaches a connection from its call: the SFU session is closed,
// the leave boundary persisted, presence fanned out, and the call ends when
// the last participant leaves.
func (s *CallService) handleLeave(connID, userID string, data map[string]any) error {
	channelID, _ := data["channelID"].(string)
	if channelID == "" {
		return errors.New("calls: channelID is required")
	}
	callID := callIDForChannel(channelID)
	cs, ok := s.shards.get(callID)
	if !ok {
		return nil // already ended; a duplicate leave is not an error
	}

	sess, ok := cs.findByConn(connID)
	if !ok {
		return nil
	}

	s.removeSession(cs, sess, "left")
	return nil
}

// handleReconnect re-points a session at its new websocket connection after a
// transient disconnect. The stable sessionID keeps SFU + presence identity.
func (s *CallService) handleReconnect(connID, userID string, data map[string]any) error {
	channelID, _ := data["channelID"].(string)
	originalConnID, _ := data["originalConnID"].(string)
	if channelID == "" || originalConnID == "" {
		return errors.New("calls: channelID and originalConnID are required")
	}

	cs, ok := s.shards.get(callIDForChannel(channelID))
	if !ok {
		return ErrCallNotFound
	}
	sess, ok := cs.get(originalConnID)
	if !ok || sess.userID != userID {
		return errors.New("calls: session not found for reconnect")
	}

	cs.mut.Lock()
	sess.connID = connID
	cs.mut.Unlock()

	// Keep the SFU's connection map pointed at the new server connection.
	if err := s.sendToHost(cs, rtcd.ClientMessage{
		Type: rtcd.ClientMessageReconnect,
		Data: map[string]string{"sessionID": originalConnID},
	}); err != nil {
		s.log.Warn("calls: failed to reconnect SFU session", mlog.Err(err))
	}

	// Resync the reconnecting client with the full state.
	s.sendCallState(cs, connID)
	return nil
}

// removeSession performs the shared teardown for leave/host-remove/SFU-close:
// state removal, SFU close message, persistence, presence events, and call end
// when the last participant is gone.
func (s *CallService) removeSession(cs *callState, sess *session, reason string) {
	if prev := cs.removeSession(sess.sessionID); prev == nil {
		return
	}
	sess.markLeft()

	// Close the SFU session.
	if err := s.sendToHost(cs, rtcd.ClientMessage{
		Type: rtcd.ClientMessageLeave,
		Data: map[string]string{"sessionID": sess.sessionID},
	}); err != nil {
		s.log.Warn("calls: failed to close SFU session", mlog.Err(err))
	}

	// Persist the leave boundary (best effort).
	if stored, err := s.store.CallSession().GetByCallAndUser(sess.callID, sess.userID); err == nil && stored != nil && stored.EndAt == 0 {
		stored.EndAt = model.GetMillis()
		stored.UpdateAt = stored.EndAt
		if _, err := s.store.CallSession().Update(stored); err != nil {
			s.log.Warn("calls: failed to persist session end", mlog.Err(err))
		}
	}

	// Presence fan-out.
	s.publishChannel(cs.channelID, eventUserLeft, map[string]any{
		"user_id":    sess.userID,
		"session_id": sess.sessionID,
	})

	// End the call when the last participant leaves.
	if cs.participants() == 0 {
		if err := s.EndCall(cs.callID); err != nil && !errors.Is(err, ErrCallEnded) {
			s.log.Warn("calls: failed to end call", mlog.Err(err))
		}
	}
}

// ─── signaling relay ────────────────────────────────────────────────

// handleRTCRelay forwards a browser SDP/ICE payload to the SFU for the call
// the connection is currently in.
func (s *CallService) handleRTCRelay(connID, userID string, msgType rtc.MessageType, data map[string]any) error {
	payload, _ := data["data"]
	var raw []byte
	switch v := payload.(type) {
	case string:
		raw = []byte(v)
	default:
		encoded, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("calls: failed to encode rtc payload: %w", err)
		}
		raw = encoded
	}

	sess, cs, err := s.sessionByConn(connID)
	if err != nil {
		return err
	}

	return s.sendToHost(cs, rtcEnvelope(sess.sessionID, cs.callID, userID, msgType, raw))
}

// sessionByConn resolves the call state + session for a current connection.
func (s *CallService) sessionByConn(connID string) (*session, *callState, error) {
	// Calls are keyed by channel; scan shards via the registry is not
	// practical, so the connection carries its channel through the message.
	// For robustness fall back to a scan of live calls (cheap: few calls).
	for _, cs := range s.allCallStates() {
		if sess, ok := cs.findByConn(connID); ok {
			return sess, cs, nil
		}
	}
	return nil, nil, errors.New("calls: no session found for connection")
}

// allCallStates returns a snapshot of every live call state. Used only by the
// connection→session fallback lookup; the join path always knows its channel.
func (s *CallService) allCallStates() []*callState {
	var out []*callState
	seen := map[string]bool{}
	for i := range s.shards {
		sh := s.shards[i]
		sh.mut.RLock()
		for id, cs := range sh.states {
			if !seen[id] {
				seen[id] = true
				out = append(out, cs)
			}
		}
		sh.mut.RUnlock()
	}
	return out
}

// sendToHost sends a control message to the rtcd host owning the call.
func (s *CallService) sendToHost(cs *callState, msg rtcd.ClientMessage) error {
	s.mut.RLock()
	mgr := s.rtcd
	s.mut.RUnlock()
	if mgr == nil || cs.rtcdHost == "" {
		return ErrNoSFUHost
	}
	return mgr.SendToHost(cs.rtcdHost, msg)
}

// ─── presence toggles ───────────────────────────────────────────────

func (s *CallService) handleMuteToggle(connID, userID string, unmuted bool) error {
	sess, cs, err := s.sessionByConn(connID)
	if err != nil {
		return err
	}

	msgType := rtc.MuteMessage
	if unmuted {
		msgType = rtc.UnmuteMessage
	}
	if err := s.sendToHost(cs, rtcEnvelope(sess.sessionID, cs.callID, userID, msgType, nil)); err != nil {
		return err
	}

	cs.mutate(sess.sessionID, func(s *session) { s.unmuted = unmuted })

	evType := eventUserMuted
	if unmuted {
		evType = eventUserUnmuted
	}
	s.publishChannel(cs.channelID, evType, map[string]any{
		"userID":     userID,
		"session_id": sess.sessionID,
	})
	return nil
}

func (s *CallService) handleScreenToggle(connID, userID string, on bool, data map[string]any) error {
	if on && !s.callsConfig().allowScreenSharing() {
		return errors.New("calls: screen sharing is not allowed")
	}

	sess, cs, err := s.sessionByConn(connID)
	if err != nil {
		return err
	}

	if on {
		if sharer := cs.screenSharer(); sharer != nil && sharer.sessionID != sess.sessionID {
			return errors.New("calls: someone else is already sharing their screen")
		}
	}

	var raw []byte
	if on {
		payload, _ := data["data"]
		switch v := payload.(type) {
		case string:
			raw = []byte(v)
		default:
			if encoded, jerr := json.Marshal(payload); jerr == nil {
				raw = encoded
			}
		}
	}

	msgType := rtc.ScreenOffMessage
	if on {
		msgType = rtc.ScreenOnMessage
	}
	if err := s.sendToHost(cs, rtcEnvelope(sess.sessionID, cs.callID, userID, msgType, raw)); err != nil {
		return err
	}

	cs.mutate(sess.sessionID, func(s *session) { s.screenOn = on })

	evType := eventUserScreenOff
	if on {
		evType = eventUserScreenOn
	}
	s.publishChannel(cs.channelID, evType, map[string]any{
		"userID":     userID,
		"session_id": sess.sessionID,
	})
	return nil
}

func (s *CallService) handleVideoToggle(connID, userID string, on bool, data map[string]any) error {
	sess, cs, err := s.sessionByConn(connID)
	if err != nil {
		return err
	}

	var raw []byte
	if on {
		payload, _ := data["data"]
		switch v := payload.(type) {
		case string:
			raw = []byte(v)
		default:
			if encoded, jerr := json.Marshal(payload); jerr == nil {
				raw = encoded
			}
		}
	}

	msgType := rtc.VideoOffMessage
	if on {
		msgType = rtc.VideoOnMessage
	}
	if err := s.sendToHost(cs, rtcEnvelope(sess.sessionID, cs.callID, userID, msgType, raw)); err != nil {
		return err
	}

	cs.mutate(sess.sessionID, func(s *session) { s.videoOn = on })

	evType := eventUserVideoOff
	if on {
		evType = eventUserVideoOn
	}
	s.publishChannel(cs.channelID, evType, map[string]any{
		"userID":     userID,
		"session_id": sess.sessionID,
	})
	return nil
}

func (s *CallService) handleRaiseHand(connID, userID string, raised bool) error {
	sess, cs, err := s.sessionByConn(connID)
	if err != nil {
		return err
	}

	raisedAt := int64(0)
	if raised {
		raisedAt = model.GetMillis()
	}
	cs.mutate(sess.sessionID, func(s *session) { s.raisedHandAt = raisedAt })

	evType := eventUserUnraiseHand
	if raised {
		evType = eventUserRaiseHand
	}
	s.publishChannel(cs.channelID, evType, map[string]any{
		"userID":      userID,
		"session_id":  sess.sessionID,
		"raised_hand": raisedAt,
	})
	return nil
}

func (s *CallService) handleCallStateRequest(connID, userID string, data map[string]any) error {
	channelID, _ := data["channelID"].(string)
	if channelID == "" {
		return errors.New("calls: channelID is required")
	}
	cs, ok := s.shards.get(callIDForChannel(channelID))
	if !ok {
		return ErrCallNotFound
	}
	s.sendCallState(cs, connID)
	return nil
}
