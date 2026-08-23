// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"sync"

	"github.com/iamleson98/sitename/server/public/model"
)

// callState is the in-memory, per-call live state. It is owned by exactly one
// shard (see shard.go), and every mutation takes that shard's lock — never a
// global one — so concurrent calls do not contend with each other.
//
// Sessions are keyed by their STABLE sessionID (see session.go); the current
// unicast connection lives on the session itself.
type callState struct {
	// Immutable identity (set at creation).
	callID    string
	channelID string
	ownerID   string
	hostID    string // the server node hosting signaling, when applicable
	rtcdHost  string // the rtcd SFU host assigned to this call's media

	startAt int64
	endAt   int64

	mut      sync.RWMutex
	sessions map[string]*session // sessionID -> session
	hostConn string              // sessionID of the current host

	// jobs (recording / transcription / captions). Phase 4.
	recording     *model.CallJob
	transcription *model.CallJob

	// peakParticipants tracks the high-water mark for stats at call end.
	peakParticipants int
}

func newCallState(callID, channelID, ownerID, rtcdHost string) *callState {
	return &callState{
		callID:    callID,
		channelID: channelID,
		ownerID:   ownerID,
		rtcdHost:  rtcdHost,
		startAt:   model.GetMillis(),
		sessions:  map[string]*session{},
	}
}

// participants returns the current participant count (callers who have not
// left). Cheap; used for limits and batching decisions.
func (cs *callState) participants() int {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	return len(cs.sessions)
}

func (cs *callState) ended() bool {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	return cs.endAt > 0
}

// addSession registers a participant keyed by their stable sessionID. Returns
// the prior session for this id (if any) so the caller can decide how to
// handle a re-join.
func (cs *callState) addSession(sessionID string, s *session) *session {
	cs.mut.Lock()
	defer cs.mut.Unlock()
	prev := cs.sessions[sessionID]
	cs.sessions[sessionID] = s
	// First participant becomes the host.
	if cs.hostConn == "" {
		cs.hostConn = sessionID
	}
	if n := len(cs.sessions); n > cs.peakParticipants {
		cs.peakParticipants = n
	}
	return prev
}

func (cs *callState) removeSession(sessionID string) *session {
	cs.mut.Lock()
	defer cs.mut.Unlock()
	s, ok := cs.sessions[sessionID]
	if !ok {
		return nil
	}
	delete(cs.sessions, sessionID)
	// Re-host if the leaving participant was host.
	if cs.hostConn == sessionID {
		cs.hostConn = ""
		for id := range cs.sessions {
			cs.hostConn = id
			break
		}
	}
	return s
}

func (cs *callState) get(sessionID string) (*session, bool) {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	s, ok := cs.sessions[sessionID]
	return s, ok
}

// findByConn resolves a session by its CURRENT websocket connection id (used
// by the inbound message path where only connID is known).
func (cs *callState) findByConn(connID string) (*session, bool) {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	for _, s := range cs.sessions {
		if s.connID == connID {
			return s, true
		}
	}
	return nil, false
}

// mutate applies fn to a session under the call lock; returns false when the
// session does not exist.
func (cs *callState) mutate(sessionID string, fn func(s *session)) bool {
	cs.mut.Lock()
	defer cs.mut.Unlock()
	s, ok := cs.sessions[sessionID]
	if !ok {
		return false
	}
	fn(s)
	return true
}

// screenSharer returns the session currently sharing their screen, if any.
func (cs *callState) screenSharer() *session {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	for _, s := range cs.sessions {
		if s.screenOn {
			return s
		}
	}
	return nil
}

// hostSession returns the current host's session and its sessionID.
func (cs *callState) hostSession() (*session, string) {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	if cs.hostConn == "" {
		return nil, ""
	}
	s := cs.sessions[cs.hostConn]
	return s, cs.hostConn
}

// snapshot returns immutable views of all participants plus the host sessionID.
func (cs *callState) snapshot() ([]SessionView, string) {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	views := make([]SessionView, 0, len(cs.sessions))
	for sessionID, s := range cs.sessions {
		views = append(views, s.view(sessionID == cs.hostConn))
	}
	return views, cs.hostConn
}

// CallStateView is the JSON-serializable call state broadcast to participants
// on join and on call_state requests.
type CallStateView struct {
	CallID       string        `json:"call_id"`
	ChannelID    string        `json:"channel_id"`
	StartAt      int64         `json:"start_at"`
	EndAt        int64         `json:"end_at,omitempty"`
	RTCDHost     string        `json:"rtcd_host,omitempty"`
	Sessions     []SessionView `json:"sessions"`
	Participants int           `json:"participants"`
	HostSessionID string       `json:"host_session_id,omitempty"`
}
