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
// unicast connection lives on the session itself and is additionally indexed
// in byConn for O(1) resolution from an inbound websocket message.
type callState struct {
	// Immutable identity (set at creation).
	callID    string
	channelID string
	rtcdHost  string // the rtcd SFU host assigned to this call's media

	startAt int64

	mut      sync.RWMutex
	sessions map[string]*session // sessionID -> session
	byConn   map[string]*session // current connID -> session (unicast target)
	// hostSessionID is the sessionID (not a connID) of the current host.
	hostSessionID string

	endAt int64 // >0 once the call has ended (guarded by mut)

	// jobs (recording / transcription / captions). Phase 4.
	recording     *model.CallJob
	transcription *model.CallJob

	// peakParticipants tracks the high-water mark for stats at call end.
	peakParticipants int
}

func newCallState(callID, channelID, rtcdHost string) *callState {
	return &callState{
		callID:    callID,
		channelID: channelID,
		rtcdHost:  rtcdHost,
		startAt:   model.GetMillis(),
		sessions:  map[string]*session{},
		byConn:    map[string]*session{},
	}
}

// participants returns the current participant count (callers who have not
// left). Cheap; used for limits and batching decisions.
func (cs *callState) participants() int {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	return len(cs.sessions)
}

// markEnded atomically records the call's end time. It returns true only for
// the first caller, making concurrent teardown (e.g. the last two
// participants leaving at once) idempotent.
func (cs *callState) markEnded(now int64) bool {
	cs.mut.Lock()
	defer cs.mut.Unlock()
	if cs.endAt > 0 {
		return false
	}
	cs.endAt = now
	return true
}

// ended reports whether the call has been marked ended.
func (cs *callState) ended() bool {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	return cs.endAt > 0
}

// endedAt returns the recorded end time (0 while the call is live).
func (cs *callState) endedAt() int64 {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	return cs.endAt
}

// peak returns the high-water mark of participants for this call.
func (cs *callState) peak() int {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	return cs.peakParticipants
}

// addSession registers a participant keyed by their stable sessionID.
//
// limit is the configured maximum number of participants (<= 0 means
// unlimited); it is enforced atomically with the insert, closing the
// check-then-act race the old pre-check allowed. Returns the prior session
// for this id (if any) so the caller can decide how to handle a re-join, and
// ErrMaxParticipants when the limit would be exceeded.
func (cs *callState) addSession(sessionID string, s *session, limit int) (*session, error) {
	cs.mut.Lock()
	defer cs.mut.Unlock()
	if _, exists := cs.sessions[sessionID]; !exists && limit > 0 && len(cs.sessions) >= limit {
		return nil, ErrMaxParticipants
	}
	prev := cs.sessions[sessionID]
	cs.sessions[sessionID] = s
	if s.connID != "" {
		cs.byConn[s.connID] = s
	}
	// First participant becomes the host.
	if cs.hostSessionID == "" {
		cs.hostSessionID = sessionID
	}
	if n := len(cs.sessions); n > cs.peakParticipants {
		cs.peakParticipants = n
	}
	return prev, nil
}

// removeSession removes a participant. It returns the removed session and its
// last known connID ("" when the session was not present).
func (cs *callState) removeSession(sessionID string) (*session, string) {
	cs.mut.Lock()
	defer cs.mut.Unlock()
	s, ok := cs.sessions[sessionID]
	if !ok {
		return nil, ""
	}
	delete(cs.sessions, sessionID)
	if s.connID != "" {
		delete(cs.byConn, s.connID)
	}
	// Re-host if the leaving participant was host.
	if cs.hostSessionID == sessionID {
		cs.hostSessionID = ""
		for id := range cs.sessions {
			cs.hostSessionID = id
			break
		}
	}
	return s, s.connID
}

// setConn re-points a session at a new websocket connection (reconnect).
// It returns false when the session no longer exists.
func (cs *callState) setConn(sessionID, newConnID string) bool {
	cs.mut.Lock()
	defer cs.mut.Unlock()
	s, ok := cs.sessions[sessionID]
	if !ok {
		return false
	}
	if s.connID != "" {
		delete(cs.byConn, s.connID)
	}
	s.connID = newConnID
	if newConnID != "" {
		cs.byConn[newConnID] = s
	}
	return true
}

// connIDFor returns the session's CURRENT websocket connection id (the
// unicast target), or "" when the session does not exist. Reads the mutable
// field under the call lock — never read session.connID directly.
func (cs *callState) connIDFor(sessionID string) string {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	s, ok := cs.sessions[sessionID]
	if !ok {
		return ""
	}
	return s.connID
}

func (cs *callState) get(sessionID string) (*session, bool) {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	s, ok := cs.sessions[sessionID]
	return s, ok
}

// findByConn resolves a session by its CURRENT websocket connection id (used
// by the inbound message path where only connID is known). O(1) via byConn.
func (cs *callState) findByConn(connID string) (*session, bool) {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	s, ok := cs.byConn[connID]
	return s, ok
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

// hostUserID returns the current host's userID, or "" when there is no host.
// The userID is immutable after session creation, so a copy under the call
// lock is a stable snapshot.
func (cs *callState) hostUserID() string {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	if cs.hostSessionID == "" {
		return ""
	}
	if s, ok := cs.sessions[cs.hostSessionID]; ok {
		return s.userID
	}
	return ""
}

// setHostByUser transfers the host role to the (first) session belonging to
// userID. Returns false when the user has no live session in this call.
func (cs *callState) setHostByUser(userID string) bool {
	cs.mut.Lock()
	defer cs.mut.Unlock()
	for id, sess := range cs.sessions {
		if sess.userID == userID {
			cs.hostSessionID = id
			return true
		}
	}
	return false
}

// snapshot returns immutable views of all participants plus the host
// sessionID — one consistent read under a single lock acquisition.
func (cs *callState) snapshot() ([]SessionView, string) {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	views := make([]SessionView, 0, len(cs.sessions))
	for sessionID, s := range cs.sessions {
		views = append(views, s.view(sessionID == cs.hostSessionID))
	}
	return views, cs.hostSessionID
}

// sessionIDs returns the ids of every live session in this call (used to
// clean the global session registry on call teardown).
func (cs *callState) sessionIDs() []string {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	ids := make([]string, 0, len(cs.sessions))
	for id := range cs.sessions {
		ids = append(ids, id)
	}
	return ids
}

// CallStateView is the JSON-serializable call state broadcast to participants
// on join and on call_state requests.
type CallStateView struct {
	CallID        string        `json:"call_id"`
	ChannelID     string        `json:"channel_id"`
	StartAt       int64         `json:"start_at"`
	EndAt         int64         `json:"end_at,omitempty"`
	RTCDHost      string        `json:"rtcd_host,omitempty"`
	Sessions      []SessionView `json:"sessions"`
	Participants  int           `json:"participants"`
	HostSessionID string        `json:"host_session_id,omitempty"`
}
