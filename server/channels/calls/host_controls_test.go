// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"sync"
	"testing"

	rtcd "github.com/mattermost/rtcd/service"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/stretchr/testify/require"
)

// joinedTriad joins three users to one channel call; u1 is the initial host.
func joinedTriad(t *testing.T, s *CallService) (hostConn, c2, c3 string) {
	t.Helper()
	hostConn = joinCall(t, s, "chan1", "host")
	c2 = joinCall(t, s, "chan1", "user2")
	c3 = joinCall(t, s, "chan1", "user3")
	return
}

func TestHostControlAuthorization(t *testing.T) {
	s, _, _ := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	hostConn, c2, _ := joinedTriad(t, s)
	callID := liveCallID(t, s, "chan1")

	// Non-hosts are rejected.
	err := s.MuteSession(callID, "user2", hostConn)
	require.ErrorIs(t, err, ErrNotCallHost)
	err = s.RemoveSession(callID, "user2", hostConn)
	require.ErrorIs(t, err, ErrNotCallHost)
	err = s.EndCallByHost(callID, "user2")
	require.ErrorIs(t, err, ErrNotCallHost)
	err = s.MuteOthers(callID, "user2")
	require.ErrorIs(t, err, ErrNotCallHost)

	// Host may act.
	require.NoError(t, s.MuteSession(callID, "host", c2))

	// Unknown call: a well-formed 26-char id that matches no generation.
	err = s.MuteSession(model.NewId(), "host", c2)
	require.ErrorIs(t, err, ErrCallNotFound)
}

func TestMakeHost(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	hostConn, _, _ := joinedTriad(t, s)
	callID := liveCallID(t, s, "chan1")

	// Transferring to a user not in the call fails.
	err := s.MakeHost(callID, "host", "absent")
	require.ErrorIs(t, err, ErrSessionNotFound)

	require.NoError(t, s.MakeHost(callID, "host", "user3"))
	changed := requireChannelBroadcast(t, hub, eventCallHostChanged, "chan1")
	require.Equal(t, "user3", changed.data["hostID"])

	cs, _ := s.shards.get(callID)
	require.Equal(t, "user3", cs.hostUserID())

	// The old host no longer holds host powers.
	err = s.MuteOthers(callID, "host")
	require.ErrorIs(t, err, ErrNotCallHost)

	_ = hostConn
}

func TestMuteSessionAndMuteOthers(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	hostConn, c2, c3 := joinedTriad(t, s)
	callID := liveCallID(t, s, "chan1")

	// Host mutes user2: unicast notice + channel presence.
	hub.reset()
	require.NoError(t, s.MuteSession(callID, "host", c2))
	requireUnicast(t, hub, eventHostMute, c2)
	require.Equal(t, 1, hub.count(eventUserMuted))
	cs, _ := s.shards.get(callID)
	sess, _ := cs.get(c2)
	require.False(t, sess.unmuted)

	// Unknown session.
	err := s.MuteSession(callID, "host", "nope")
	require.ErrorIs(t, err, ErrSessionNotFound)

	// MuteOthers sweeps the remaining unmuted participants (skips the host).
	hub.reset()
	require.NoError(t, s.MuteOthers(callID, "host"))
	require.Equal(t, 1, hub.count(eventUserMuted), "only user3 was still unmuted")
	muted := hub.byEvent(eventUserMuted)
	require.Equal(t, c3, muted[0].data["session_id"])
	sess3, _ := cs.get(c3)
	require.False(t, sess3.unmuted)

	_ = hostConn
}

func TestHostScreenOffAndLowerHand(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	_, c2, _ := joinedTriad(t, s)
	callID := liveCallID(t, s, "chan1")

	// user2 shares and raises a hand.
	mustSend(t, s, c2, "user2", msgScreenOn, nil)
	mustSend(t, s, c2, "user2", msgRaiseHand, nil)
	hub.reset()

	// Host stops the screen.
	require.NoError(t, s.ScreenOff(callID, "host", c2))
	requireUnicast(t, hub, eventHostScreenOff, c2)
	require.Equal(t, 1, hub.count(eventUserScreenOff))
	cs, _ := s.shards.get(callID)
	sess, _ := cs.get(c2)
	require.False(t, sess.screenOn)

	// Host lowers the hand.
	hub.reset()
	require.NoError(t, s.LowerHand(callID, "host", c2))
	requireUnicast(t, hub, eventHostLowerHand, c2)
	require.Equal(t, 1, hub.count(eventUserUnraiseHand))
	sess, _ = cs.get(c2)
	require.Zero(t, sess.raisedHandAt)

	// Unknown session.
	require.ErrorIs(t, s.ScreenOff(callID, "host", "nope"), ErrSessionNotFound)
	require.ErrorIs(t, s.LowerHand(callID, "host", "nope"), ErrSessionNotFound)
}

func TestRemoveSession(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	hostConn, c2, _ := joinedTriad(t, s)
	callID := liveCallID(t, s, "chan1")

	hub.reset()
	require.NoError(t, s.RemoveSession(callID, "host", c2))

	// Target notified, presence fanned out, session gone.
	requireUnicast(t, hub, eventHostRemoved, c2)
	require.Equal(t, 1, hub.count(eventUserLeft))
	_, _, err := s.sessionByConn(c2)
	require.ErrorIs(t, err, ErrSessionNotFound)
	cs, _ := s.shards.get(callID)
	require.Equal(t, 2, cs.participants(), "the call lives on")

	// Double-remove: the session is already gone from the call state.
	require.ErrorIs(t, s.RemoveSession(callID, "host", c2), ErrSessionNotFound)
	require.Equal(t, 1, hub.count(eventHostRemoved))

	// Unknown session.
	require.ErrorIs(t, s.RemoveSession(callID, "host", "nope"), ErrSessionNotFound)

	_ = hostConn
}

func TestEndCallByHost(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	joinedTriad(t, s)
	callID := liveCallID(t, s, "chan1")

	hub.reset()
	require.NoError(t, s.EndCallByHost(callID, "host"))
	require.Equal(t, 1, hub.count(eventCallEnd))
	_, ok := s.shards.get(callID)
	require.False(t, ok)
	_, ok = s.channelCalls.get("chan1")
	require.False(t, ok, "the channel's live-call mapping must be gone too")

	// The call is gone: further host actions are not-found.
	require.ErrorIs(t, s.EndCallByHost(callID, "host"), ErrCallNotFound)
}

func TestEndCallProtectsNewGeneration(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	_, c2, _ := joinedTriad(t, s)
	callID := liveCallID(t, s, "chan1")

	// Grab the OLD generation's state, then end the call through the API.
	oldCS, ok := s.shards.get(callID)
	require.True(t, ok)
	require.NoError(t, s.EndCall(callID))

	// A new call starts on the same channel (new generation, fresh id).
	mustSend(t, s, "newconn", "newuser", msgJoin, map[string]any{"channelID": "chan1"})

	hub.reset()
	// A straggler teardown for the OLD generation (e.g. an SFU close racing
	// the new call) must not broadcast call_end or delete the new state.
	// The old generation already ended, so the second end loses cleanly.
	err := s.endCallState(oldCS, model.GetMillis())
	require.ErrorIs(t, err, ErrCallEnded)
	require.Equal(t, 0, hub.count(eventCallEnd))

	// The new generation lives under a FRESH id in its own shard slot;
	// the channel index points at it.
	newCS, ok := s.channelCalls.get("chan1")
	require.True(t, ok)
	require.NotEqual(t, callID, newCS.callID, "the new generation must have a fresh identity")
	require.Equal(t, 1, newCS.participants(), "the new generation must survive")
	require.Equal(t, "newuser", newCS.hostUserID())

	// The old generation's session is gone from the index.
	_, _, err = s.sessionByConn(c2)
	require.ErrorIs(t, err, ErrSessionNotFound)
}

// TestConcurrentJoinLeave exercises the full join/leave/mute/reconnect path
// from many goroutines across several channels. Run with -race to verify the
// locking discipline (shard locks + session registry + callState accessors).
func TestConcurrentJoinLeave(t *testing.T) {
	s, _, _ := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)

	const channels = 4
	const usersPerChannel = 8

	var wg sync.WaitGroup
	for ch := 0; ch < channels; ch++ {
		channelID := model.NewId()
		for u := 0; u < usersPerChannel; u++ {
			wg.Add(1)
			go func(channelID, userIndex string) {
				defer wg.Done()
				conn := model.NewId()
				userID := "user-" + userIndex

				require.True(t, sendConcurrent(s, conn, userID, msgJoin, map[string]any{"channelID": channelID}),
					"join must not error")

				// Presence toggles.
				require.True(t, sendConcurrent(s, conn, userID, msgMute, nil), "mute must not error")
				require.True(t, sendConcurrent(s, conn, userID, msgUnmute, nil), "unmute must not error")
				require.True(t, sendConcurrent(s, conn, userID, msgVideoOn, nil), "video_on must not error")
				require.True(t, sendConcurrent(s, conn, userID, msgRaiseHand, nil), "raise_hand must not error")

				// Simulate a websocket reconnect.
				newConn := model.NewId()
				require.True(t, sendConcurrent(s, newConn, userID, msgReconnect, map[string]any{
					"channelID":      channelID,
					"originalConnID": conn,
				}), "reconnect must not error")

				// SFU closes the rtc session (peer timeout) -> teardown.
				s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
					Type: rtcd.ClientMessageClose,
					Data: map[string]string{"sessionID": conn},
				})

				// Leave on the (already closed) session is a clean no-op.
				require.True(t, sendConcurrent(s, newConn, userID, msgLeave, map[string]any{"channelID": channelID}),
					"leave must not error")
			}(channelID, string(rune('a'+u)))
		}
	}
	wg.Wait()

	// Every call ended as its last participant was closed out; the global
	// index holds nothing.
	require.Nil(t, s.index.byConnID("anything"), "index lookups for absent ids must be nil")
	require.Nil(t, s.index.bySessionID("anything"))
}
