// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"encoding/json"
	"errors"
	"fmt"

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
	case msgReact:
		err = s.handleReact(connID, userID, data)
	case msgMetric:
		// Client metrics (e.g. ICE candidate pair reports) are accepted and
		// logged for diagnostics; no fan-out.
		s.log.Debug("calls: client metric", mlog.String("userID", userID), mlog.Any("data", data["data"]))
	case msgCaption:
		// Live captions are produced by a server-side transcriber (phase 4);
		// browser captions are ignored.
		return
	case msgCallState:
		err = s.handleCallStateRequest(connID, userID, data)
	default:
		// voice_on/voice_off originate from the SFU's VAD, never from the
		// browser.
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
	views, hostSessionID := cs.snapshot()
	state := &CallStateView{
		CallID:        cs.callID,
		ChannelID:     cs.channelID,
		StartAt:       cs.startAt,
		RTCDHost:      cs.rtcdHost,
		Sessions:      views,
		Participants:  len(views),
		HostSessionID: hostSessionID,
	}
	encoded, err := json.Marshal(state)
	if err != nil {
		// CallStateView contains only JSON-safe primitives; a marshal failure
		// would indicate memory corruption. Log loudly and drop the update.
		s.log.Error("calls: failed to encode call state", mlog.String("callID", cs.callID), mlog.Err(err))
		return
	}
	s.publishTo(eventCallState, map[string]any{"call": string(encoded)}, connID)
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
		return ErrCallsDisabled
	}

	// Per-channel preference: a channel admin may have turned calls off. This
	// check precedes the rtcd check — a channel-level configuration error is
	// more specific and needs no SFU to be meaningful.
	if !s.callsEnabledForChannel(channelID) {
		return ErrChannelCallsDisabled
	}
	if s.rtcdManager() == nil {
		// The boot-time init loop may have given up (rtcd unreachable >5min
		// at server start). Kick a background re-init so the NEXT attempt
		// can succeed, and tell the user the service is not ready yet.
		s.kickRTCDInit()
		return errors.New("calls: rtcd service is not configured")
	}

	callID := callIDForChannel(channelID)

	// Fast-path limit rejection (the limit is enforced again atomically at
	// addSession, closing the check-then-act race).
	max := s.callsConfig().maxParticipants()
	if max > 0 {
		if existing, ok := s.shards.get(callID); ok && existing.participants() >= max {
			return ErrMaxParticipants
		}
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

	// Reuse the in-progress call or start one (idempotent per channel), then
	// insert the session ATOMICALLY with the liveness check (shard write
	// lock). A call whose last participant leaves mid-join would otherwise
	// race the insert: the joiner could resurrect an already-torn-down state.
	// On that race addSessionIfLive reports ErrCallNotFound and the loop
	// transparently starts the next generation.
	var (
		cs   *callState
		prev *session
	)
	for attempt := 0; attempt < 3; attempt++ {
		res, err := s.StartCall(StartCallOpts{ChannelID: channelID, OwnerID: userID})
		if err != nil {
			return err
		}
		callID = res.CallID

		var addErr error
		cs, prev, addErr = s.shards.shardFor(callID).addSessionIfLive(callID, sess.sessionID, sess, max)
		if errors.Is(addErr, ErrCallNotFound) {
			continue // generation ended mid-join; retry onto a new one
		}
		if addErr != nil {
			return addErr // e.g. participant limit reached
		}
		break
	}
	if cs == nil {
		return ErrCallNotFound
	}

	// Index the session after the insert but BEFORE the SFU Join goes out:
	// the SFU cannot message a session it has not registered, so any inbound
	// relay traffic necessarily follows the registration (see
	// sessionRegistry's consistency notes).
	s.index.link(sess.sessionID, sess.connID, cs)

	if prev != nil {
		// Same connection joined twice (e.g. a retried join): the previous
		// session object is replaced; the SFU re-registers the same
		// sessionID on the Join below, so nothing leaks.
		s.log.Debug("calls: session re-joined, replacing prior state",
			mlog.String("sessionID", sess.sessionID), mlog.String("userID", userID))
	}

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
		// The call stays live — presence is in-memory — but the boundary is
		// lost for reporting; surface it.
		s.log.Warn("calls: failed to persist call session",
			mlog.String("callID", callID), mlog.String("userID", userID), mlog.Err(serr))
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
		s.log.Error("calls: failed to register SFU session",
			mlog.String("callID", callID), mlog.String("sessionID", connID), mlog.Err(serr))
	}

	// Join ack (unicast) — carries the ICE servers for the browser's
	// RTCPeerConnection, matching the plugin's config delivery.
	s.publishTo(eventJoin, map[string]any{
		"connID":     connID,
		"iceServers": s.iceServers(),
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

	s.teardownSession(cs, sess, reasonLeft)
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
		return ErrSessionNotFound
	}

	if !cs.setConn(sess.sessionID, connID) {
		// The session was torn down between the get and the update.
		return ErrSessionNotFound
	}
	s.index.repoint(sess.sessionID, originalConnID, connID, cs)

	// Keep the SFU's connection map pointed at the new server connection.
	if err := s.sendToHost(cs, rtcd.ClientMessage{
		Type: rtcd.ClientMessageReconnect,
		Data: map[string]string{"sessionID": originalConnID},
	}); err != nil {
		s.log.Warn("calls: failed to reconnect SFU session",
			mlog.String("sessionID", originalConnID), mlog.Err(err))
	}

	// Resync the reconnecting client with the full state.
	s.sendCallState(cs, connID)
	return nil
}

// teardownSession performs the shared teardown for leave/host-remove/SFU-close:
// state removal, index cleanup, SFU close message, persistence, presence
// events, and call end when the last participant is gone.
func (s *CallService) teardownSession(cs *callState, sess *session, reason string) {
	removed, lastConnID := cs.removeSession(sess.sessionID)
	if removed == nil {
		return
	}

	// Remove from the global index (after the call-state removal; see the
	// sessionRegistry consistency notes).
	s.index.unlink(sess.sessionID, lastConnID)

	// Close the SFU session.
	if err := s.sendToHost(cs, rtcd.ClientMessage{
		Type: rtcd.ClientMessageLeave,
		Data: map[string]string{"sessionID": sess.sessionID},
	}); err != nil {
		s.log.Warn("calls: failed to close SFU session",
			mlog.String("sessionID", sess.sessionID), mlog.String("reason", reason), mlog.Err(err))
	}

	// Persist the leave boundary (best effort, but never silent).
	stored, err := s.store.CallSession().GetByCallAndUser(sess.callID, sess.userID)
	switch {
	case err != nil:
		s.log.Warn("calls: failed to load call session for end persistence",
			mlog.String("callID", sess.callID), mlog.String("userID", sess.userID), mlog.Err(err))
	case stored != nil && stored.EndAt == 0:
		stored.EndAt = model.GetMillis()
		stored.UpdateAt = stored.EndAt
		if _, err := s.store.CallSession().Update(stored); err != nil {
			s.log.Warn("calls: failed to persist session end",
				mlog.String("callID", sess.callID), mlog.String("userID", sess.userID), mlog.Err(err))
		}
	}

	// Presence fan-out.
	s.publishChannel(cs.channelID, eventUserLeft, map[string]any{
		"user_id":    sess.userID,
		"session_id": sess.sessionID,
	})

	// End the call when the last participant leaves. The registry identity
	// check inside endCallState keeps a new call generation on this channel
	// alive if it started while this teardown was in flight.
	if cs.participants() == 0 {
		if err := s.endCallState(cs, model.GetMillis()); err != nil && !errors.Is(err, ErrCallEnded) {
			s.log.Warn("calls: failed to end call",
				mlog.String("callID", cs.callID), mlog.String("reason", reason), mlog.Err(err))
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
// One index hit + one call-local map hit — no scanning.
func (s *CallService) sessionByConn(connID string) (*session, *callState, error) {
	if cs := s.index.byConnID(connID); cs != nil {
		if sess, ok := cs.findByConn(connID); ok {
			return sess, cs, nil
		}
	}
	return nil, nil, ErrSessionNotFound
}

// sendToHost sends a control message to the rtcd host owning the call.
func (s *CallService) sendToHost(cs *callState, msg rtcd.ClientMessage) error {
	mgr := s.rtcdManager()
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
		raw, err = rtcPayload(data)
		if err != nil {
			return err
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
		raw, err = rtcPayload(data)
		if err != nil {
			return err
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

// emojiData is the reaction payload exchanged with the webapp (name, optional
// skin, unified codepoint and the literal character), matching the plugin's
// EmojiData so stock clients interoperate.
type emojiData struct {
	Name    string `json:"name"`
	Skin    string `json:"skin,omitempty"`
	Unified string `json:"unified"`
	Literal string `json:"literal,omitempty"`
}

func (ed emojiData) toMap() map[string]any {
	return map[string]any{
		"name":    ed.Name,
		"skin":    ed.Skin,
		"unified": ed.Unified,
		"literal": ed.Literal,
	}
}

// handleReact broadcasts an in-call emoji reaction to the call's participants
// as user_reacted, mirroring the plugin's payload shape exactly:
// {user_id, session_id, emoji: {name, skin, unified, literal}, timestamp}.
func (s *CallService) handleReact(connID, userID string, data map[string]any) error {
	sess, cs, err := s.sessionByConn(connID)
	if err != nil {
		return err
	}

	raw, _ := data["data"]
	var emoji emojiData
	switch v := raw.(type) {
	case string:
		if err := json.Unmarshal([]byte(v), &emoji); err != nil {
			return errors.New("calls: invalid reaction data")
		}
	default:
		if encoded, jerr := json.Marshal(raw); jerr == nil {
			if jerr := json.Unmarshal(encoded, &emoji); jerr != nil {
				return errors.New("calls: invalid reaction data")
			}
		} else {
			return errors.New("calls: invalid reaction data")
		}
	}
	if emoji.Name == "" && emoji.Literal == "" {
		return errors.New("calls: empty reaction")
	}

	s.publishChannel(cs.channelID, eventUserReacted, map[string]any{
		"user_id":    userID,
		"session_id": sess.sessionID,
		"emoji":      emoji.toMap(),
		"timestamp":  model.GetMillis(),
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

// rtcPayload extracts the raw signaling payload a browser attached under the
// "data" key. The plugin protocol sends SDP/ICE blobs as JSON strings; other
// shapes are re-encoded.
func rtcPayload(data map[string]any) ([]byte, error) {
	payload, _ := data["data"]
	switch v := payload.(type) {
	case nil:
		return nil, nil
	case string:
		return []byte(v), nil
	default:
		encoded, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("calls: failed to encode rtc payload: %w", err)
		}
		return encoded, nil
	}
}
