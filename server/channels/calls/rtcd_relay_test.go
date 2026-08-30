// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"errors"
	"testing"

	rtcd "github.com/mattermost/rtcd/service"
	"github.com/mattermost/rtcd/service/rtc"

	"github.com/iamleson98/sitename/server/public/model"
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
	cs, _ := s.shards.get(CallIDForChannel("chan1"))
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

	hub.reset()
	s.handleRTCDMessage("127.0.0.1:8045", rtcd.ClientMessage{
		Type: rtcd.ClientMessageClose,
		Data: map[string]string{"sessionID": conn},
	})

	// Full teardown: session gone, leave boundary persisted, call ended.
	require.Equal(t, 1, hub.count(eventUserLeft))
	require.Equal(t, 1, hub.count(eventCallEnd))
	_, ok := s.shards.get(CallIDForChannel("chan1"))
	require.False(t, ok)
	sess, err := store.sess.GetByCallAndUser(CallIDForChannel("chan1"), "u1")
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

func TestIceServersForHost(t *testing.T) {
	// Admin-configured list wins.
	s, _, _ := newTestServiceWithConfig(t, &model.CallsSettings{
		Enable:     ptrBool(true),
		ICEServers: ptrString("stun:a.example:3478, turn:b.example:3479 ,"),
	})
	servers := s.iceServersForHost("sfu.example:8045")
	require.Len(t, servers, 1)
	urls, _ := servers[0]["urls"].([]string)
	require.Equal(t, []string{"stun:a.example:3478", "turn:b.example:3479"}, urls)

	// Fallback: the rtcd host's own STUN listener.
	s2, _, _ := newTestServiceWithStore(t)
	servers = s2.iceServersForHost("10.0.0.1:8045")
	require.Len(t, servers, 1)
	urls, _ = servers[0]["urls"].([]string)
	require.Equal(t, []string{"stun:10.0.0.1:8045"}, urls)

	// Nothing configured and no host: nil.
	require.Nil(t, s2.iceServersForHost(""))
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
	msg := rtcEnvelope("sess1", "ch:chan1", "u1", rtc.SDPMessage, []byte("payload"))
	require.Equal(t, rtcd.ClientMessageRTC, msg.Type)
	rtcMsg, ok := msg.Data.(rtc.Message)
	require.True(t, ok)
	require.Equal(t, "default", rtcMsg.GroupID)
	require.Equal(t, "u1", rtcMsg.UserID)
	require.Equal(t, "sess1", rtcMsg.SessionID)
	require.Equal(t, "ch:chan1", rtcMsg.CallID)
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
	cs := newCallState("ch:chan1", "chan1", "")
	err := s.sendToHost(cs, rtcd.ClientMessage{Type: rtcd.ClientMessageJoin})
	require.ErrorIs(t, err, ErrNoSFUHost)

	// Manager attached but call has no host assigned.
	attachFakeRTCD(t, s)
	err = s.sendToHost(cs, rtcd.ClientMessage{Type: rtcd.ClientMessageJoin})
	require.ErrorIs(t, err, ErrNoSFUHost)
}
