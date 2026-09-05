// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import "sync"

// defaultShardCount is the number of sharded call-state registries when
// CallsSettings.StateShardCount is unset. Sharding by callID keeps a busy
// call from contending with unrelated calls (the plugin used one global mutex,
// which is the ceiling this design removes).
const defaultShardCount = 64

// callShard holds a subset of call states, keyed by callID. Each shard has its
// own mutex, so the lock taken to mutate one call never blocks another. This
// replaces the plugin's single global mutex (Plugin.mut) — the ceiling that
// limited concurrency across all calls on a node.
type callShard struct {
	mut    sync.RWMutex
	states map[string]*callState // callID -> state
}

func newCallShard() *callShard {
	return &callShard{states: map[string]*callState{}}
}

// get returns the callState for callID. The returned state is safe to access
// through its own methods (it holds its own RWMutex); callers should not hold
// the shard lock while doing call work.
func (sh *callShard) get(callID string) (*callState, bool) {
	sh.mut.RLock()
	defer sh.mut.RUnlock()
	cs, ok := sh.states[callID]
	return cs, ok
}

// getOrCreate atomically returns the existing state for callID or creates one
// with initFn. Returns the state and true if it was newly created.
func (sh *callShard) getOrCreate(callID string, initFn func() *callState) (*callState, bool) {
	sh.mut.Lock()
	defer sh.mut.Unlock()
	if cs, ok := sh.states[callID]; ok {
		return cs, false
	}
	cs := initFn()
	sh.states[callID] = cs
	return cs, true
}

// getOrCreateLive atomically returns the live state for callID or installs
// one built by initFn. A state that has been marked ended (its teardown is
// still in flight) is REPLACED by the new one: the in-flight teardown's
// deleteIf will then correctly skip (different pointer), while its end-of-call
// persistence and post update still complete for the old generation.
func (sh *callShard) getOrCreateLive(callID string, initFn func() *callState) (*callState, bool) {
	sh.mut.Lock()
	defer sh.mut.Unlock()
	if cs, ok := sh.states[callID]; ok && !cs.ended() {
		return cs, false
	}
	cs := initFn()
	sh.states[callID] = cs
	return cs, true
}

// delete removes and returns the callState, if present.
func (sh *callShard) delete(callID string) (*callState, bool) {
	sh.mut.Lock()
	defer sh.mut.Unlock()
	cs, ok := sh.states[callID]
	if !ok {
		return nil, false
	}
	delete(sh.states, callID)
	return cs, true
}

// deleteIf removes the mapping for callID only when it currently points at
// target. It reports whether the removal happened.
//
// Call identities are fresh model.NewId()s, so a successor generation on a
// channel never shares its predecessor's slot; deleteIf remains as the
// generation guard so a late teardown can never remove a state it does not
// own (and pins that contract for the channel index, which relies on the
// same pointer-identity check).
func (sh *callShard) deleteIf(callID string, target *callState) bool {
	sh.mut.Lock()
	defer sh.mut.Unlock()
	if sh.states[callID] != target {
		return false
	}
	delete(sh.states, callID)
	return true
}

// shardRegistry is the fixed-size array of shards. A callID is mapped to one
// shard via FNV-1a hashing for an even distribution.
type shardRegistry []*callShard

// newShardRegistry builds a registry with at least one shard (a zero count
// would otherwise make shardFor panic).
func newShardRegistry(n int) shardRegistry {
	if n <= 0 {
		n = 1
	}
	shards := make(shardRegistry, n)
	for i := range shards {
		shards[i] = newCallShard()
	}
	return shards
}

// fnv1a is an allocation-free FNV-1a 32-bit hash over a string. Equivalent to
// hash/fnv's New32a().Sum32() but without the per-call interface allocation —
// shardFor runs on every registry lookup.
func fnv1a(s string) uint32 {
	const (
		offset32 = 2166136261
		prime32  = 16777619
	)
	h := uint32(offset32)
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= prime32
	}
	return h
}

// shardFor returns the shard owning callID.
func (r shardRegistry) shardFor(callID string) *callShard {
	return r[int(fnv1a(callID))%len(r)]
}

func (r shardRegistry) get(callID string) (*callState, bool) {
	return r.shardFor(callID).get(callID)
}

func (r shardRegistry) delete(callID string) (*callState, bool) {
	return r.shardFor(callID).delete(callID)
}

func (r shardRegistry) deleteIf(callID string, target *callState) bool {
	return r.shardFor(callID).deleteIf(callID, target)
}

// all returns every live call state across all shards. Used by the
// REST states feed (once per request); signaling hot paths resolve through
// the sessionRegistry instead. Every callID maps to exactly one shard, so no
// de-duplication is needed.
func (r shardRegistry) all() []*callState {
	var out []*callState
	for i := range r {
		sh := r[i]
		sh.mut.RLock()
		for _, cs := range sh.states {
			out = append(out, cs)
		}
		sh.mut.RUnlock()
	}
	return out
}

// addSessionIfLive atomically inserts a session into the call state keyed by
// callID while holding the shard write lock. The insert therefore cannot
// race endCallState's deleteIf teardown of the same state: either the insert
// wins (and the call stays live — the new participant counts), or the
// teardown wins (and the caller gets ErrCallNotFound and may start the next
// generation). Lock order is shard.mut -> cs.mut, which no other path
// reverses.
func (sh *callShard) addSessionIfLive(callID, sessionID string, sess *session, limit int) (*callState, *session, error) {
	sh.mut.Lock()
	defer sh.mut.Unlock()
	cs, ok := sh.states[callID]
	if !ok || cs.ended() {
		return nil, nil, ErrCallNotFound
	}
	// cs.addSession takes the call lock NESTED inside the shard lock — the
	// documented order (shard.mut -> cs.mut); no path reverses it.
	prev, err := cs.addSession(sessionID, sess, limit)
	if err != nil {
		return nil, nil, err
	}
	return cs, prev, nil
}
