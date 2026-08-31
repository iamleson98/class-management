// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/stretchr/testify/require"
)

func TestNewValidation(t *testing.T) {
	base := ServiceConfig{
		StoreFn:  func() StoreBridge { return newFakeStore() },
		ConfigFn: func() *model.Config { return &model.Config{} },
		Log:      mlog.CreateTestLogger(t),
		Hub:      &fakeHub{},
	}

	_, err := New(ServiceConfig{ConfigFn: base.ConfigFn, Hub: base.Hub})
	require.Error(t, err)
	_, err = New(ServiceConfig{StoreFn: base.StoreFn, Hub: base.Hub})
	require.Error(t, err)
	_, err = New(ServiceConfig{StoreFn: base.StoreFn, ConfigFn: base.ConfigFn})
	require.Error(t, err)

	badStore := base
	badStore.StoreFn = func() StoreBridge { return nil }
	_, err = New(badStore)
	require.Error(t, err, "nil store bridge must be rejected")

	badConfig := base
	badConfig.ConfigFn = func() *model.Config { return nil }
	_, err = New(badConfig)
	require.Error(t, err, "nil config must be rejected")

	s, err := New(base)
	require.NoError(t, err)
	require.NotNil(t, s.index)
	require.Len(t, s.shards, defaultShardCount)
}

func TestStartCallIdempotent(t *testing.T) {
	s, store, hub := newTestServiceWithStore(t)

	res1, err := s.StartCall(StartCallOpts{ChannelID: "chan1", OwnerID: "u1"})
	require.NoError(t, err)
	require.Equal(t, "ch:chan1", res1.CallID)
	require.Equal(t, 1, hub.count(eventCallStart))
	require.Len(t, store.call.calls, 1)

	// Second start reuses the live call: no duplicate persistence or event.
	res2, err := s.StartCall(StartCallOpts{ChannelID: "chan1", OwnerID: "u2"})
	require.NoError(t, err)
	require.Equal(t, res1.CallID, res2.CallID)
	require.Equal(t, 1, hub.count(eventCallStart))
	require.Len(t, store.call.calls, 1)

	// Validation.
	_, err = s.StartCall(StartCallOpts{ChannelID: "", OwnerID: "u1"})
	require.Error(t, err)
	_, err = s.StartCall(StartCallOpts{ChannelID: "chan1", OwnerID: ""})
	require.Error(t, err)
}

func TestStartCallDisabled(t *testing.T) {
	s, _, _ := newTestServiceWithConfig(t, &model.CallsSettings{Enable: ptrBool(false)})
	_, err := s.StartCall(StartCallOpts{ChannelID: "chan1", OwnerID: "u1"})
	require.ErrorIs(t, err, ErrCallsDisabled)
}

func TestStartCallRollbackOnPersistFailure(t *testing.T) {
	s, store, hub := newTestServiceWithStore(t)
	store.call.saveErr = errors.New("db down")

	_, err := s.StartCall(StartCallOpts{ChannelID: "chan1", OwnerID: "u1"})
	require.Error(t, err)
	require.Equal(t, 0, hub.count(eventCallStart))

	_, ok := s.shards.get("ch:chan1")
	require.False(t, ok, "in-memory state must be rolled back")

	// With the DB healthy again, the next start succeeds cleanly.
	store.call.saveErr = nil
	_, err = s.StartCall(StartCallOpts{ChannelID: "chan1", OwnerID: "u1"})
	require.NoError(t, err)
	require.Equal(t, 1, hub.count(eventCallStart))
}

func TestStartCallAssignsSFUHost(t *testing.T) {
	s, store, _ := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)

	res, err := s.StartCall(StartCallOpts{ChannelID: "chan1", OwnerID: "u1"})
	require.NoError(t, err)
	require.Equal(t, "127.0.0.1:8045", res.RTCDHost)

	cs, ok := s.shards.get(res.CallID)
	require.True(t, ok)
	require.Equal(t, "127.0.0.1:8045", cs.rtcdHost)
	require.Len(t, store.call.calls, 1)
}

func TestEndCall(t *testing.T) {
	s, store, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	joinCall(t, s, "chan1", "u1")
	joinCall(t, s, "chan1", "u2")

	hub.reset()
	require.NoError(t, s.EndCall("ch:chan1"))

	// Exactly one end boundary, one stats row, one broadcast.
	call, err := store.call.Get("ch:chan1")
	require.NoError(t, err)
	require.NotZero(t, call.EndAt)
	require.Equal(t, 1, hub.count(eventCallEnd))
	stats := store.stat.saved()
	require.Len(t, stats, 1)
	require.Equal(t, 2, stats[0].PeakParticipants)
	require.Equal(t, 2, stats[0].Participants)

	// Registry emptied; second end is an error; state lookup is not-found.
	_, ok := s.shards.get("ch:chan1")
	require.False(t, ok)
	require.ErrorIs(t, s.EndCall("ch:chan1"), ErrCallNotFound)
	_, err = s.GetCallState("ch:chan1")
	require.ErrorIs(t, err, ErrCallNotFound)

	// Unknown call.
	require.ErrorIs(t, s.EndCall("ch:unknown"), ErrCallNotFound)
}

func TestHandleJoin(t *testing.T) {
	s, store, hub := newTestServiceWithStore(t)
	client := attachFakeRTCD(t, s)

	connID := joinCall(t, s, "chan1", "u1")
	callID := CallIDForChannel("chan1")

	// SFU session registered with the stable sessionID.
	joins := client.sentOfType("join")
	require.Len(t, joins, 1)
	require.Equal(t, connID, joins[0].Data.(map[string]any)["sessionID"])

	// Join ack is unicast. With no ICE servers configured the default is
	// nil — correct: browsers reach the public SFU via host candidates
	// (see ice_servers.go). Configured delivery is covered by TestIceServers.
	ack := requireUnicast(t, hub, eventJoin, connID)
	require.Nil(t, ack.data["iceServers"])

	// Presence fan-out.
	bcast := requireChannelBroadcast(t, hub, eventUserJoined, "chan1")
	require.Equal(t, "u1", bcast.data["user_id"])
	require.Equal(t, connID, bcast.data["session_id"])

	// Full call state unicast as a JSON string payload.
	state := requireUnicast(t, hub, eventCallState, connID)
	raw, ok := state.data["call"].(string)
	require.True(t, ok)
	var view CallStateView
	require.NoError(t, json.Unmarshal([]byte(raw), &view))
	require.Equal(t, callID, view.CallID)
	require.Equal(t, 1, view.Participants)
	require.Equal(t, connID, view.HostSessionID)
	require.Len(t, view.Sessions, 1)

	// Join boundary persisted.
	sess, err := store.sess.GetByCallAndUser(callID, "u1")
	require.NoError(t, err)
	require.Equal(t, connID, sess.ConnID)
	require.Zero(t, sess.EndAt)

	// Session resolvable O(1) from the index.
	gotSess, gotCS, err := s.sessionByConn(connID)
	require.NoError(t, err)
	require.Equal(t, "u1", gotSess.userID)
	require.Equal(t, callID, gotCS.callID)
}

func TestHandleJoinWithoutRTCD(t *testing.T) {
	s, _, _ := newTestServiceWithStore(t)
	errMsg := sendMessage(t, s, "conn1", "u1", msgJoin, map[string]any{"channelID": "chan1"})
	require.NotEmpty(t, errMsg)
}

func TestHandleJoinMaxParticipants(t *testing.T) {
	s, _, hub := newTestServiceWithConfig(t, &model.CallsSettings{
		Enable:              ptrBool(true),
		MaxCallParticipants: ptrInt(2),
	})
	attachFakeRTCD(t, s)

	joinCall(t, s, "chan1", "u1")
	joinCall(t, s, "chan1", "u2")

	errMsg := sendMessage(t, s, "conn3", "u3", msgJoin, map[string]any{"channelID": "chan1"})
	require.Equal(t, ErrMaxParticipants.Error(), errMsg)

	cs, ok := s.shards.get(CallIDForChannel("chan1"))
	require.True(t, ok)
	require.Equal(t, 2, cs.participants())
	// The rejected joiner receives a unicast error event, matching the
	// plugin's error reporting contract.
	require.Equal(t, 1, hub.count(eventError))

	// The rejected session must not linger in the reverse index.
	_, _, err := s.sessionByConn("conn3")
	require.ErrorIs(t, err, ErrSessionNotFound)
}

func TestHandleJoinRequiresChannelID(t *testing.T) {
	s, _, _ := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	errMsg := sendMessage(t, s, "conn1", "u1", msgJoin, map[string]any{})
	require.NotEmpty(t, errMsg)
}

func TestHandleLeaveTeardownAndCallEnd(t *testing.T) {
	s, store, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)

	conn1 := joinCall(t, s, "chan1", "u1")
	conn2 := joinCall(t, s, "chan1", "u2")
	hub.reset()

	// First leave: session torn down but the call lives on.
	mustSend(t, s, conn1, "u1", msgLeave, map[string]any{"channelID": "chan1"})
	left := requireChannelBroadcast(t, hub, eventUserLeft, "chan1")
	require.Equal(t, "u1", left.data["user_id"])
	require.Equal(t, conn1, left.data["session_id"])
	require.Equal(t, 0, hub.count(eventCallEnd))
	_, _, err := s.sessionByConn(conn1)
	require.ErrorIs(t, err, ErrSessionNotFound)

	sess, err := store.sess.GetByCallAndUser(CallIDForChannel("chan1"), "u1")
	require.NoError(t, err)
	require.NotZero(t, sess.EndAt, "leave boundary must be persisted")

	cs, ok := s.shards.get(CallIDForChannel("chan1"))
	require.True(t, ok)
	require.Equal(t, "u2", cs.hostUserID(), "remaining participant must inherit the host role")

	// Duplicate leave is not an error.
	mustSend(t, s, conn1, "u1", msgLeave, map[string]any{"channelID": "chan1"})

	// Last leave ends the call.
	hub.reset()
	mustSend(t, s, conn2, "u2", msgLeave, map[string]any{"channelID": "chan1"})
	require.Equal(t, 1, hub.count(eventCallEnd))
	_, ok = s.shards.get(CallIDForChannel("chan1"))
	require.False(t, ok)
	stats := store.stat.saved()
	require.Len(t, stats, 1)
	require.Equal(t, 2, stats[0].PeakParticipants)
}

func TestHandleReconnect(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)

	conn1 := joinCall(t, s, "chan1", "u1")
	hub.reset()

	mustSend(t, s, "conn1-new", "u1", msgReconnect, map[string]any{
		"channelID":      "chan1",
		"originalConnID": conn1,
	})

	// Index + state now resolve the NEW connection under the SAME sessionID.
	sess, cs, err := s.sessionByConn("conn1-new")
	require.NoError(t, err)
	require.Equal(t, conn1, sess.sessionID, "stable sessionID must survive reconnects")
	require.Equal(t, CallIDForChannel("chan1"), cs.callID)
	_, _, err = s.sessionByConn(conn1)
	require.ErrorIs(t, err, ErrSessionNotFound)

	// Full state resent to the new connection.
	requireUnicast(t, hub, eventCallState, "conn1-new")

	// Reconnect for someone else's session is rejected.
	errMsg := sendMessage(t, s, "evil-conn", "u2", msgReconnect, map[string]any{
		"channelID":      "chan1",
		"originalConnID": conn1,
	})
	require.Equal(t, ErrSessionNotFound.Error(), errMsg)
}

func TestPresenceToggles(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	conn := joinCall(t, s, "chan1", "u1")

	// Mute / unmute.
	hub.reset()
	mustSend(t, s, conn, "u1", msgMute, nil)
	require.Equal(t, 1, hub.count(eventUserMuted))
	mustSend(t, s, conn, "u1", msgUnmute, nil)
	require.Equal(t, 1, hub.count(eventUserUnmuted))
	cs, _ := s.shards.get(CallIDForChannel("chan1"))
	sess, _ := cs.get(conn)
	require.True(t, sess.unmuted)

	// Mute for an unknown connection is an error.
	errMsg := sendMessage(t, s, "ghost", "u1", msgMute, nil)
	require.Equal(t, ErrSessionNotFound.Error(), errMsg)

	// Video on/off.
	hub.reset()
	mustSend(t, s, conn, "u1", msgVideoOn, nil)
	require.Equal(t, 1, hub.count(eventUserVideoOn))
	mustSend(t, s, conn, "u1", msgVideoOff, nil)
	require.Equal(t, 1, hub.count(eventUserVideoOff))

	// Screen on/off.
	hub.reset()
	mustSend(t, s, conn, "u1", msgScreenOn, nil)
	require.Equal(t, 1, hub.count(eventUserScreenOn))
	mustSend(t, s, conn, "u1", msgScreenOff, nil)
	require.Equal(t, 1, hub.count(eventUserScreenOff))

	// Raised hand carries a timestamp; lowering resets it to 0.
	hub.reset()
	mustSend(t, s, conn, "u1", msgRaiseHand, nil)
	raised := requireChannelBroadcast(t, hub, eventUserRaiseHand, "chan1")
	require.NotZero(t, raised.data["raised_hand"])
	mustSend(t, s, conn, "u1", msgUnraiseHand, nil)
	lowered := requireChannelBroadcast(t, hub, eventUserUnraiseHand, "chan1")
	require.Equal(t, int64(0), lowered.data["raised_hand"])
}

func TestScreenSharingSingleSharer(t *testing.T) {
	s, _, _ := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	conn1 := joinCall(t, s, "chan1", "u1")
	conn2 := joinCall(t, s, "chan1", "u2")

	mustSend(t, s, conn1, "u1", msgScreenOn, nil)

	// A second sharer is rejected.
	errMsg := sendMessage(t, s, conn2, "u2", msgScreenOn, nil)
	require.NotEmpty(t, errMsg)

	// The original sharer may stop and re-start.
	mustSend(t, s, conn1, "u1", msgScreenOff, nil)
	mustSend(t, s, conn2, "u2", msgScreenOn, nil)
}

func TestScreenSharingDisabled(t *testing.T) {
	s, _, _ := newTestServiceWithConfig(t, &model.CallsSettings{
		Enable:             ptrBool(true),
		AllowScreenSharing: ptrBool(false),
	})
	attachFakeRTCD(t, s)
	conn := joinCall(t, s, "chan1", "u1")

	errMsg := sendMessage(t, s, conn, "u1", msgScreenOn, nil)
	require.NotEmpty(t, errMsg)
}

func TestHandleCallStateRequest(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	joinCall(t, s, "chan1", "u1")

	hub.reset()
	mustSend(t, s, "observer", "u2", msgCallState, map[string]any{"channelID": "chan1"})
	requireUnicast(t, hub, eventCallState, "observer")

	errMsg := sendMessage(t, s, "observer", "u2", msgCallState, map[string]any{"channelID": "no-such"})
	require.Equal(t, ErrCallNotFound.Error(), errMsg)
	errMsg = sendMessage(t, s, "observer", "u2", msgCallState, map[string]any{})
	require.NotEmpty(t, errMsg)
}

func TestHandleUnknownMessageType(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	s.HandleClientMessage("conn1", "u1", "bogus_action", nil)
	require.Equal(t, 1, hub.count(eventError))
}

func TestHandleClientMessageIdentityRequired(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	s.HandleClientMessage("", "u1", msgJoin, nil)
	s.HandleClientMessage("conn1", "", msgJoin, nil)
	require.Equal(t, 0, hub.count(eventError), "no identity -> silently dropped, no error event")
}
