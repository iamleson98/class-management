// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"sync/atomic"
)

// session is the in-memory, per-participant live state for one call.
//
// It is NOT persisted on every change — only the join and leave boundaries are
// written to the CallSessionStore. Transient fields (unmuted, screenOn,
// videoOn, voiceOn) are fanned out as presence events and kept here for fast
// reads and call-state snapshots.
type session struct {
	userID    string
	channelID string
	callID    string
	connID    string

	// Transient presence (not persisted).
	unmuted  bool
	screenOn bool
	videoOn  bool
	voiceOn  bool // updated from rtcd VAD callbacks

	// Raised hand ordering; lower index = earlier.
	raisedHandAt int64

	startAt int64

	// Lifecycle signaling.
	rtcClosed int32
	left      int32
	removed   int32
}

// markRTCclosed atomically marks the rtc session closed. Returns true if this
// call performed the transition (used to fire the close callback once).
func (s *session) markRTCclosed() bool {
	return atomic.CompareAndSwapInt32(&s.rtcClosed, 0, 1)
}

func (s *session) hasLeft() bool { return atomic.LoadInt32(&s.left) != 0 }
func (s *session) markLeft()     { atomic.StoreInt32(&s.left, 1) }

func (s *session) isRemoved() bool { return atomic.LoadInt32(&s.removed) != 0 }
func (s *session) markRemoved() bool {
	return atomic.CompareAndSwapInt32(&s.removed, 0, 1)
}

// SessionView is an immutable, JSON-serializable snapshot of a session for
// broadcasting call state to participants.
type SessionView struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	ChannelID  string `json:"channel_id"`
	Unmuted    bool   `json:"unmuted"`
	VoiceOn    bool   `json:"voice_on"`
	ScreenOn   bool   `json:"screen_on"`
	VideoOn    bool   `json:"video_on"`
	RaisedHand int64  `json:"raised_hand_at,omitempty"`
	StartAt    int64  `json:"start_at"`
	IsHost     bool   `json:"is_host,omitempty"`
}

func (s *session) view(id string, isHost bool) SessionView {
	return SessionView{
		ID:         id,
		UserID:     s.userID,
		ChannelID:  s.channelID,
		Unmuted:    s.unmuted,
		VoiceOn:    s.voiceOn,
		ScreenOn:   s.screenOn,
		VideoOn:    s.videoOn,
		RaisedHand: s.raisedHandAt,
		StartAt:    s.startAt,
		IsHost:     isHost,
	}
}
