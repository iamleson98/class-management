// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

// Package calls implements the realtime call control plane for the LMS.
//
// Architecture overview
// =====================
//
// The authoritative live call state (sessions, transient presence such as
// mute / voice / screen / video) is held in-memory, sharded by callID, in the
// CallService. rtcd is an external WebRTC SFU that owns the media plane; media
// (RTP/SRTP) never passes through this server. This package carries only
// signaling (join/leave/SDP/ICE) and presence, which is fanned out over the
// shared websocket hub.
//
//	browser ──WS──▶ CallService ──WS──▶ rtcd (SFU)
//	                 │                    │
//	                 └─ presence fan-out  └─ VAD/ICE back to originating node
//
// The Postgres-backed stores (CallStore, CallSessionStore, ...) persist only
// the durable boundaries: call start/end and participant join/leave. Mute /
// voice / screen / video toggles are NOT persisted, which keeps the DB write
// rate proportional to (calls x participants) rather than
// (calls x participants x interactions).
package calls

import (
	"github.com/iamleson98/sitename/server/public/model"
)

// config is a live view of the calls configuration, read on each request so
// that runtime config changes take effect without restart.
type config struct {
	*model.CallsSettings
}

// callsConfig returns the current CallsSettings from the live config.
func (s *CallService) callsConfig() config {
	return config{CallsSettings: &s.cfg.ConfigFn().CallsSettings}
}

// enabled reports whether the calls module is turned on. Calls are enabled
// when Enable is true and either an rtcd service URL is configured or embedded
// RTC is in use.
func (c config) enabled() bool {
	return c.Enable != nil && *c.Enable
}

func (c config) rtcdURL() string {
	if c.RTCDServiceURL == nil {
		return ""
	}
	return *c.RTCDServiceURL
}

func (c config) maxParticipants() int {
	if c.MaxCallParticipants == nil {
		return 0
	}
	return *c.MaxCallParticipants
}

func (c config) allowScreenSharing() bool {
	if c.AllowScreenSharing == nil {
		return true
	}
	return *c.AllowScreenSharing
}

// shardCountFor returns the configured shard count, defaulting to
// defaultShardCount when unset/invalid. Free function so it can be used before
// a service/config exists (e.g. in New).
func shardCountFor(cs *model.CallsSettings) int {
	if cs == nil || cs.StateShardCount == nil || *cs.StateShardCount <= 0 {
		return defaultShardCount
	}
	return *cs.StateShardCount
}

// batchMinMembers returns the participant count above which join/leave
// fan-out is coalesced into batched events (see batching/).
func (c config) batchMinMembers() int {
	if c.BatchMinMembers == nil {
		return 100
	}
	return *c.BatchMinMembers
}

func (c config) batchIntervalMs() int {
	if c.BatchIntervalMs == nil || *c.BatchIntervalMs <= 0 {
		return 1000
	}
	return *c.BatchIntervalMs
}

func (c config) batchMaxSize() int {
	if c.BatchMaxSize == nil || *c.BatchMaxSize <= 0 {
		return 1000
	}
	return *c.BatchMaxSize
}
