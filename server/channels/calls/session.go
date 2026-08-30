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
//
// Concurrency: all mutable fields are accessed ONLY while holding the owning
// callState's lock (see state.go accessors — connIDFor, mutate, snapshot).
// The atomic flags below gate cross-cutting teardown transitions that must
// fire exactly once even when several sources race.
//
// Identity model (matches the plugin/SFU contract):
//   - sessionID is the websocket connection id issued when the participant
//     joined and is STABLE for the life of the call participation, even across
//     websocket reconnects. It is the key used everywhere (event payloads,
//     SFU rtc messages, host controls).
//   - connID is the participant's CURRENT websocket connection id and is used
//     only to target unicast events. It is re-pointed on reconnect.
type session struct {
	userID    string
	channelID string
	callID    string

	// sessionID: stable identity (original connID at join time).
	sessionID string
	// connID: current websocket connection (unicast target).
	connID string

	// Transient presence (not persisted).
	unmuted  bool
	screenOn bool
	videoOn  bool
	voiceOn  bool // updated from rtcd VAD callbacks

	// Raised hand timestamp (unix ms); 0 when lowered.
	raisedHandAt int64

	startAt int64

	// Lifecycle signaling: markRTCclosed and markRemoved are compare-and-
	// swaps so the corresponding teardown runs exactly once.
	rtcClosed int32
	removed   int32
}

// markRTCclosed atomically marks the rtc session closed. Returns true if this
// call performed the transition (used to fire the close callback once).
func (s *session) markRTCclosed() bool {
	return atomic.CompareAndSwapInt32(&s.rtcClosed, 0, 1)
}

// markRemoved atomically marks the session host-removed. Returns true only
// for the first caller so the removal teardown is not repeated.
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

func (s *session) view(isHost bool) SessionView {
	return SessionView{
		ID:         s.sessionID,
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
