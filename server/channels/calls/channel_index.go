// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import "sync"

// channelIndex is the in-memory map from channelID to the channel's live call
// state. It replaces the historical "callID = ch:<channelID>" derivation:
// call identities are now fresh model.NewId()s (26 chars, matching every other
// persisted model row and the varchar(26) ID columns), so the "at most one
// live call per channel" invariant needs an explicit runtime mapping.
//
// This mirrors the Mattermost Calls plugin, where the channel-keyed call
// identity lives only in runtime state (never in an ID column) and the
// durable record is keyed by a 26-char NewId.
//
// Lifetime protocol:
//   - set()    happens in StartCall, AFTER the call row is durably persisted,
//     while the per-channel start lock is held.
//   - deleteIf() happens in endCallState, guarded by pointer identity so a
//     teardown can never remove a newer generation that replaced it.
type channelIndex struct {
	mut   sync.RWMutex
	calls map[string]*callState // channelID -> live callState
}

func newChannelIndex() *channelIndex {
	return &channelIndex{calls: map[string]*callState{}}
}

// get returns the callState currently registered for the channel (it may
// already be marked ended while its teardown is in flight).
func (ci *channelIndex) get(channelID string) (*callState, bool) {
	ci.mut.RLock()
	defer ci.mut.RUnlock()
	cs, ok := ci.calls[channelID]
	return cs, ok
}

// getLive returns the channel's call only while it has not been marked ended.
// This is the reuse predicate for StartCall's idempotency.
func (ci *channelIndex) getLive(channelID string) (*callState, bool) {
	cs, ok := ci.get(channelID)
	if !ok || cs.ended() {
		return nil, false
	}
	return cs, true
}

// set registers cs as the channel's live call, replacing any prior
// generation (whose teardown's deleteIf will then correctly skip).
func (ci *channelIndex) set(channelID string, cs *callState) {
	ci.mut.Lock()
	defer ci.mut.Unlock()
	ci.calls[channelID] = cs
}

// deleteIf removes the channel's mapping only when it currently points at
// target. It reports whether the removal happened. A new generation that
// already replaced the entry must never be deleted by the old teardown.
func (ci *channelIndex) deleteIf(channelID string, target *callState) bool {
	ci.mut.Lock()
	defer ci.mut.Unlock()
	if ci.calls[channelID] != target {
		return false
	}
	delete(ci.calls, channelID)
	return true
}

// channelLockTable is a fixed striping of per-channel mutexes. StartCall holds
// the channel's lock across the start-or-reuse decision so that, with fresh
// NewId identities, concurrent starts on one channel arbitrate to exactly one
// call (the derived-ID scheme got this for free from the shared map key).
//
// The lock is held only across call start (registry insert + one DB write) —
// never on the signaling hot path. Different channels hash to different
// locks with high probability; collisions merely serialize two unrelated
// starts briefly, which is harmless.
type channelLockTable struct {
	locks []sync.Mutex
}

func newChannelLockTable(n int) *channelLockTable {
	if n <= 0 {
		n = defaultShardCount
	}
	return &channelLockTable{locks: make([]sync.Mutex, n)}
}

// lockFor returns the mutex serializing call starts for channelID. The
// distribution reuses the shard registry's FNV-1a hashing.
func (t *channelLockTable) lockFor(channelID string) *sync.Mutex {
	return &t.locks[int(fnv1a(channelID))%len(t.locks)]
}
