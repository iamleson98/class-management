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
	name string
	data map[string]any
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
		Log:      mlog.CreateTestLogger(),
	})
	require.NoError(t, err)
	return svc, hub
}

// seedCall registers an in-progress call with one joined session and returns
// the call state.
func seedCall(s *CallService, callID, channelID, userID, connID string) *callState {
	cs := newCallState(callID, channelID, userID, "rtcd-host")
	sess := &session{
		userID:    userID,
		channelID: channelID,
		callID:    callID,
		sessionID: connID,
		connID:    connID,
		unmuted:   true,
		startAt:   model.GetMillis(),
	}
	cs.addSession(connID, sess)
	shard := s.shards.shardFor(callID)
	shard.getOrCreate(callID, func() *callState { return cs })
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
