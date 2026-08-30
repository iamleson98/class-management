// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"fmt"

	"github.com/mattermost/rtcd/service/rtc"

	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

// Host control operations, mirroring the Calls plugin's host_controls API.
// Only the current call host (or a system admin, checked at the API layer)
// may invoke them. Effects are fanned out as the plugin's host_* events so a
// stock webapp client reacts identically.

// callForHostAction resolves the call state and verifies the requester is the
// current host.
func (s *CallService) callForHostAction(callID, requesterUserID string) (*callState, error) {
	cs, ok := s.shards.get(callID)
	if !ok {
		return nil, ErrCallNotFound
	}
	if cs.hostUserID() != requesterUserID {
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

	if !cs.setHostByUser(newHostUserID) {
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
	return s.muteOne(cs, sessionID)
}

// muteOne mutes one session of an already-authorized call (used by
// MuteSession and the MuteOthers loop).
func (s *CallService) muteOne(cs *callState, sessionID string) error {
	sess, ok := cs.get(sessionID)
	if !ok {
		return ErrSessionNotFound
	}

	if err := s.sendToHost(cs, rtcEnvelope(sessionID, cs.callID, sess.userID, rtc.MuteMessage, nil)); err != nil {
		return fmt.Errorf("calls: failed to mute SFU session: %w", err)
	}

	cs.mutate(sessionID, func(t *session) { t.unmuted = false })

	s.publishTo(eventHostMute, map[string]any{
		"channel_id": cs.channelID,
		"session_id": sessionID,
	}, cs.connIDFor(sessionID))

	s.publishChannel(cs.channelID, eventUserMuted, map[string]any{
		"userID":     sess.userID,
		"session_id": sessionID,
	})
	return nil
}

// MuteOthers host-mutes every other participant. Authorization is resolved
// once; per-session failures (e.g. a participant leaving mid-loop) are logged
// and skipped so one missing session cannot abort the sweep.
func (s *CallService) MuteOthers(callID, requesterUserID string) error {
	cs, err := s.callForHostAction(callID, requesterUserID)
	if err != nil {
		return err
	}

	views, _ := cs.snapshot()
	for _, v := range views {
		if !v.Unmuted || v.UserID == requesterUserID {
			continue
		}
		if err := s.muteOne(cs, v.ID); err != nil {
			s.log.Warn("calls: mute-others failed for session",
				mlog.String("sessionID", v.ID), mlog.Err(err))
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

	if err := s.sendToHost(cs, rtcEnvelope(sessionID, cs.callID, sess.userID, rtc.ScreenOffMessage, nil)); err != nil {
		return fmt.Errorf("calls: failed to stop screen on SFU: %w", err)
	}

	cs.mutate(sessionID, func(t *session) { t.screenOn = false })

	s.publishTo(eventHostScreenOff, map[string]any{
		"channel_id": cs.channelID,
		"session_id": sessionID,
	}, cs.connIDFor(sessionID))

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
		"host_id":    requesterUserID,
	}, cs.connIDFor(sessionID))

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
	}, cs.connIDFor(sessionID))

	// Tell everyone else who was removed so they see the notice (the shared
	// teardown below also fans out user_left).
	s.publishChannel(cs.channelID, eventUserRemoved, map[string]any{
		"user_id":    sess.userID,
		"session_id": sessionID,
		"host_id":    requesterUserID,
	})

	s.teardownSession(cs, sess, reasonRemoved)
	return nil
}

// EndCallByHost lets the host end the call for everyone.
func (s *CallService) EndCallByHost(callID, requesterUserID string) error {
	if _, err := s.callForHostAction(callID, requesterUserID); err != nil {
		return err
	}
	return s.EndCall(callID)
}
