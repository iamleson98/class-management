// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"errors"
	"fmt"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

// Common errors returned by the service. These map to model.AppError at the
// API layer.
var (
	ErrCallsDisabled    = errors.New("calls: feature is disabled")
	ErrNoSFUHost        = errors.New("calls: no rtcd host available")
	ErrCallNotFound     = errors.New("calls: call not found")
	ErrCallEnded        = errors.New("calls: call has ended")
	ErrMaxParticipants  = errors.New("calls: maximum participants reached")
	ErrAlreadyConnected = errors.New("calls: session is already connected")
)

// StartCallOpts are the parameters for starting a new call in a channel.
type StartCallOpts struct {
	ChannelID string
	OwnerID   string
	PostID    string
}

// StartResult is returned by StartCall.
type StartResult struct {
	CallID   string `json:"call_id"`
	RTCDHost string `json:"rtcd_host,omitempty"`
	StartAt  int64  `json:"start_at"`
}

// StartCall creates a new call in a channel. It assigns an rtcd host for the
// call's media, persists the call record, and broadcasts call_start to channel
// members. Safe to call repeatedly; returns the existing in-progress call if
// one is already active in the channel.
func (s *CallService) StartCall(opts StartCallOpts) (*StartResult, error) {
	if !s.Enabled() {
		return nil, ErrCallsDisabled
	}
	if opts.ChannelID == "" || opts.OwnerID == "" {
		return nil, errors.New("calls: channelID and ownerID are required")
	}

	// A channel has at most one in-progress call; key it by channel so starts
	// are idempotent and reuse returns the active call.
	callID := callIDForChannel(opts.ChannelID)

	// Reuse an in-progress call for the channel if one exists.
	if cs, ok := s.shards.get(callID); ok && !cs.ended() {
		return &StartResult{CallID: cs.callID, RTCDHost: cs.rtcdHost, StartAt: cs.startAt}, nil
	}

	// Assign an rtcd host for this call's media.
	var rtcdHost string
	if s.rtcd != nil {
		h, err := s.rtcd.GetHostForNewCall()
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrNoSFUHost, err)
		}
		rtcdHost = h
	}

	now := model.GetMillis()

	cs := newCallState(callID, opts.ChannelID, opts.OwnerID, rtcdHost)
	shard := s.shards.shardFor(callID)
	if _, created := shard.getOrCreate(callID, func() *callState { return cs }); !created {
		// A concurrent start won the race; reuse its state.
		cs, _ = shard.get(callID)
	}

	// Persist the call record (durable boundary: call start).
	call := &model.Call{
		ID:        callID,
		ChannelID: opts.ChannelID,
		OwnerID:   opts.OwnerID,
		PostID:    opts.PostID,
		StartAt:   now,
		CreateAt:  now,
	}
	if _, err := s.store.Call().Save(call); err != nil {
		// Roll back the in-memory state on persistence failure.
		shard.delete(callID)
		return nil, fmt.Errorf("calls: failed to persist call: %w", err)
	}

	// Create the channel's call announcement post (interactive call card).
	// Best effort: failures are logged inside and the call still runs.
	postID := s.createCallPost(cs, opts.OwnerID)
	if postID != "" {
		call.PostID = postID
		if _, uerr := s.store.Call().Update(call); uerr != nil {
			s.log.Warn("calls: failed to persist call post id", mlog.Err(uerr))
		}
	}

	// Announce the call to channel members.
	s.broadcast(eventCallStart, map[string]any{
		"channel_id": opts.ChannelID,
		"call_id":    callID,
		"start_at":   now,
		"rtcd_host":  rtcdHost,
		"post_id":    postID,
		"owner_id":   opts.OwnerID,
	}, &model.WebsocketBroadcast{ChannelId: opts.ChannelID})

	return &StartResult{CallID: callID, RTCDHost: rtcdHost, StartAt: now}, nil
}

// EndCall terminates an in-progress call: marks it ended, persists the end
// boundary and stats, removes the in-memory state, and broadcasts call_end.
func (s *CallService) EndCall(callID string) error {
	cs, ok := s.shards.get(callID)
	if !ok {
		return ErrCallNotFound
	}
	if cs.ended() {
		return ErrCallEnded
	}

	now := model.GetMillis()
	views, _ := cs.snapshot()
	participantCount := len(views)

	// Remove from registry.
	s.shards.delete(callID)

	// Persist the end boundary.
	call, err := s.store.Call().Get(callID)
	if err == nil {
		call.EndAt = now
		_, _ = s.store.Call().Update(call)

		// Record aggregate stats (cheap; one row per call).
		_, _ = s.store.CallStat().Save(&model.CallStat{
			ID:               model.NewId(),
			CallID:           callID,
			ChannelID:        cs.channelID,
			Participants:     participantCount,
			PeakParticipants: cs.peakParticipants,
			DurationSeconds:  int((now - cs.startAt) / 1000),
			CreateAt:         now,
		})
	}

	// Update the call's announcement post (end_at + participant list).
	participants := make([]string, 0, len(views))
	for _, v := range views {
		participants = append(participants, v.UserID)
	}
	postID := ""
	if call != nil {
		postID = call.PostID
	}
	s.endCallPost(callID, postID, participants)

	// Announce the end to channel members.
	s.broadcast(eventCallEnd, map[string]any{
		"channel_id": cs.channelID,
		"call_id":    callID,
		"end_at":     now,
	}, &model.WebsocketBroadcast{ChannelId: cs.channelID})

	return nil
}

// ConfigView is the client-facing calls configuration, shaped after the Calls
// plugin's CallsConfig so the webapp gating logic ports over directly. Flags
// without a native server setting default to the plugin defaults.
type ConfigView struct {
	// Enabled reports whether the calls module is active on this server.
	Enabled bool `json:"enabled"`
	// MaxCallParticipants is the per-call participant cap (0 = unlimited).
	MaxCallParticipants int `json:"maxParticipants"`
	// AllowScreenSharing gates the share-screen controls.
	AllowScreenSharing bool `json:"allowScreenSharing"`
	// AllowRecording gates recording UI. Recording is not implemented by the
	// native control plane yet (phase 4); always false today.
	AllowRecording bool `json:"allowRecording"`
	// EnableRinging gates incoming-call notifications for DM/GM channels.
	EnableRinging bool `json:"ringingEnabled"`
	// HostControlsAllowed gates host-control menus (mute/remove/lower-hand...).
	HostControlsAllowed bool `json:"hostControlsAllowed"`
	// GroupCallsAllowed gates calls in non-DM channels.
	GroupCallsAllowed bool `json:"groupCallsAllowed"`
	// EnableVideo gates camera UI (the native SFU path always supports video).
	EnableVideo bool `json:"enableVideo"`
	// EnableReactions gates the in-call reaction stream.
	EnableReactions bool `json:"enableReactions"`
	// ICEServers is the configured ICE server list (comma-separated URLs).
	ICEServers []map[string]any `json:"iceServers,omitempty"`
}

// GetConfig returns the client-facing calls configuration.
func (s *CallService) GetConfig() *ConfigView {
	cfg := s.callsConfig()
	view := &ConfigView{
		Enabled:             s.Enabled() && s.HasRTCD(),
		MaxCallParticipants: cfg.maxParticipants(),
		AllowScreenSharing:  cfg.allowScreenSharing(),
		AllowRecording:      false, // phase 4 (rtcd recording is not wired yet)
		EnableRinging:       true,
		HostControlsAllowed: true,
		GroupCallsAllowed:   true,
		EnableVideo:         true,
		EnableReactions:     true,
		ICEServers:          s.iceServersForHost(""),
	}
	return view
}

// GetCallState returns a snapshot of a call for API responses.
func (s *CallService) GetCallState(callID string) (*CallStateView, error) {
	cs, ok := s.shards.get(callID)
	if !ok {
		return nil, ErrCallNotFound
	}
	views, hostSessionID := cs.snapshot()
	return &CallStateView{
		CallID:        cs.callID,
		ChannelID:     cs.channelID,
		StartAt:       cs.startAt,
		EndAt:         cs.endAt,
		RTCDHost:      cs.rtcdHost,
		Sessions:      views,
		Participants:  len(views),
		HostSessionID: hostSessionID,
	}, nil
}

// callIDForChannel derives a stable callID for a channel's in-progress call.
// Since at most one call is active per channel, the channelID itself (prefixed)
// keys the shard so StartCall is idempotent per channel.
func callIDForChannel(channelID string) string {
	return "ch:" + channelID
}

// CallIDForChannel is the exported form for API layers that need to resolve a
// channel's active call.
func CallIDForChannel(channelID string) string {
	return callIDForChannel(channelID)
}

// broadcast publishes an event through the shared websocket hub. The hub
// adapter (callsHubAdapter → PlatformService.PublishWebSocketEvent) adds the
// "custom_calls_" product prefix, so the event name here is the bare form
// (e.g. "call_start" → clients receive "custom_calls_call_start").
func (s *CallService) broadcast(event string, data map[string]any, bcast *model.WebsocketBroadcast) {
	if s.hub == nil {
		return
	}
	s.hub.Publish(event, data, bcast)
}
