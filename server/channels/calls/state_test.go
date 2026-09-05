// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
        "hash/fnv"
        "testing"

        "github.com/stretchr/testify/require"
)

func newTestSession(sessionID, userID string) *session {
        return &session{
                userID:    userID,
                sessionID: sessionID,
                connID:    sessionID,
        }
}

func TestCallIDForChannel(t *testing.T) {
        require.Equal(t, "ch:abc123", callIDForChannel("abc123"))
        require.Equal(t, "ch:abc123", CallIDForChannel("abc123"))
}

// TestCallIDForChannelFitsDBColumn guards the regression behind the
// "value too long for type character varying(26)" outage: call IDs are
// persisted in calls.id / call_*.callid columns. The columns are varchar(32)
// since migration 000161, and "ch:" + a 26-char channel ID is 29 characters.
// Longer (malformed) inputs are clamped so the derived ID always fits.
func TestCallIDForChannelFitsDBColumn(t *testing.T) {
        for _, channelID := range []string{"", "abc123", "n1abcxyzab1234cdeabcde123", "n1abcxyzab1234cdeabcde123extra"} {
                want := channelID
                if len(want) > 26 {
                        want = want[:26]
                }
                callID := callIDForChannel(channelID)
                require.Equal(t, "ch:"+want, callID)
                require.LessOrEqual(t, len(callID), 32,
                        "call ID %q (from channel %q) exceeds the varchar(32) DB columns", callID, channelID)
        }
}

func TestFnv1aMatchesHashFnv(t *testing.T) {
        for _, s := range []string{"", "a", "ch:abcdefghij1234567890", "ÿ€多字节"} {
                h := fnv.New32a()
                _, err := h.Write([]byte(s))
                require.NoError(t, err)
                require.Equal(t, h.Sum32(), fnv1a(s), "fnv1a mismatch for %q", s)
        }
}

func TestShardRegistryBasics(t *testing.T) {
        reg := newShardRegistry(4)
        require.Len(t, reg, 4)

        _, ok := reg.get("missing")
        require.False(t, ok)

        cs := newCallState("ch:call1", "chan1", "host1")
        got, created := reg.shardFor("ch:call1").getOrCreate("ch:call1", func() *callState { return cs })
        require.True(t, created)
        require.Same(t, cs, got)

        // Idempotent create: second caller gets the existing state.
        got2, created2 := reg.shardFor("ch:call1").getOrCreate("ch:call1", func() *callState {
                return newCallState("ch:call1", "chan1", "other")
        })
        require.False(t, created2)
        require.Same(t, cs, got2)

        // deleteIf only removes the generation it owns.
        require.True(t, reg.deleteIf("ch:call1", cs))
        replacement := newCallState("ch:call1", "chan1", "host2")
        _, _ = reg.shardFor("ch:call1").getOrCreate("ch:call1", func() *callState { return replacement })
        require.False(t, reg.deleteIf("ch:call1", cs), "old generation must not delete the new one")
        got3, ok := reg.get("ch:call1")
        require.True(t, ok)
        require.Same(t, replacement, got3)
}

func TestNewShardRegistryNeverEmpty(t *testing.T) {
        require.Len(t, newShardRegistry(0), 1)
        require.Len(t, newShardRegistry(-3), 1)
        require.NotPanics(t, func() {
                _ = newShardRegistry(0).shardFor("ch:call1")
        })
}

func TestCallStateAddRemoveSession(t *testing.T) {
        cs := newCallState("ch:call1", "chan1", "rtcd:8045")

        s1 := newTestSession("conn1", "user1")
        s2 := newTestSession("conn2", "user2")

        prev, err := cs.addSession("conn1", s1, 0)
        require.NoError(t, err)
        require.Nil(t, prev)
        _, err = cs.addSession("conn2", s2, 0)
        require.NoError(t, err)
        require.Equal(t, 2, cs.participants())
        require.Equal(t, 2, cs.peak())

        // First participant is the host.
        require.Equal(t, "user1", cs.hostUserID())

        // connID index resolves both.
        got, ok := cs.findByConn("conn2")
        require.True(t, ok)
        require.Same(t, s2, got)

        // Re-adding the same id returns the prior session.
        prev, err = cs.addSession("conn1", newTestSession("conn1", "user1"), 0)
        require.NoError(t, err)
        require.NotNil(t, prev)

        // Removing the host re-hosts the remaining participant.
        removed, lastConn := cs.removeSession("conn1")
        require.NotNil(t, removed)
        require.Equal(t, "conn1", lastConn)
        require.Equal(t, "user2", cs.hostUserID())
        _, ok = cs.findByConn("conn1")
        require.False(t, ok)

        // Removing a missing session is a no-op.
        removed, lastConn = cs.removeSession("nope")
        require.Nil(t, removed)
        require.Empty(t, lastConn)

        // Last participant leaves: host becomes empty.
        cs.removeSession("conn2")
        require.Equal(t, "", cs.hostUserID())
        require.Equal(t, 0, cs.participants())
        require.Equal(t, 2, cs.peak(), "peak is a high-water mark and must survive removals")
}

func TestCallStateSessionLimit(t *testing.T) {
        cs := newCallState("ch:call1", "chan1", "")

        _, err := cs.addSession("conn1", newTestSession("conn1", "u1"), 2)
        require.NoError(t, err)
        _, err = cs.addSession("conn2", newTestSession("conn2", "u2"), 2)
        require.NoError(t, err)

        // A third DISTINCT session is rejected at the limit...
        _, err = cs.addSession("conn3", newTestSession("conn3", "u3"), 2)
        require.ErrorIs(t, err, ErrMaxParticipants)
        require.Equal(t, 2, cs.participants())

        // ...but a re-join of an existing session is always allowed.
        prev, err := cs.addSession("conn1", newTestSession("conn1", "u1"), 2)
        require.NoError(t, err)
        require.NotNil(t, prev)

        // Zero/negative limits mean unlimited.
        cs2 := newCallState("ch:call2", "chan2", "")
        for i := 0; i < 5; i++ {
                id := "conn" + string(rune('a'+i))
                _, err := cs2.addSession(id, newTestSession(id, "u"+id), 0)
                require.NoError(t, err)
        }
        require.Equal(t, 5, cs2.participants())
}

func TestCallStateSetConn(t *testing.T) {
        cs := newCallState("ch:call1", "chan1", "")
        _, err := cs.addSession("conn1", newTestSession("conn1", "u1"), 0)
        require.NoError(t, err)

        require.True(t, cs.setConn("conn1", "conn1-new"))
        require.Equal(t, "conn1-new", cs.connIDFor("conn1"))
        _, ok := cs.findByConn("conn1")
        require.False(t, ok)
        _, ok = cs.findByConn("conn1-new")
        require.True(t, ok)

        // Missing session or empty connID handled.
        require.False(t, cs.setConn("nope", "x"))
        require.Empty(t, cs.connIDFor("nope"))

        _, err = cs.addSession("conn2", newTestSession("conn2", "u2"), 0)
        require.NoError(t, err)
        require.True(t, cs.setConn("conn2", ""))
        require.Empty(t, cs.connIDFor("conn2"))
}

func TestCallStateMarkEnded(t *testing.T) {
        cs := newCallState("ch:call1", "chan1", "")
        require.False(t, cs.ended())

        require.True(t, cs.markEnded(1000), "first ender must win")
        require.False(t, cs.markEnded(2000), "second ender must lose")
        require.True(t, cs.ended())
        require.Equal(t, int64(1000), cs.endedAt())
}

func TestCallStateHostAccessors(t *testing.T) {
        cs := newCallState("ch:call1", "chan1", "")
        _, err := cs.addSession("conn1", newTestSession("conn1", "u1"), 0)
        require.NoError(t, err)
        _, err = cs.addSession("conn2", newTestSession("conn2", "u2"), 0)
        require.NoError(t, err)

        require.Equal(t, "u1", cs.hostUserID())
        require.True(t, cs.setHostByUser("u2"))
        require.Equal(t, "u2", cs.hostUserID())
        require.False(t, cs.setHostByUser("absent"), "no session for that user")
        require.Equal(t, "u2", cs.hostUserID(), "failed transfer must not change the host")
}

func TestCallStateSnapshotConsistency(t *testing.T) {
        cs := newCallState("ch:call1", "chan1", "")
        _, err := cs.addSession("conn1", newTestSession("conn1", "u1"), 0)
        require.NoError(t, err)
        _, err = cs.addSession("conn2", newTestSession("conn2", "u2"), 0)
        require.NoError(t, err)
        require.True(t, cs.setHostByUser("u2"))

        views, hostID := cs.snapshot()
        require.Len(t, views, 2)
        require.Equal(t, "conn2", hostID)
        for _, v := range views {
                require.Equal(t, v.ID == "conn2", v.IsHost)
        }

        ids := cs.sessionIDs()
        require.ElementsMatch(t, []string{"conn1", "conn2"}, ids)
}

func TestSessionRegistry(t *testing.T) {
        r := newSessionRegistry()
        csA := newCallState("ch:a", "chanA", "")
        csB := newCallState("ch:b", "chanB", "")

        r.link("sess1", "conn1", csA)
        r.link("sess2", "conn2", csB)

        require.Same(t, csA, r.bySessionID("sess1"))
        require.Same(t, csB, r.byConnID("conn2"))
        require.Nil(t, r.bySessionID("missing"))
        require.Nil(t, r.byConnID("missing"))

        // Repoint moves the conn mapping, keeps the session mapping.
        r.repoint("sess1", "conn1", "conn1r", csA)
        require.Nil(t, r.byConnID("conn1"))
        require.Same(t, csA, r.byConnID("conn1r"))
        require.Same(t, csA, r.bySessionID("sess1"))

        // Unlink clears both.
        r.unlink("sess1", "conn1r")
        require.Nil(t, r.bySessionID("sess1"))
        require.Nil(t, r.byConnID("conn1r"))
        require.Same(t, csB, r.byConnID("conn2"), "other entries untouched")
}
