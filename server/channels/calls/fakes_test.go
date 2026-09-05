// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"fmt"
	"sync"
	"testing"

	rtcd "github.com/mattermost/rtcd/service"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

// ─── Hub fake ───────────────────────────────────────────────────────

type hubEvent struct {
	event     string
	data      map[string]any
	broadcast *model.WebsocketBroadcast
}

type fakeHub struct {
	mut    sync.Mutex
	events []hubEvent
}

func (h *fakeHub) Publish(event string, data map[string]any, broadcast *model.WebsocketBroadcast) {
	h.mut.Lock()
	defer h.mut.Unlock()
	h.events = append(h.events, hubEvent{event: event, data: data, broadcast: broadcast})
}

func (h *fakeHub) byEvent(event string) []hubEvent {
	h.mut.Lock()
	defer h.mut.Unlock()
	var out []hubEvent
	for _, e := range h.events {
		if e.event == event {
			out = append(out, e)
		}
	}
	return out
}

func (h *fakeHub) count(event string) int { return len(h.byEvent(event)) }

func (h *fakeHub) reset() {
	h.mut.Lock()
	defer h.mut.Unlock()
	h.events = nil
}

// requireUnicast asserts the event was published exactly once, targeted at
// the given connection.
func requireUnicast(t *testing.T, h *fakeHub, event, connID string) hubEvent {
	t.Helper()
	events := h.byEvent(event)
	require.Len(t, events, 1, "expected exactly one %s event", event)
	e := events[0]
	require.NotNil(t, e.broadcast)
	require.Equal(t, connID, e.broadcast.ConnectionId)
	return e
}

// requireChannelBroadcast asserts the event was published exactly once,
// scoped to the given channel.
func requireChannelBroadcast(t *testing.T, h *fakeHub, event, channelID string) hubEvent {
	t.Helper()
	events := h.byEvent(event)
	require.Len(t, events, 1, "expected exactly one %s event", event)
	e := events[0]
	require.NotNil(t, e.broadcast)
	require.Equal(t, channelID, e.broadcast.ChannelId)
	return e
}

// ─── Store fakes ────────────────────────────────────────────────────

type fakeCallStore struct {
	mut     sync.Mutex
	calls   map[string]*model.Call
	saveErr error
}

func newFakeCallStore() *fakeCallStore { return &fakeCallStore{calls: map[string]*model.Call{}} }

func (f *fakeCallStore) Get(callID string) (*model.Call, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	if c, ok := f.calls[callID]; ok {
		cp := *c
		return &cp, nil
	}
	return nil, fmt.Errorf("call not found: %s", callID)
}

func (f *fakeCallStore) GetActiveByChannel(channelID string) (*model.Call, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	for _, c := range f.calls {
		if c.ChannelID == channelID && c.EndAt == 0 {
			cp := *c
			return &cp, nil
		}
	}
	return nil, fmt.Errorf("no active call for channel %s", channelID)
}

func (f *fakeCallStore) Search(opts store.CallFilterOpts) ([]*model.Call, error) { return nil, nil }

func (f *fakeCallStore) Save(call *model.Call) (*model.Call, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	if f.saveErr != nil {
		return nil, f.saveErr
	}
	cp := *call
	f.calls[call.ID] = &cp
	return &cp, nil
}

func (f *fakeCallStore) Update(call *model.Call) (*model.Call, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	if _, ok := f.calls[call.ID]; !ok {
		return nil, fmt.Errorf("call not found: %s", call.ID)
	}
	cp := *call
	f.calls[call.ID] = &cp
	return &cp, nil
}

func (f *fakeCallStore) Delete(callID string) error {
	f.mut.Lock()
	defer f.mut.Unlock()
	delete(f.calls, callID)
	return nil
}

type fakeCallSessionStore struct {
	mut      sync.Mutex
	sessions []*model.CallSession
}

func newFakeCallSessionStore() *fakeCallSessionStore { return &fakeCallSessionStore{} }

func (f *fakeCallSessionStore) Get(sessionID string) (*model.CallSession, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	for i := len(f.sessions) - 1; i >= 0; i-- {
		if f.sessions[i].ConnID == sessionID || f.sessions[i].ID == sessionID {
			cp := *f.sessions[i]
			return &cp, nil
		}
	}
	return nil, fmt.Errorf("session not found: %s", sessionID)
}

func (f *fakeCallSessionStore) GetByCall(callID string) ([]*model.CallSession, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	var out []*model.CallSession
	for _, s := range f.sessions {
		if s.CallID == callID {
			cp := *s
			out = append(out, &cp)
		}
	}
	return out, nil
}

func (f *fakeCallSessionStore) GetByCallAndUser(callID, userID string) (*model.CallSession, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	for i := len(f.sessions) - 1; i >= 0; i-- {
		if f.sessions[i].CallID == callID && f.sessions[i].UserID == userID {
			cp := *f.sessions[i]
			return &cp, nil
		}
	}
	return nil, fmt.Errorf("no session for call %s user %s", callID, userID)
}

func (f *fakeCallSessionStore) Save(session *model.CallSession) (*model.CallSession, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	cp := *session
	f.sessions = append(f.sessions, &cp)
	return &cp, nil
}

func (f *fakeCallSessionStore) Update(session *model.CallSession) (*model.CallSession, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	for i := len(f.sessions) - 1; i >= 0; i-- {
		if f.sessions[i].ID == session.ID {
			cp := *session
			f.sessions[i] = &cp
			return &cp, nil
		}
	}
	return nil, fmt.Errorf("session not found: %s", session.ID)
}

// EndSession mirrors the SQL store semantics: close the open row for one
// stable session id (callid + connid), leaving other devices of the same
// user untouched.
func (f *fakeCallSessionStore) EndSession(callID, connID string, endAt int64) (int64, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	var closed int64
	for _, s := range f.sessions {
		if s.CallID == callID && s.ConnID == connID && s.EndAt == 0 {
			s.EndAt = endAt
			s.UpdateAt = endAt
			closed++
		}
	}
	return closed, nil
}

// EndOpenSessions closes every open row of the call (call-level teardown).
func (f *fakeCallSessionStore) EndOpenSessions(callID string, endAt int64) (int64, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	var closed int64
	for _, s := range f.sessions {
		if s.CallID == callID && s.EndAt == 0 {
			s.EndAt = endAt
			s.UpdateAt = endAt
			closed++
		}
	}
	return closed, nil
}

func (f *fakeCallSessionStore) Delete(sessionID string) error { return nil }

// openForCall returns the still-open rows of a call (test assertions).
func (f *fakeCallSessionStore) openForCall(callID string) []model.CallSession {
	f.mut.Lock()
	defer f.mut.Unlock()
	var out []model.CallSession
	for _, s := range f.sessions {
		if s.CallID == callID && s.EndAt == 0 {
			out = append(out, *s)
		}
	}
	return out
}

type fakeCallStatStore struct {
	mut   sync.Mutex
	stats []*model.CallStat
}

func newFakeCallStatStore() *fakeCallStatStore { return &fakeCallStatStore{} }

func (f *fakeCallStatStore) Get(statID string) (*model.CallStat, error) { return nil, nil }

func (f *fakeCallStatStore) GetByCall(callID string) (*model.CallStat, error) { return nil, nil }

func (f *fakeCallStatStore) GetByChannel(channelID string, page, perPage int) ([]*model.CallStat, error) {
	return nil, nil
}

func (f *fakeCallStatStore) Save(stat *model.CallStat) (*model.CallStat, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	cp := *stat
	f.stats = append(f.stats, &cp)
	return &cp, nil
}

func (f *fakeCallStatStore) saved() []model.CallStat {
	f.mut.Lock()
	defer f.mut.Unlock()
	out := make([]model.CallStat, 0, len(f.stats))
	for _, s := range f.stats {
		out = append(out, *s)
	}
	return out
}

type fakeCallJobStore struct{}

func (f *fakeCallJobStore) Get(jobID string) (*model.CallJob, error)          { return nil, nil }
func (f *fakeCallJobStore) GetByCall(callID string) ([]*model.CallJob, error) { return nil, nil }
func (f *fakeCallJobStore) Save(job *model.CallJob) (*model.CallJob, error)   { return nil, nil }
func (f *fakeCallJobStore) Update(job *model.CallJob) (*model.CallJob, error) { return nil, nil }
func (f *fakeCallJobStore) Delete(jobID string) error                         { return nil }

type stubCallsChannelStore struct{}

func (f *stubCallsChannelStore) Get(channelID string) (*model.CallsChannel, error) {
	return nil, nil
}
func (f *stubCallsChannelStore) Save(cc *model.CallsChannel) (*model.CallsChannel, error) {
	return nil, nil
}
func (f *stubCallsChannelStore) Delete(channelID string) error { return nil }

type fakeStore struct {
	call *fakeCallStore
	sess *fakeCallSessionStore
	stat *fakeCallStatStore
	job  *fakeCallJobStore
	ch   *stubCallsChannelStore
}

var _ StoreBridge = (*fakeStore)(nil)

func newFakeStore() *fakeStore {
	return &fakeStore{
		call: newFakeCallStore(),
		sess: newFakeCallSessionStore(),
		stat: newFakeCallStatStore(),
		job:  &fakeCallJobStore{},
		ch:   &stubCallsChannelStore{},
	}
}

func (f *fakeStore) Call() store.CallStore                 { return f.call }
func (f *fakeStore) CallSession() store.CallSessionStore   { return f.sess }
func (f *fakeStore) CallJob() store.CallJobStore           { return f.job }
func (f *fakeStore) CallStat() store.CallStatStore         { return f.stat }
func (f *fakeStore) CallsChannel() store.CallsChannelStore { return f.ch }

// ─── KV fake ────────────────────────────────────────────────────────

type fakeKV struct {
	mut    sync.Mutex
	data   map[string][]byte
	getErr error
}

func newFakeKV() *fakeKV { return &fakeKV{data: map[string][]byte{}} }

func (f *fakeKV) Get(key string) ([]byte, error) {
	f.mut.Lock()
	defer f.mut.Unlock()
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.data[key], nil
}

func (f *fakeKV) Set(key string, value []byte) error {
	f.mut.Lock()
	defer f.mut.Unlock()
	cp := make([]byte, len(value))
	copy(cp, value)
	f.data[key] = cp
	return nil
}

// ─── RTCD client fake ───────────────────────────────────────────────

type fakeRTCDClient struct {
	mut       sync.Mutex
	connected bool
	heals     int
	healFn    func(f *fakeRTCDClient) bool
	sends     []rtcd.ClientMessage
	receiveCh chan rtcd.ClientMessage
	errCh     chan error
	closes    int
}

func newFakeRTCDClient() *fakeRTCDClient {
	return &fakeRTCDClient{receiveCh: make(chan rtcd.ClientMessage, 64), errCh: make(chan error, 1)}
}

func (f *fakeRTCDClient) Connect() error {
	f.mut.Lock()
	defer f.mut.Unlock()
	f.connected = true
	return nil
}

func (f *fakeRTCDClient) Connected() bool {
	f.mut.Lock()
	defer f.mut.Unlock()
	return f.connected
}

// Heal implements RTCDClient: a reconnected client by default, so the
// manager-level heal path is observable (heals counter). healFn overrides.
func (f *fakeRTCDClient) Heal() bool {
	f.mut.Lock()
	f.heals++
	fn := f.healFn
	f.mut.Unlock()
	if fn != nil {
		return fn(f)
	}
	f.mut.Lock()
	f.connected = true
	f.mut.Unlock()
	return true
}

func (f *fakeRTCDClient) Send(msg rtcd.ClientMessage) error {
	f.mut.Lock()
	defer f.mut.Unlock()
	f.sends = append(f.sends, msg)
	return nil
}

func (f *fakeRTCDClient) ReceiveCh() <-chan rtcd.ClientMessage { return f.receiveCh }
func (f *fakeRTCDClient) ErrorCh() <-chan error                { return f.errCh }

func (f *fakeRTCDClient) Close() error {
	f.mut.Lock()
	defer f.mut.Unlock()
	f.connected = false
	f.closes++
	return nil
}

func (f *fakeRTCDClient) sent() []rtcd.ClientMessage {
	f.mut.Lock()
	defer f.mut.Unlock()
	out := make([]rtcd.ClientMessage, len(f.sends))
	copy(out, f.sends)
	return out
}

func (f *fakeRTCDClient) sentOfType(t string) []rtcd.ClientMessage {
	var out []rtcd.ClientMessage
	for _, m := range f.sent() {
		if m.Type == t {
			out = append(out, m)
		}
	}
	return out
}

// ─── Service construction helpers ───────────────────────────────────

func ptrBool(v bool) *bool       { return &v }
func ptrInt(v int) *int          { return &v }
func ptrString(v string) *string { return &v }

// newTestService builds a service with calls enabled, an in-memory fake
// store and a recording hub. No rtcd manager is attached.
func newTestServiceWithStore(t *testing.T) (*CallService, *fakeStore, *fakeHub) {
	t.Helper()
	s, store, hub := newTestServiceWithConfig(t, &model.CallsSettings{Enable: ptrBool(true)})
	return s, store, hub
}

func newTestServiceWithConfig(t *testing.T, callsSettings *model.CallsSettings) (*CallService, *fakeStore, *fakeHub) {
	t.Helper()
	cfg := &model.Config{}
	cfg.CallsSettings = *callsSettings
	store := newFakeStore()
	hub := &fakeHub{}
	s, err := New(ServiceConfig{
		StoreFn:  func() StoreBridge { return store },
		ConfigFn: func() *model.Config { return cfg },
		Log:      mlog.CreateTestLogger(t),
		Hub:      hub,
	})
	require.NoError(t, err)
	return s, store, hub
}

// attachFakeRTCD installs a manager with one healthy fake host and returns
// the client so tests can inspect what was sent to the SFU.
func attachFakeRTCD(t *testing.T, s *CallService) *fakeRTCDClient {
	t.Helper()
	client := newFakeRTCDClient()
	require.NoError(t, client.Connect())
	const hostIP = "127.0.0.1"
	mgr := &rtcdClientManager{
		log:       s.log,
		store:     newFakeKV(),
		rtcdURL:   "http://" + hostIP + ":8045",
		rtcdPort:  "8045",
		hosts:     map[string]*rtcdHost{hostIP: {ip: hostIP, client: client}},
		closeCh:   make(chan struct{}),
		newClient: func(m *rtcdClientManager, rtcdURL, host string) (RTCDClient, error) { return client, nil },
	}
	s.mut.Lock()
	s.rtcd = mgr
	s.mut.Unlock()
	return client
}

// joinCall drives a full join for one user through the client-message path
// and returns the connection id used as the session id. Fails the test when
// the join produced a protocol error event.
func joinCall(t *testing.T, s *CallService, channelID, userID string) string {
	t.Helper()
	connID := model.NewId()
	s.HandleClientMessage(connID, userID, msgJoin, map[string]any{"channelID": channelID})
	if hub, ok := s.hub.(*fakeHub); ok {
		require.Empty(t, hub.byEvent(eventError), "join must not produce error events")
	}
	return connID
}

// liveCallID resolves the channel's current call id. Call identities are
// fresh model.NewId()s (26 chars, like every model row); the channel ->
// live-call mapping is the service's channel index, so tests resolve ids
// through it exactly like production code does.
func liveCallID(t *testing.T, s *CallService, channelID string) string {
	t.Helper()
	cs, ok := s.channelCalls.get(channelID)
	require.True(t, ok, "no live call registered for channel %q", channelID)
	require.True(t, model.IsValidId(cs.callID),
		"call id %q must be a 26-char id (the varchar(26) contract)", cs.callID)
	return cs.callID
}

// sendMessage drives one client message and returns the error text reported
// back to THAT connection ("" when the action succeeded). Errors are matched
// by the unicast connection id, not by global event count: concurrent
// goroutines share the hub, and counting would misattribute their errors.
func sendMessage(t *testing.T, s *CallService, connID, userID, action string, data map[string]any) string {
	t.Helper()
	hub, ok := s.hub.(*fakeHub)
	require.True(t, ok, "test service must use the fake hub")
	hub.reset() // single-goroutine tests only; see sendMessageConcurrent
	s.HandleClientMessage(connID, userID, action, data)
	for _, e := range hub.byEvent(eventError) {
		if e.broadcast != nil && e.broadcast.ConnectionId == connID {
			msg, _ := e.data["data"].(string)
			return msg
		}
	}
	return ""
}

// mustSend asserts the action completes without a protocol error.
func mustSend(t *testing.T, s *CallService, connID, userID, action string, data map[string]any) {
	t.Helper()
	require.Empty(t, sendMessage(t, s, connID, userID, action, data), "action %s must not error", action)
}

// sendConcurrent drives one client message for a goroutine of the concurrent
// test and reports whether THIS connection received an error event. Unlike
// sendMessage it never resets the shared hub (which would race the other
// goroutines) and tolerates other connections' error events.
func sendConcurrent(s *CallService, connID, userID, action string, data map[string]any) bool {
	s.HandleClientMessage(connID, userID, action, data)
	if hub, ok := s.hub.(*fakeHub); ok {
		for _, e := range hub.byEvent(eventError) {
			if e.broadcast != nil && e.broadcast.ConnectionId == connID {
				return false
			}
		}
	}
	return true
}

// sendExpectError asserts the action fails and returns the reported message.
func sendExpectError(t *testing.T, s *CallService, connID, userID, action string, data map[string]any) string {
	t.Helper()
	msg := sendMessage(t, s, connID, userID, action, data)
	require.NotEmpty(t, msg, "action %s must error", action)
	return msg
}
