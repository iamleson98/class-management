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
	sessions map[string]*session // connID -> session
	hostConn string              // connID of the current host

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

// addSession registers a participant. Returns the prior session for this conn
// (if any) so the caller can decide how to handle a re-join.
func (cs *callState) addSession(connID string, s *session) *session {
	cs.mut.Lock()
	defer cs.mut.Unlock()
	prev := cs.sessions[connID]
	cs.sessions[connID] = s
	// First participant becomes the host.
	if cs.hostConn == "" {
		cs.hostConn = connID
	}
	if n := len(cs.sessions); n > cs.peakParticipants {
		cs.peakParticipants = n
	}
	return prev
}

func (cs *callState) removeSession(connID string) *session {
	cs.mut.Lock()
	defer cs.mut.Unlock()
	s, ok := cs.sessions[connID]
	if !ok {
		return nil
	}
	delete(cs.sessions, connID)
	// Re-host if the leaving participant was host.
	if cs.hostConn == connID {
		cs.hostConn = ""
		for id := range cs.sessions {
			cs.hostConn = id
			break
		}
	}
	return s
}

func (cs *callState) get(connID string) (*session, bool) {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	s, ok := cs.sessions[connID]
	return s, ok
}

// snapshot returns immutable views of all participants plus the host conn.
func (cs *callState) snapshot() ([]SessionView, string) {
	cs.mut.RLock()
	defer cs.mut.RUnlock()
	views := make([]SessionView, 0, len(cs.sessions))
	for connID, s := range cs.sessions {
		views = append(views, s.view(connID, connID == cs.hostConn))
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
}
