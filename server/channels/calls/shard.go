// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"hash/fnv"
	"sync"
)

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

// shardRegistry is the fixed-size array of shards. A callID is mapped to one
// shard via FNV-1a hashing for an even distribution.
type shardRegistry []*callShard

func newShardRegistry(n int) shardRegistry {
	shards := make(shardRegistry, n)
	for i := range shards {
		shards[i] = newCallShard()
	}
	return shards
}

// shardFor returns the shard owning callID.
func (r shardRegistry) shardFor(callID string) *callShard {
	if len(r) == 0 {
		// Defensive; should not happen in production.
		return r[0]
	}
	h := fnv.New32a()
	_, _ = h.Write([]byte(callID))
	return r[int(h.Sum32())%len(r)]
}

func (r shardRegistry) get(callID string) (*callState, bool) {
	return r.shardFor(callID).get(callID)
}

func (r shardRegistry) delete(callID string) (*callState, bool) {
	return r.shardFor(callID).delete(callID)
}
