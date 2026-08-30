// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import "sync"

// sessionRegistry is the global O(1) reverse index over every live call:
//
//	sessionID -> owning *callState
//	connID   -> owning *callState
//
// It exists so the hot inbound paths — SDP/ICE relay, mute/screen/video/hand
// toggles (keyed by the CURRENT websocket connID) and SFU-originated VAD and
// answer traffic (keyed by sessionID) — resolve their call with one map hit
// instead of scanning every live call's participant map (the previous
// O(shards x sessions) behavior, which degraded as concurrent calls grew).
//
// Consistency protocol (no nested locks — registry methods never call back
// into callState while holding the registry lock):
//
//   - link()   is called BEFORE the session is added to the callState. The
//     SFU cannot message a session before its Join is sent, which happens
//     after the add, so the index is never behind a lookup the relay needs.
//   - unlink() is called AFTER the session is removed from the callState. A
//     lookup in the tiny window between the two hits a callState whose
//     get()/findByConn() miss — the correct "no session" outcome.
//   - repoint() is called around a reconnect's connID change, after the
//     callState has re-pointed the session at its new connection.
//
// connIDs and sessionIDs are globally unique websocket connection ids, so
// entries never alias across calls and deletes are unambiguous.
type sessionRegistry struct {
	mut       sync.RWMutex
	bySession map[string]*callState
	byConn    map[string]*callState
}

func newSessionRegistry() *sessionRegistry {
	return &sessionRegistry{
		bySession: map[string]*callState{},
		byConn:    map[string]*callState{},
	}
}

// link registers sessionID (and its current connID) as belonging to cs.
// Idempotent: re-linking the same keys overwrites in place.
func (r *sessionRegistry) link(sessionID, connID string, cs *callState) {
	r.mut.Lock()
	defer r.mut.Unlock()
	r.bySession[sessionID] = cs
	if connID != "" {
		r.byConn[connID] = cs
	}
}

// unlink removes a session's mappings from the index. connID is the
// session's CURRENT connection (which may differ from the original connID if
// the participant reconnected).
func (r *sessionRegistry) unlink(sessionID, connID string) {
	r.mut.Lock()
	defer r.mut.Unlock()
	delete(r.bySession, sessionID)
	delete(r.byConn, connID)
}

// repoint moves a session's connID mapping from oldConnID to newConnID.
func (r *sessionRegistry) repoint(sessionID, oldConnID, newConnID string, cs *callState) {
	r.mut.Lock()
	defer r.mut.Unlock()
	delete(r.byConn, oldConnID)
	if newConnID != "" {
		r.byConn[newConnID] = cs
	}
	r.bySession[sessionID] = cs
}

// bySessionID returns the callState owning sessionID, or nil.
func (r *sessionRegistry) bySessionID(sessionID string) *callState {
	r.mut.RLock()
	defer r.mut.RUnlock()
	return r.bySession[sessionID]
}

// byConnID returns the callState currently receiving connID, or nil.
func (r *sessionRegistry) byConnID(connID string) *callState {
	r.mut.RLock()
	defer r.mut.RUnlock()
	return r.byConn[connID]
}

// allCallStates returns a snapshot of every live call state. Used by the REST
// states feed; the signaling hot paths use the O(1) sessionRegistry lookups.
func (s *CallService) allCallStates() []*callState {
	return s.shards.all()
}
