// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"testing"
	"time"

	rtcd "github.com/mattermost/rtcd/service"
	"github.com/mattermost/rtcd/service/rtc"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/stretchr/testify/require"
)

// setDisconnectGrace shrinks the ws-disconnect grace window for the test.
func setDisconnectGrace(t *testing.T, s *CallService, d time.Duration) {
	t.Helper()
	s.mut.Lock()
	s.disconnectGraceDur = d
	s.mut.Unlock()
}

// waitFor polls fn until it reports true or the timeout elapses (the
// ws-disconnect teardown runs on a timer goroutine).
func waitFor(t *testing.T, timeout time.Duration, fn func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if fn() {
			return
		}
		time.Sleep(2 * time.Millisecond)
	}
	require.True(t, fn(), "condition not met within %s", timeout)
}

// A websocket dying without a leave message must not strand the participant's
// session: after the grace window the session is torn down (user_left, SFU
// close, leave boundary), and when they were the LAST participant the call
// ends and every resource is released.
func TestHandleWSDisconnectTearsDownAfterGrace(t *testing.T) {
	s, store, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	setDisconnectGrace(t, s, 10*time.Millisecond)

	connA := joinCall(t, s, "chan1", "u1")
	connB := joinCall(t, s, "chan1", "u2")
	callID := liveCallID(t, s, "chan1")

	hub.reset()
	s.HandleWSDisconnect(connA, "u1")

	// Not immediate — the grace window exists for reconnects.
	require.Zero(t, hub.count(eventUserLeft))
	waitFor(t, time.Second, func() bool { return hub.count(eventUserLeft) == 1 })
	left := requireChannelBroadcast(t, hub, eventUserLeft, "chan1")
	require.Equal(t, "u1", left.data["user_id"])

	// u1's leave boundary is persisted...
	rows, err := store.sess.GetByCall(callID)
	require.NoError(t, err)
	for _, r := range rows {
		if r.ConnID == connA {
			require.NotZero(t, r.EndAt, "u1's session row must be closed")
		}
	}
	// ...the session is gone from the call, u2 inherits hosting, the call lives.
	cs, ok := s.channelCalls.get("chan1")
	require.True(t, ok)
	_, stillThere := cs.get(connA)
	require.False(t, stillThere)
	views, hostID := cs.snapshot()
	require.Len(t, views, 1)
	require.Equal(t, connB, hostID)
	require.Zero(t, hub.count(eventCallEnd))

	// The last connection dying ends the whole call.
	hub.reset()
	s.HandleWSDisconnect(connB, "u2")
	waitFor(t, time.Second, func() bool { return hub.count(eventCallEnd) == 1 })
	_, stillLive := s.channelCalls.get("chan1")
	require.False(t, stillLive, "channel index must drop the ended call")
	call, err := store.call.Get(callID)
	require.NoError(t, err)
	require.NotZero(t, call.EndAt, "call end boundary must be persisted")
	require.Empty(t, store.sess.openForCall(callID), "no session rows may stay open after the call ends")
	require.NotEmpty(t, store.stat.saved(), "call stats are recorded at end")
}

// A transient websocket blip followed by a browser reconnect must NOT tear
// the session down: the reconnect re-points the session at the new connection
// and the deferred teardown becomes a no-op.
func TestHandleWSDisconnectReconnectCancelsTeardown(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	setDisconnectGrace(t, s, 20*time.Millisecond)

	conn := joinCall(t, s, "chan1", "u1")

	hub.reset()
	s.HandleWSDisconnect(conn, "u1")
	// The browser re-establishes its websocket and re-points the session
	// before the grace window closes.
	mustSend(t, s, "conn-new", "u1", msgReconnect, map[string]any{
		"channelID":      "chan1",
		"originalConnID": conn,
	})

	time.Sleep(100 * time.Millisecond) // well past the grace window
	require.Zero(t, hub.count(eventUserLeft), "a reconnected session must not be torn down")
	require.Zero(t, hub.count(eventCallEnd))
	cs, ok := s.channelCalls.get("chan1")
	require.True(t, ok)
	sess, found := cs.get(conn)
	require.True(t, found)
	require.Equal(t, "conn-new", sess.connID, "session must follow the new connection")
}

// Disconnects for connections with no call session are ignored.
func TestHandleWSDisconnectUnknownConnIsNoop(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	joinCall(t, s, "chan1", "u1")

	hub.reset()
	s.HandleWSDisconnect("unknown-conn", "u1")
	time.Sleep(50 * time.Millisecond)
	require.Zero(t, hub.count(eventUserLeft))
	require.Zero(t, hub.count(eventCallEnd))
}

// The idle reaper ends calls whose registry has zero participants — the
// backstop for teardown paths that never fired (e.g. a websocket died before
// the SFU ever registered the session, so no close callback ever arrives).
func TestReapIdleCallsEndsEmptyCall(t *testing.T) {
	s, store, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	conn := joinCall(t, s, "chan1", "u1")
	callID := liveCallID(t, s, "chan1")

	// Simulate the leak: the session vanishes without any teardown path
	// running (no leave, no SFU close, no ws-disconnect notification).
	cs, ok := s.channelCalls.get("chan1")
	require.True(t, ok)
	removed, _ := cs.removeSession(conn)
	require.NotNil(t, removed)
	s.index.unlink(conn, conn)

	hub.reset()
	s.reapIdleCalls()

	require.Equal(t, 1, hub.count(eventCallEnd))
	_, stillLive := s.channelCalls.get("chan1")
	require.False(t, stillLive)
	call, err := store.call.Get(callID)
	require.NoError(t, err)
	require.NotZero(t, call.EndAt)
	require.Empty(t, store.sess.openForCall(callID), "the reaper must close orphaned session rows")
}

// Calls with participants are never reaped; ended calls are skipped.
func TestReapIdleCallsLeavesLiveCallsAlone(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	joinCall(t, s, "chan1", "u1")
	joinCall(t, s, "chan1", "u2")

	hub.reset()
	s.reapIdleCalls()
	require.Zero(t, hub.count(eventCallEnd))
	_, ok := s.channelCalls.get("chan1")
	require.True(t, ok)
}

// A host (or REST) end of a call with still-connected participants must close
// every participant's SFU leg and session row — not just drop the call state.
func TestEndCallClosesRemainingSessionsAndRows(t *testing.T) {
	s, store, hub := newTestServiceWithStore(t)
	client := attachFakeRTCD(t, s)
	connA := joinCall(t, s, "chan1", "u1")
	connB := joinCall(t, s, "chan1", "u2")
	callID := liveCallID(t, s, "chan1")

	hub.reset()
	require.NoError(t, s.EndCall(callID))

	// Both SFU legs closed explicitly.
	leaves := client.sentOfType(rtcd.ClientMessageLeave)
	require.Len(t, leaves, 2, "every remaining participant's SFU session must be closed")
	sentSessions := map[string]bool{}
	for _, m := range leaves {
		data, _ := m.Data.(map[string]string)
		sentSessions[data["sessionID"]] = true
	}
	require.True(t, sentSessions[connA])
	require.True(t, sentSessions[connB])

	require.Equal(t, 1, hub.count(eventCallEnd))
	require.Empty(t, store.sess.openForCall(callID))
	_, stillLive := s.channelCalls.get("chan1")
	require.False(t, stillLive)
}

// Leaving with one device must not close the other device's session row of
// the same user: rows are keyed by the stable session id, not by user.
func TestTeardownClosesOnlyThatDevicesRow(t *testing.T) {
	s, store, _ := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	connA := joinCall(t, s, "chan1", "u1")
	connB := joinCall(t, s, "chan1", "u1") // same user, second device
	callID := liveCallID(t, s, "chan1")

	mustSend(t, s, connB, "u1", msgLeave, map[string]any{"channelID": "chan1"})

	rows, err := store.sess.GetByCall(callID)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	for _, r := range rows {
		if r.ConnID == connB {
			require.NotZero(t, r.EndAt, "the leaving device's row is closed")
		} else {
			require.Equal(t, connA, r.ConnID)
			require.Zero(t, r.EndAt, "the other device's row must stay open")
		}
	}
}

// The reaper goroutine is started by Start and stopped by Stop, without
// leaking goroutines or double-starting.
func TestReaperStartStopLifecycle(t *testing.T) {
	s, _, _ := newTestServiceWithStore(t)
	require.NoError(t, s.Start())
	require.NotNil(t, s.reaperStop)

	// Start is idempotent: no second goroutine/stop channel.
	require.NoError(t, s.Start())
	s.mut.RLock()
	stop := s.reaperStop
	s.mut.RUnlock()
	require.NotNil(t, stop)

	require.NoError(t, s.Stop())
	s.mut.RLock()
	stopped := s.reaperStop
	s.mut.RUnlock()
	require.Nil(t, stopped)

	// Restart works (Stop closed the old channel; Start opens a fresh one).
	require.NoError(t, s.Start())
	s.mut.RLock()
	restarted := s.reaperStop
	s.mut.RUnlock()
	require.NotNil(t, restarted)
	require.NoError(t, s.Stop())
}

// rtcd relays voice-activity as "vad" envelopes (NOT "rtc"): the production
// wire shape must drive the speaking indicators.
func TestVADEnvelopeDrivesVoicePresence(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	conn := joinCall(t, s, "chan1", "u1")

	hub.reset()
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageVAD,
		Data: rtc.Message{SessionID: conn, UserID: "u1", Type: rtc.VoiceOnMessage},
	})
	require.Equal(t, 1, hub.count(eventUserVoiceOn), "the vad envelope (rtcd's production VAD shape) must be relayed")
	cs, _ := s.channelCalls.get("chan1")
	sess, _ := cs.get(conn)
	require.True(t, sess.voiceOn)

	hub.reset()
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageVAD,
		Data: rtc.Message{SessionID: conn, UserID: "u1", Type: rtc.VoiceOffMessage},
	})
	require.Equal(t, 1, hub.count(eventUserVoiceOff))
	sess, _ = cs.get(conn)
	require.False(t, sess.voiceOn)
}

// Host succession on the host's departure is deterministic: the
// longest-tenured participant takes over.
func TestRemoveSessionElectsOldestRemainingHost(t *testing.T) {
	cs := newCallState(model.NewId(), "chan1", "host1")
	first := &session{userID: "u1", sessionID: "s1", startAt: 100}
	second := &session{userID: "u2", sessionID: "s2", startAt: 200}
	third := &session{userID: "u3", sessionID: "s3", startAt: 300} // same start as second, id breaks ties
	_, err := cs.addSession("s1", first, 0)
	require.NoError(t, err)
	_, err = cs.addSession("s3", third, 0)
	require.NoError(t, err)
	_, err = cs.addSession("s2", second, 0)
	require.NoError(t, err)
	require.Equal(t, "s1", cs.hostSessionID)

	removed, _ := cs.removeSession("s1")
	require.NotNil(t, removed)
	require.Equal(t, "s2", cs.hostSessionID, "earliest startAt wins; sessionID breaks ties")

	// Leaving the new host promotes the next-oldest.
	cs.removeSession("s2")
	require.Equal(t, "s3", cs.hostSessionID)
}
