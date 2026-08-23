// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"errors"
	"fmt"

	rtcd "github.com/mattermost/rtcd/service"
	"github.com/mattermost/rtcd/service/rtc"

	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

// Host control operations, mirroring the Calls plugin's host_controls API.
// Only the current call host (or a system admin, checked at the API layer)
// may invoke them. Effects are fanned out as the plugin's host_* events so a
// stock webapp client reacts identically.

var (
	ErrNotCallHost    = errors.New("calls: only the host can perform this action")
	ErrSessionNotFound = errors.New("calls: session not found")
)

// callForHostAction resolves the call state and verifies the requester is the
// current host.
func (s *CallService) callForHostAction(callID, requesterUserID string) (*callState, error) {
	cs, ok := s.shards.get(callID)
	if !ok {
		return nil, ErrCallNotFound
	}
	host, _ := cs.hostSession()
	if host == nil || host.userID != requesterUserID {
		return nil, ErrNotCallHost
	}
	return cs, nil
}

// MakeHost transfers the host role to another session's user and broadcasts
// call_host_changed.
func (s *CallService) MakeHost(callID, requesterUserID, newHostUserID string) error {
	cs, err := s.callForHostAction(callID, requesterUserID)
	if err != nil {
		return err
	}

	var target *session
	cs.mut.Lock()
	for id, sess := range cs.sessions {
		if sess.userID == newHostUserID {
			cs.hostConn = id
			target = sess
			break
		}
	}
	cs.mut.Unlock()
	if target == nil {
		return ErrSessionNotFound
	}

	s.publishChannel(cs.channelID, eventCallHostChanged, map[string]any{
		"hostID":  newHostUserID,
		"call_id": cs.callID,
	})
	return nil
}

// MuteSession host-mutes a session: SFU voice track disabled, target's client
// notified via host_mute, and presence updated for everyone.
func (s *CallService) MuteSession(callID, requesterUserID, sessionID string) error {
	cs, err := s.callForHostAction(callID, requesterUserID)
	if err != nil {
		return err
	}
	sess, ok := cs.get(sessionID)
	if !ok {
		return ErrSessionNotFound
	}

	if err := s.sendToHost(cs, rtcEnvelope(sess.sessionID, cs.callID, sess.userID, rtc.MuteMessage, nil)); err != nil {
		return fmt.Errorf("calls: failed to mute SFU session: %w", err)
	}

	cs.mutate(sessionID, func(t *session) { t.unmuted = false })

	s.publishTo(eventHostMute, map[string]any{
		"channel_id": cs.channelID,
		"session_id": sessionID,
	}, sess.connID)

	s.publishChannel(cs.channelID, eventUserMuted, map[string]any{
		"userID":     sess.userID,
		"session_id": sessionID,
	})
	return nil
}

// MuteOthers host-mutes every other participant.
func (s *CallService) MuteOthers(callID, requesterUserID string) error {
	cs, err := s.callForHostAction(callID, requesterUserID)
	if err != nil {
		return err
	}
	host, _ := cs.hostSession()
	if host == nil {
		return ErrSessionNotFound
	}

	views, _ := cs.snapshot()
	for _, v := range views {
		if !v.Unmuted || v.UserID == requesterUserID {
			continue
		}
		if err := s.MuteSession(callID, requesterUserID, v.ID); err != nil {
			s.log.Warn("calls: mute-others failed for session", mlog.String("sessionID", v.ID), mlog.Err(err))
		}
	}
	return nil
}

// ScreenOff host-stops the shared screen.
func (s *CallService) ScreenOff(callID, requesterUserID, sessionID string) error {
	cs, err := s.callForHostAction(callID, requesterUserID)
	if err != nil {
		return err
	}
	sess, ok := cs.get(sessionID)
	if !ok {
		return ErrSessionNotFound
	}

	if err := s.sendToHost(cs, rtcEnvelope(sess.sessionID, cs.callID, sess.userID, rtc.ScreenOffMessage, nil)); err != nil {
		return fmt.Errorf("calls: failed to stop screen on SFU: %w", err)
	}

	cs.mutate(sessionID, func(t *session) { t.screenOn = false })

	s.publishTo(eventHostScreenOff, map[string]any{
		"channel_id": cs.channelID,
		"session_id": sessionID,
	}, sess.connID)

	s.publishChannel(cs.channelID, eventUserScreenOff, map[string]any{
		"userID":     sess.userID,
		"session_id": sessionID,
	})
	return nil
}

// LowerHand host-lowers a raised hand.
func (s *CallService) LowerHand(callID, requesterUserID, sessionID string) error {
	cs, err := s.callForHostAction(callID, requesterUserID)
	if err != nil {
		return err
	}
	sess, ok := cs.get(sessionID)
	if !ok {
		return ErrSessionNotFound
	}

	cs.mutate(sessionID, func(t *session) { t.raisedHandAt = 0 })

	s.publishTo(eventHostLowerHand, map[string]any{
		"channel_id": cs.channelID,
		"session_id": sessionID,
	}, sess.connID)

	s.publishChannel(cs.channelID, eventUserUnraiseHand, map[string]any{
		"userID":      sess.userID,
		"session_id":  sessionID,
		"raised_hand": 0,
	})
	return nil
}

// RemoveSession host-removes a participant from the call.
func (s *CallService) RemoveSession(callID, requesterUserID, sessionID string) error {
	cs, err := s.callForHostAction(callID, requesterUserID)
	if err != nil {
		return err
	}
	sess, ok := cs.get(sessionID)
	if !ok {
		return ErrSessionNotFound
	}
	if !sess.markRemoved() {
		return nil // already being removed
	}

	// Notify the target BEFORE the shared teardown (their client leaves the
	// call UI on host_removed).
	s.publishTo(eventHostRemoved, map[string]any{
		"channel_id": cs.channelID,
		"session_id": sessionID,
	}, sess.connID)

	s.removeSession(cs, sess, "removed")
	return nil
}

// EndCallByHost lets the host end the call for everyone.
func (s *CallService) EndCallByHost(callID, requesterUserID string) error {
	if _, err := s.callForHostAction(callID, requesterUserID); err != nil {
		return err
	}
	return s.EndCall(callID)
}

// sendLeaveToHost is a tiny helper kept for future cluster relay paths.
func (s *CallService) sendLeaveToHost(cs *callState, sessionID string) error {
	return s.sendToHost(cs, rtcd.ClientMessage{
		Type: rtcd.ClientMessageLeave,
		Data: map[string]string{"sessionID": sessionID},
	})
}
