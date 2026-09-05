// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

// recordingHub captures published events for assertions.
type recordingHub struct {
	events []publishedEvent
}

type publishedEvent struct {
	name  string
	data  map[string]any
	bcast *model.WebsocketBroadcast
}

func (h *recordingHub) Publish(event string, data map[string]any, broadcast *model.WebsocketBroadcast) {
	h.events = append(h.events, publishedEvent{name: event, data: data, bcast: broadcast})
}

// nilStoreBridge satisfies StoreBridge without a database (unused paths).
type nilStoreBridge struct{}

func (nilStoreBridge) Call() store.CallStore                 { return nil }
func (nilStoreBridge) CallSession() store.CallSessionStore   { return nil }
func (nilStoreBridge) CallJob() store.CallJobStore           { return nil }
func (nilStoreBridge) CallStat() store.CallStatStore         { return nil }
func (nilStoreBridge) CallsChannel() store.CallsChannelStore { return nil }

func newTestService(t *testing.T) (*CallService, *recordingHub) {
	t.Helper()
	enable := true
	cfg := &model.Config{}
	cfg.CallsSettings.Enable = &enable

	hub := &recordingHub{}
	svc, err := New(ServiceConfig{
		StoreFn:  func() StoreBridge { return nilStoreBridge{} },
		ConfigFn: func() *model.Config { return cfg },
		Hub:      hub,
		Log:      mlog.CreateTestLogger(t),
	})
	require.NoError(t, err)
	return svc, hub
}

// seedCall registers an in-progress call with one joined session and returns
// the call state.
func seedCall(s *CallService, callID, channelID, userID, connID string) *callState {
	cs := newCallState(callID, channelID, "rtcd-host")
	sess := &session{
		userID:    userID,
		channelID: channelID,
		callID:    callID,
		sessionID: connID,
		connID:    connID,
		unmuted:   true,
		startAt:   model.GetMillis(),
	}
	cs.addSession(connID, sess, 0)
	shard := s.shards.shardFor(callID)
	shard.getOrCreate(callID, func() *callState { return cs })
	// Maintain the global index invariant the handlers rely on.
	s.index.link(connID, connID, cs)
	return cs
}

func TestHandleReactBroadcastsUserReacted(t *testing.T) {
	s, hub := newTestService(t)
	seedCall(s, "call1", "ch1", "u1", "conn1")

	err := s.handleReact("conn1", "u1", map[string]any{
		"data": `{"name":"tada","unified":"1f389","literal":"🎉"}`,
	})
	require.NoError(t, err)
	require.Len(t, hub.events, 1)

	ev := hub.events[0]
	assert.Equal(t, eventUserReacted, ev.name)
	assert.Equal(t, "u1", ev.data["user_id"])
	assert.Equal(t, "conn1", ev.data["session_id"])
	assert.NotNil(t, ev.data["timestamp"])

	emoji, ok := ev.data["emoji"].(map[string]any)
	require.True(t, ok, "emoji payload should be a map")
	assert.Equal(t, "tada", emoji["name"])
	assert.Equal(t, "1f389", emoji["unified"])
	assert.Equal(t, "🎉", emoji["literal"])
}

func TestHandleReactRejectsInvalidPayload(t *testing.T) {
	s, _ := newTestService(t)
	seedCall(s, "call1", "ch1", "u1", "conn1")

	err := s.handleReact("conn1", "u1", map[string]any{"data": "not-json{"})
	assert.Error(t, err)

	// Empty reactions are rejected too.
	err = s.handleReact("conn1", "u1", map[string]any{"data": `{"name":""}`})
	assert.Error(t, err)
}

func TestHandleReactRequiresJoinedSession(t *testing.T) {
	s, _ := newTestService(t)
	seedCall(s, "call1", "ch1", "u1", "conn1")

	// A connection that never joined the call.
	err := s.handleReact("stranger", "u2", map[string]any{
		"data": `{"name":"tada","literal":"🎉"}`,
	})
	assert.Error(t, err)
}

func TestCallPostProps(t *testing.T) {
	start := callPostPropsStart(1234)
	assert.Equal(t, int64(1234), start["start_at"])
	assert.Equal(t, "Call started", start["title"])

	end := callPostPropsEnd(5678, []string{"u1", "u2"})
	assert.Equal(t, int64(5678), end["end_at"])
	participants, ok := end["participants"].([]string)
	require.True(t, ok)
	assert.Equal(t, []string{"u1", "u2"}, participants)

	// nil participants become an empty slice (stable JSON).
	end = callPostPropsEnd(5678, nil)
	participants, ok = end["participants"].([]string)
	require.True(t, ok)
	assert.Empty(t, participants)
}

func TestGetConfig(t *testing.T) {
	s, _ := newTestService(t)
	// No rtcd manager configured → enabled stays false even with the
	// feature flag on.
	cfg := s.GetConfig()
	assert.False(t, cfg.Enabled)
	assert.True(t, cfg.AllowScreenSharing)
	assert.True(t, cfg.EnableVideo)
	assert.True(t, cfg.EnableReactions)
	assert.False(t, cfg.AllowRecording)

	// The view is JSON-serializable (REST response shape).
	_, err := json.Marshal(cfg)
	assert.NoError(t, err)
}

// ─── Round 2: per-channel enable/disable, states feed, dismiss sync ─────

// fakeCallsChannelStore is an in-memory CallsChannelStore.
type fakeCallsChannelStore struct {
	rows map[string]*model.CallsChannel
}

func (f *fakeCallsChannelStore) Get(channelID string) (*model.CallsChannel, error) {
	if cc, ok := f.rows[channelID]; ok {
		return cc, nil
	}
	return nil, store.NewErrNotFound("CallsChannel", channelID)
}

func (f *fakeCallsChannelStore) Save(cc *model.CallsChannel) (*model.CallsChannel, error) {
	if f.rows == nil {
		f.rows = map[string]*model.CallsChannel{}
	}
	saved := *cc
	f.rows[cc.ChannelID] = &saved
	return &saved, nil
}

func (f *fakeCallsChannelStore) Delete(channelID string) error {
	delete(f.rows, channelID)
	return nil
}

// errSessionStore satisfies CallSessionStore with not-found responses so the
// persistence paths in removeSession/EndCall skip safely during tests.
type errSessionStore struct{}

func (errSessionStore) Get(string) (*model.CallSession, error) {
	return nil, store.NewErrNotFound("CallSession", "")
}

func (errSessionStore) GetByCall(string) ([]*model.CallSession, error) {
	return nil, nil
}

func (errSessionStore) GetByCallAndUser(string, string) (*model.CallSession, error) {
	return nil, store.NewErrNotFound("CallSession", "")
}

func (errSessionStore) Save(s *model.CallSession) (*model.CallSession, error) { return s, nil }

func (errSessionStore) Update(s *model.CallSession) (*model.CallSession, error) {
	return s, nil
}

func (errSessionStore) EndSession(callID, connID string, endAt int64) (int64, error) {
	return 0, nil
}

func (errSessionStore) EndOpenSessions(callID string, endAt int64) (int64, error) {
	return 0, nil
}

func (errSessionStore) Delete(string) error { return nil }

// bridgeWithCallsChannel wraps nilStoreBridge with working CallsChannel and
// CallSession stores.
type bridgeWithCallsChannel struct {
	nilStoreBridge
	callsChannel store.CallsChannelStore
}

func (b bridgeWithCallsChannel) CallsChannel() store.CallsChannelStore { return b.callsChannel }
func (b bridgeWithCallsChannel) CallSession() store.CallSessionStore   { return errSessionStore{} }

func newTestServiceWithChannels(t *testing.T, cc store.CallsChannelStore) (*CallService, *recordingHub) {
	t.Helper()
	enable := true
	cfg := &model.Config{}
	cfg.CallsSettings.Enable = &enable

	hub := &recordingHub{}
	svc, err := New(ServiceConfig{
		StoreFn:  func() StoreBridge { return bridgeWithCallsChannel{callsChannel: cc} },
		ConfigFn: func() *model.Config { return cfg },
		Hub:      hub,
		Log:      mlog.CreateTestLogger(t),
	})
	require.NoError(t, err)
	return svc, hub
}

func TestGetCallsChannelDefaultsEnabled(t *testing.T) {
	s, _ := newTestServiceWithChannels(t, &fakeCallsChannelStore{})
	view := s.GetCallsChannel("chan1")
	assert.True(t, view.Enabled, "channels without a row default to enabled")
	assert.Equal(t, "chan1", view.ChannelID)
}

func TestSetCallsChannelEnabledPersistsAndBroadcasts(t *testing.T) {
	cc := &fakeCallsChannelStore{}
	s, hub := newTestServiceWithChannels(t, cc)

	require.NoError(t, s.SetCallsChannelEnabled("chan1", false, "admin1"))
	assert.False(t, s.GetCallsChannel("chan1").Enabled)
	require.Len(t, hub.events, 1)
	assert.Equal(t, eventChannelDisableVoice, hub.events[0].name)
	assert.Equal(t, "chan1", hub.events[0].data["channel_id"])

	require.NoError(t, s.SetCallsChannelEnabled("chan1", true, "admin1"))
	assert.True(t, s.GetCallsChannel("chan1").Enabled)
	assert.Equal(t, eventChannelEnableVoice, hub.events[1].name)

	// The join path honors the disabled preference.
	require.NoError(t, s.SetCallsChannelEnabled("chan1", false, "admin1"))
	err := s.handleJoin("conn1", "u1", map[string]any{"channelID": "chan1"})
	assert.ErrorIs(t, err, ErrChannelCallsDisabled)
}

func TestDismissNotificationBroadcastsToUser(t *testing.T) {
	s, hub := newTestServiceWithChannels(t, &fakeCallsChannelStore{})

	require.NoError(t, s.DismissNotification("chan1", "u9"))
	require.Len(t, hub.events, 1)
	ev := hub.events[0]
	assert.Equal(t, eventUserDismissedNotification, ev.name)
	assert.Equal(t, "chan1", ev.data["channel_id"])
	assert.Equal(t, "u9", ev.data["user_id"])
	assert.Equal(t, "u9", ev.bcast.UserId, "dismissal is scoped to the dismissing user")

	assert.Error(t, s.DismissNotification("", "u9"))
	assert.Error(t, s.DismissNotification("chan1", ""))
}

func TestGetCallStatesListsInProgressCalls(t *testing.T) {
	s, _ := newTestServiceWithChannels(t, &fakeCallsChannelStore{})
	seedCall(s, "call1", "ch1", "u1", "conn1")
	seedCall(s, "call2", "ch2", "u2", "conn2")

	states := s.GetCallStates()
	require.Len(t, states, 2)
	ids := []string{states[0].CallID, states[1].CallID}
	assert.Contains(t, ids, "call1")
	assert.Contains(t, ids, "call2")
	for _, st := range states {
		assert.Equal(t, 1, st.Participants)
		assert.NotEmpty(t, st.Sessions)
	}
}

func TestHostRemoveBroadcastsUserRemoved(t *testing.T) {
	s, hub := newTestServiceWithChannels(t, &fakeCallsChannelStore{})
	cs := seedCall(s, "call1", "ch1", "host", "connHost")
	sess := &session{
		userID:    "victim",
		channelID: "ch1",
		callID:    "call1",
		sessionID: "connVictim",
		connID:    "connVictim",
		unmuted:   true,
		startAt:   model.GetMillis(),
	}
	cs.addSession("connVictim", sess, 0)

	// The SFU close is logged-only when no rtcd host exists; the presence
	// broadcasts must still fire.
	hub.events = nil
	err := s.RemoveSession("call1", "host", "connVictim")
	assert.NoError(t, err, "removal succeeds even when the SFU close is logged-only")

	var sawRemoved bool
	for _, ev := range hub.events {
		if ev.name == eventUserRemoved {
			sawRemoved = true
			assert.Equal(t, "victim", ev.data["user_id"])
			assert.Equal(t, "host", ev.data["host_id"])
		}
	}
	assert.True(t, sawRemoved, "user_removed should broadcast on host removal")
}

func TestLowerHandNoticeCarriesHostID(t *testing.T) {
	s, hub := newTestServiceWithChannels(t, &fakeCallsChannelStore{})
	cs := seedCall(s, "call1", "ch1", "host", "connHost")
	sess := &session{
		userID:    "u2",
		channelID: "ch1",
		callID:    "call1",
		sessionID: "conn2",
		connID:    "conn2",
		unmuted:   true,
		startAt:   model.GetMillis(),
	}
	cs.addSession("conn2", sess, 0)

	hub.events = nil
	err := s.LowerHand("call1", "host", "conn2")
	require.NoError(t, err)
	require.NotEmpty(t, hub.events)

	for _, ev := range hub.events {
		if ev.name == eventHostLowerHand {
			assert.Equal(t, "host", ev.data["host_id"], "lower-hand notice carries the acting host id")
		}
	}
}
