// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"errors"
	"testing"
	"time"

	rtcd "github.com/mattermost/rtcd/service"
	"github.com/mattermost/rtcd/service/rtc"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/stretchr/testify/require"
)

func TestRelayVoicePresence(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	conn := joinCall(t, s, "chan1", "u1")

	hub.reset()
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageRTC,
		Data: rtc.Message{SessionID: conn, UserID: "u1", Type: rtc.VoiceOnMessage},
	})
	voiceOn := requireChannelBroadcast(t, hub, eventUserVoiceOn, "chan1")
	require.Equal(t, "u1", voiceOn.data["userID"], "plugin contract: voice events key the user as userID")
	require.Equal(t, conn, voiceOn.data["session_id"])
	cs, _ := s.channelCalls.get("chan1")
	sess, _ := cs.get(conn)
	require.True(t, sess.voiceOn)

	hub.reset()
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageRTC,
		Data: rtc.Message{SessionID: conn, UserID: "u1", Type: rtc.VoiceOffMessage},
	})
	require.Equal(t, 1, hub.count(eventUserVoiceOff))
	sess, _ = cs.get(conn)
	require.False(t, sess.voiceOn)

	// Unknown session: dropped silently.
	hub.reset()
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageRTC,
		Data: rtc.Message{SessionID: "ghost", UserID: "u1", Type: rtc.VoiceOnMessage},
	})
	require.Equal(t, 0, hub.count(eventUserVoiceOn))
}

func TestRelaySignalUnicastFollowsReconnect(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	conn := joinCall(t, s, "chan1", "u1")

	// Reconnect: session now targets conn-new.
	mustSend(t, s, "conn-new", "u1", msgReconnect, map[string]any{
		"channelID":      "chan1",
		"originalConnID": conn,
	})

	hub.reset()
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageRTC,
		Data: rtc.Message{
			SessionID: conn,
			UserID:    "u1",
			Type:      rtc.SDPMessage,
			Data:      []byte(`{"type":"answer"}`),
		},
	})
	sig := requireUnicast(t, hub, eventSignal, "conn-new")
	require.Equal(t, `{"type":"answer"}`, sig.data["data"])

	// Empty payloads are dropped.
	hub.reset()
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageRTC,
		Data: rtc.Message{SessionID: conn, UserID: "u1", Type: rtc.ICEMessage},
	})
	require.Equal(t, 0, hub.count(eventSignal))
}

func TestRTCDCloseTeardown(t *testing.T) {
	s, store, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	conn := joinCall(t, s, "chan1", "u1")
	callID := liveCallID(t, s, "chan1")

	hub.reset()
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageClose,
		Data: map[string]string{"sessionID": conn},
	})

	// Full teardown: session gone, leave boundary persisted, call ended.
	require.Equal(t, 1, hub.count(eventUserLeft))
	require.Equal(t, 1, hub.count(eventCallEnd))
	_, ok := s.channelCalls.get("chan1")
	require.False(t, ok)
	sess, err := store.sess.GetByCallAndUser(callID, "u1")
	require.NoError(t, err)
	require.NotZero(t, sess.EndAt)

	// A duplicate close for the removed session is a no-op.
	hub.reset()
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageClose,
		Data: map[string]string{"sessionID": conn},
	})
	require.Equal(t, 0, hub.count(eventUserLeft))
}

func TestRTCDCloseGenericMapPayload(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	attachFakeRTCD(t, s)
	conn := joinCall(t, s, "chan1", "u1")

	hub.reset()
	// msgpack-decoded maps arrive as map[string]any.
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageClose,
		Data: map[string]any{"sessionID": conn},
	})
	require.Equal(t, 1, hub.count(eventUserLeft))

	// Malformed payloads are rejected without panicking.
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{Type: rtcd.ClientMessageClose, Data: "bogus"})
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageClose,
		Data: map[string]any{"no-session": "x"},
	})
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{Type: rtcd.ClientMessageRTC, Data: "bogus"})
}

func TestRTCDControlAcksIgnored(t *testing.T) {
	s, _, hub := newTestServiceWithStore(t)
	for _, mt := range []string{
		rtcd.ClientMessageHello, rtcd.ClientMessageJoin,
		rtcd.ClientMessageReconnect, rtcd.ClientMessageLeave,
	} {
		s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{Type: mt})
	}
	require.Empty(t, hub.events)
}

func TestIceServers(t *testing.T) {
	// Admin-configured list wins: one entry per URL, credentials split out.
	s, _, _ := newTestServiceWithConfig(t, &model.CallsSettings{
		Enable:     ptrBool(true),
		ICEServers: ptrString("stun:a.example:3478, turn:b.example:3479 ,"),
	})
	servers := s.iceServers()
	require.Len(t, servers, 2)
	require.Equal(t, map[string]any{"urls": []string{"stun:a.example:3478"}}, servers[0])
	require.Equal(t, map[string]any{"urls": []string{"turn:b.example:3479"}}, servers[1])

	// Nothing configured: nil — the correct default (browsers reach the
	// public SFU with host candidates; no STUN/TURN needed).
	s2, _, _ := newTestServiceWithStore(t)
	require.Nil(t, s2.iceServers())
}

func TestParseICEServer(t *testing.T) {
	tcs := []struct {
		name  string
		entry string
		want  map[string]any
		valid bool
	}{
		{
			name:  "plain stun",
			entry: "stun:stun.l.google.com:19302",
			want:  map[string]any{"urls": []string{"stun:stun.l.google.com:19302"}},
			valid: true,
		},
		{
			name:  "turn with query",
			entry: "turn:turn.example.net:3478?transport=udp",
			want:  map[string]any{"urls": []string{"turn:turn.example.net:3478?transport=udp"}},
			valid: true,
		},
		{
			name:  "turn with credentials",
			entry: "turn:user:secret@turn.example.net:3478?transport=tcp",
			want: map[string]any{
				"urls":       []string{"turn:turn.example.net:3478?transport=tcp"},
				"username":   "user",
				"credential": "secret",
			},
			valid: true,
		},
		{
			name:  "turns (TLS) with credentials — userinfo splits at the first colon",
			entry: "turns:tenant:secret@turn.example.net:5349",
			want: map[string]any{
				"urls":       []string{"turns:turn.example.net:5349"},
				"username":   "tenant",
				"credential": "secret",
			},
			valid: true,
		},
		{
			name:  "ipv6 host",
			entry: "stun:[2001:db8::1]:3478",
			want:  map[string]any{"urls": []string{"stun:[2001:db8::1]:3478"}},
			valid: true,
		},
		{name: "unknown scheme", entry: "http://example.net", valid: false},
		{name: "double slash form", entry: "turn://example.net:3478", valid: false},
		{name: "empty host", entry: "stun:", valid: false},
		{name: "userinfo without host", entry: "turn:user:pass@", valid: false},
		{name: "userinfo without password", entry: "turn:user@host:3478", valid: false},
		{name: "userinfo without colon", entry: "turn:userpass@host:3478", valid: false},
		{name: "garbage", entry: "not a url at all", valid: false},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := parseICEServer(tc.entry)
			require.Equal(t, tc.valid, ok)
			if tc.valid {
				require.Equal(t, tc.want, got)
			}
		})
	}
}

func TestRedactICEEntry(t *testing.T) {
	require.Equal(t, "turn:***:***@host:3478", redactICEEntry("turn:user:secret@host:3478"))
	require.Equal(t, "turn:***@host:3478", redactICEEntry("turn:nopass@host:3478"))
	require.Equal(t, "stun:host:3478", redactICEEntry("stun:host:3478"))
}

func TestParseURL(t *testing.T) {
	sanitized, clientID, authKey, err := parseURL("https://cid:secret@rtcd.example.com:8045/sub")
	require.NoError(t, err)
	require.Equal(t, "https://rtcd.example.com:8045/sub", sanitized)
	require.Equal(t, "cid", clientID)
	require.Equal(t, "secret", authKey)

	sanitized, clientID, authKey, err = parseURL("https://rtcd.example.com")
	require.NoError(t, err)
	require.Equal(t, "https://rtcd.example.com", sanitized)
	require.Empty(t, clientID)
	require.Empty(t, authKey)

	sanitized, clientID, authKey, err = parseURL("")
	require.NoError(t, err)
	require.Empty(t, sanitized)
	require.Empty(t, clientID)
	require.Empty(t, authKey)
}

func TestRTCEnvelope(t *testing.T) {
	callID := model.NewId()
	msg := rtcEnvelope("sess1", callID, "u1", rtc.SDPMessage, []byte("payload"))
	require.Equal(t, rtcd.ClientMessageRTC, msg.Type)
	rtcMsg, ok := msg.Data.(rtc.Message)
	require.True(t, ok)
	require.Equal(t, "default", rtcMsg.GroupID)
	require.Equal(t, "u1", rtcMsg.UserID)
	require.Equal(t, "sess1", rtcMsg.SessionID)
	require.Equal(t, callID, rtcMsg.CallID)
	require.Equal(t, rtc.SDPMessage, rtcMsg.Type)
	require.Equal(t, []byte("payload"), rtcMsg.Data)
}

func TestResolveClientConfigPrecedence(t *testing.T) {
	t.Run("fallback client id and generated key", func(t *testing.T) {
		s, _, _ := newTestServiceWithStore(t)
		attachFakeRTCD(t, s)
		mgr := s.rtcdManager()
		require.NotNil(t, mgr)

		cfg, err := mgr.resolveClientConfig("http://127.0.0.1:8045", "diagnostic-id")
		require.NoError(t, err)
		require.Equal(t, "diagnostic-id", cfg.ClientID)
		require.Equal(t, "http://127.0.0.1:8045", cfg.URL)
		require.NotEmpty(t, cfg.AuthKey, "a fresh auth key must be generated")
		require.Positive(t, cfg.ReconnectInterval)

		// The generated key was persisted and is reused on the next resolve.
		cfg2, err := mgr.resolveClientConfig("http://127.0.0.1:8045", "diagnostic-id")
		require.NoError(t, err)
		require.Equal(t, cfg.AuthKey, cfg2.AuthKey)
	})

	t.Run("embedded url credentials", func(t *testing.T) {
		s, _, _ := newTestServiceWithStore(t)
		attachFakeRTCD(t, s)
		mgr := s.rtcdManager()
		require.NotNil(t, mgr)

		cfg, err := mgr.resolveClientConfig("http://cid:secret@127.0.0.1:8045", "diagnostic-id")
		require.NoError(t, err)
		require.Equal(t, "cid", cfg.ClientID)
		require.Equal(t, "secret", cfg.AuthKey)
		require.Equal(t, "http://127.0.0.1:8045", cfg.URL, "credentials must be stripped")
	})

	t.Run("env vars take precedence", func(t *testing.T) {
		s, _, _ := newTestServiceWithStore(t)
		attachFakeRTCD(t, s)
		mgr := s.rtcdManager()
		require.NotNil(t, mgr)

		t.Setenv("MM_CALLS_RTCD_CLIENT_ID", "env-cid")
		t.Setenv("MM_CALLS_RTCD_AUTH_KEY", "env-secret")
		cfg, err := mgr.resolveClientConfig("http://cid:secret@127.0.0.1:8045", "diagnostic-id")
		require.NoError(t, err)
		require.Equal(t, "env-cid", cfg.ClientID)
		require.Equal(t, "env-secret", cfg.AuthKey)
	})

	t.Run("missing url and id", func(t *testing.T) {
		s, _, _ := newTestServiceWithStore(t)
		attachFakeRTCD(t, s)
		mgr := s.rtcdManager()
		require.NotNil(t, mgr)

		_, err := mgr.resolveClientConfig("", "diagnostic-id")
		require.Error(t, err)
		_, err = mgr.resolveClientConfig("http://127.0.0.1:8045", "")
		require.Error(t, err)
	})
}

func TestRtcdConfigStoreKVError(t *testing.T) {
	s, _, _ := newTestServiceWithStore(t)
	kv := newFakeKV()
	kv.getErr = errors.New("kv down")
	cs := &rtcdConfigStore{kv: kv, log: s.log}

	// A KV failure degrades to "no stored config" instead of failing.
	_, ok := cs.load()
	require.False(t, ok)

	// Persistence round-trips when healthy.
	kv.getErr = nil
	require.NoError(t, cs.store(rtcd.ClientConfig{ClientID: "cid", AuthKey: "key"}))
	loaded, ok := cs.load()
	require.True(t, ok)
	require.Equal(t, "cid", loaded.ClientID)
	require.Equal(t, "key", loaded.AuthKey)
}

func TestSendToHostWithoutSFU(t *testing.T) {
	s, _, _ := newTestServiceWithStore(t) // no rtcd manager attached
	cs := newCallState(model.NewId(), "chan1", "")
	err := s.sendToHost(cs, rtcd.ClientMessage{Type: rtcd.ClientMessageJoin})
	require.ErrorIs(t, err, ErrNoSFUHost)

	// Manager attached but call has no host assigned.
	attachFakeRTCD(t, s)
	err = s.sendToHost(cs, rtcd.ClientMessage{Type: rtcd.ClientMessageJoin})
	require.ErrorIs(t, err, ErrNoSFUHost)
}

func TestHostPumpSurvivesClientErrors(t *testing.T) {
	// A transient client error on ErrorCh (e.g. a failed reconnect attempt —
	// the real service.Client retries on its own) must be logged, not fatal:
	// the pump keeps relaying messages that arrive afterwards.
	client := newFakeRTCDClient()
	require.NoError(t, client.Connect())

	relayed := make(chan rtcd.ClientMessage, 8)
	mgr := &rtcdClientManager{
		log:       mlog.CreateTestLogger(t),
		store:     newFakeKV(),
		rtcdURL:   "http://127.0.0.1:8045",
		rtcdPort:  "8045",
		hosts:     map[string]*rtcdHost{},
		closeCh:   make(chan struct{}),
		newClient: func(m *rtcdClientManager, rtcdURL, host string) (RTCDClient, error) { return client, nil },
		onMessage: func(host string, msg rtcd.ClientMessage) { relayed <- msg },
	}
	require.NoError(t, mgr.addHost("127.0.0.1", client))

	// Emit a client error, then a message — the message must still relay.
	client.errCh <- errors.New("failed to re-connect: connection refused")
	client.receiveCh <- rtcd.ClientMessage{Type: rtcd.ClientMessageRTC}

	select {
	case msg := <-relayed:
		require.Equal(t, rtcd.ClientMessageRTC, msg.Type)
	case <-time.After(3 * time.Second):
		t.Fatal("pump stopped after a client error — message not relayed")
	}

	// Closing both channels (manager Close path) ends the pump.
	close(client.receiveCh)
	close(client.errCh)
}

func TestGetHostForNewCallHealsUnhealthyHost(t *testing.T) {
	// The production failure class: the control socket died (rtcd restarted
	// with a fresh auth store / wedged reconnect loop) and every join fails
	// with "no healthy rtcd host". GetHostForNewCall must force one heal and
	// succeed instead of rejecting the call.
	client := newFakeRTCDClient()
	const hostIP = "127.0.0.1"
	mgr := &rtcdClientManager{
		log:       mlog.CreateTestLogger(t),
		store:     newFakeKV(),
		rtcdURL:   "http://" + hostIP + ":8045",
		rtcdPort:  "8045",
		hosts:     map[string]*rtcdHost{hostIP: {ip: hostIP, client: client}},
		closeCh:   make(chan struct{}),
		newClient: func(m *rtcdClientManager, rtcdURL, host string) (RTCDClient, error) { return client, nil },
	}

	host, err := mgr.GetHostForNewCall()
	require.NoError(t, err)
	require.Equal(t, "127.0.0.1:8045", host)
	require.Equal(t, 1, client.heals)
	require.True(t, client.Connected())
}

func TestGetHostForNewCallStillFailsWhenHealFails(t *testing.T) {
	// rtcd is actually down: healing reconnects nothing and the join must
	// still report "no healthy rtcd host available" (a truthful error).
	client := newFakeRTCDClient()
	client.healFn = func(*fakeRTCDClient) bool { return false }
	const hostIP = "127.0.0.1"
	mgr := &rtcdClientManager{
		log:       mlog.CreateTestLogger(t),
		store:     newFakeKV(),
		rtcdURL:   "http://" + hostIP + ":8045",
		rtcdPort:  "8045",
		hosts:     map[string]*rtcdHost{hostIP: {ip: hostIP, client: client}},
		closeCh:   make(chan struct{}),
		newClient: func(m *rtcdClientManager, rtcdURL, host string) (RTCDClient, error) { return client, nil },
	}

	_, err := mgr.GetHostForNewCall()
	require.Error(t, err)
	require.Contains(t, err.Error(), "no healthy rtcd host")
}

func TestGetHostForNewCallSkipsFlaggedHosts(t *testing.T) {
	// A host that vanished from DNS (flagged) must not be healed or picked.
	client := newFakeRTCDClient()
	const hostIP = "10.9.8.7"
	host := &rtcdHost{ip: hostIP, client: client}
	host.setFlagged(true)
	mgr := &rtcdClientManager{
		log:       mlog.CreateTestLogger(t),
		store:     newFakeKV(),
		rtcdURL:   "http://" + hostIP + ":8045",
		rtcdPort:  "8045",
		hosts:     map[string]*rtcdHost{hostIP: host},
		closeCh:   make(chan struct{}),
		newClient: func(m *rtcdClientManager, rtcdURL, host string) (RTCDClient, error) { return client, nil },
	}

	_, err := mgr.GetHostForNewCall()
	require.Error(t, err)
	require.Zero(t, client.heals)
}

func TestKickRTCDInitRecoversAfterGiveUp(t *testing.T) {
	// The boot-time init loop gave up (rtcd unreachable past its deadline).
	// A join kicking re-init must run a fresh (short) init round and reset
	// the single-flight flag so subsequent kicks can run again.
	cfg := &model.Config{}
	cfg.CallsSettings = model.CallsSettings{
		Enable:         ptrBool(true),
		RTCDServiceURL: ptrString("http://127.0.0.1:1"), // refuses instantly
	}
	store := newFakeStore()
	s, err := New(ServiceConfig{
		StoreFn:  func() StoreBridge { return store },
		ConfigFn: func() *model.Config { return cfg },
		Log:      mlog.CreateTestLogger(t),
		Hub:      &fakeHub{},
	})
	require.NoError(t, err)
	require.NoError(t, s.Start())
	s.Stop() // stop the boot init; simulate "gave up" with nil manager

	// Shrink the init bounds under the service lock: a boot-round
	// goroutine may still be inside its bounds snapshot.
	s.mut.Lock()
	s.rtcdInitMaxWait = 10 * time.Millisecond
	s.rtcdInitMinBackoff = time.Millisecond
	s.mut.Unlock()

	s.kickRTCDInit()
	require.True(t, s.rtcdKick.Load(), "kick should mark init in flight")

	// The round is bounded by rtcdInitMaxWait; wait for the flag to reset.
	deadline := time.Now().Add(5 * time.Second)
	for s.rtcdKick.Load() && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	require.False(t, s.rtcdKick.Load(), "init round must finish and reset the flag")
	require.Nil(t, s.rtcdManager(), "127.0.0.1:1 must not yield a manager")

	// Kicking again after a reset runs another round (recoverable state).
	s.kickRTCDInit()
	require.True(t, s.rtcdKick.Load())
	deadline = time.Now().Add(5 * time.Second)
	for s.rtcdKick.Load() && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	require.False(t, s.rtcdKick.Load())
}

func TestKickRTCDInitNoopWithoutURL(t *testing.T) {
	cfg := &model.Config{}
	cfg.CallsSettings = model.CallsSettings{Enable: ptrBool(true)}
	s, err := New(ServiceConfig{
		StoreFn:  func() StoreBridge { return newFakeStore() },
		ConfigFn: func() *model.Config { return cfg },
		Log:      mlog.CreateTestLogger(t),
		Hub:      &fakeHub{},
	})
	require.NoError(t, err)

	s.kickRTCDInit()
	require.False(t, s.rtcdKick.Load(), "no URL configured: nothing to kick")
}
