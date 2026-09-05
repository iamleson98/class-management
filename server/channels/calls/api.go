// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"errors"
	"fmt"

	rtcd "github.com/mattermost/rtcd/service"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

// Common errors returned by the service. These map to model.AppError at the
// API layer (see api4/calls_api/callsToAppError).
var (
	ErrCallsDisabled   = errors.New("calls: feature is disabled")
	ErrNoSFUHost       = errors.New("calls: no rtcd host available")
	ErrCallNotFound    = errors.New("calls: call not found")
	ErrCallEnded       = errors.New("calls: call has ended")
	ErrMaxParticipants = errors.New("calls: maximum participants reached")
	ErrSessionNotFound = errors.New("calls: session not found")
	ErrNotCallHost     = errors.New("calls: only the host can perform this action")
)

// Teardown reasons, used for log context on the shared session teardown path.
const (
	reasonLeft      = "left"
	reasonRemoved   = "removed"
	reasonRTCClosed = "rtc_closed"
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
//
// Call identity: every call row gets a fresh model.NewId() (26 chars), the
// same convention as every other persisted model row (channels.id,
// posts.id, users.id ...). The channel -> live-call relationship is runtime
// state (channelIndex), mirroring the Mattermost Calls plugin where the
// channel-keyed identity never touches an ID column. The "at most one live
// call per channel" invariant is arbitrated by the per-channel start lock.
func (s *CallService) StartCall(opts StartCallOpts) (*StartResult, error) {
	if !s.Enabled() {
		return nil, ErrCallsDisabled
	}
	if opts.ChannelID == "" || opts.OwnerID == "" {
		return nil, errors.New("calls: channelID and ownerID are required")
	}

	// Serialize starts per channel: with fresh NewId identities the reuse
	// check, registry insert, and channel-index registration must happen as
	// one atomic unit or two concurrent starts would create two calls. The
	// lock is held only across start (one DB write) — never on the signaling
	// hot path.
	startLock := s.chanLocks.lockFor(opts.ChannelID)
	startLock.Lock()
	defer startLock.Unlock()

	// Reuse an in-progress call for the channel if one exists.
	if cs, ok := s.channelCalls.getLive(opts.ChannelID); ok {
		return &StartResult{CallID: cs.callID, RTCDHost: cs.rtcdHost, StartAt: cs.startAt}, nil
	}

	// Assign an rtcd host for this call's media.
	mgr := s.rtcdManager()
	var rtcdHost string
	if mgr != nil {
		h, err := mgr.GetHostForNewCall()
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrNoSFUHost, err)
		}
		rtcdHost = h
	}

	now := model.GetMillis()

	// Fresh 26-char identity, valid by construction against the varchar(26)
	// calls.id column (model.IsValidId pins exactly this shape).
	callID := model.NewId()

	shard := s.shards.shardFor(callID)
	cs := newCallState(callID, opts.ChannelID, rtcdHost)
	state, created := shard.getOrCreateLive(callID, func() *callState { return cs })
	if !created {
		// Only reachable if a same-ID collision or an in-flight teardown of
		// this very state occurred; reuse the live state instead of
		// persisting and announcing a duplicate call_start.
		return &StartResult{CallID: state.callID, RTCDHost: state.rtcdHost, StartAt: state.startAt}, nil
	}

	// Persist the call record (durable boundary: call start). Roll back the
	// in-memory state ONLY for the state this call created — a lost racer
	// must never delete the winner's registry entry.
	call := &model.Call{
		ID:        callID,
		ChannelID: opts.ChannelID,
		OwnerID:   opts.OwnerID,
		PostID:    opts.PostID,
		StartAt:   now,
		CreateAt:  now,
	}
	if _, err := s.store.Call().Save(call); err != nil {
		shard.deleteIf(callID, state)
		return nil, fmt.Errorf("calls: failed to persist call: %w", err)
	}

	// Register the channel's live call AFTER the durable boundary so a
	// persist failure leaves no index entry behind. A prior generation's
	// in-flight teardown will observe the pointer change and skip its
	// deleteIf (its end persistence still completes).
	s.channelCalls.set(opts.ChannelID, state)

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
//
// It is idempotent per call generation: concurrent enders (the last two
// participants leaving at once, a host ending while the last participant
// leaves) produce exactly one persisted end boundary, one stats row, and one
// call_end broadcast.
func (s *CallService) EndCall(callID string) error {
	cs, ok := s.shards.get(callID)
	if !ok {
		return ErrCallNotFound
	}
	return s.endCallState(cs, model.GetMillis())
}

// endCallState tears down a specific call generation. Callers that already
// hold the callState (e.g. the last participant leaving) pass it directly so
// the generation check in the shard is exact.
func (s *CallService) endCallState(cs *callState, now int64) error {
	// First ender wins; everyone else gets ErrCallEnded.
	if !cs.markEnded(now) {
		return ErrCallEnded
	}

	views, _ := cs.snapshot()
	participantCount := len(views)
	sessionIDs := cs.sessionIDs()
	peakParticipants := cs.peak()

	// Registry cleanup, generation-guarded on both mappings. Call identities
	// are fresh NewId()s, so a successor generation on the channel occupies a
	// DIFFERENT shard slot; the authoritative "still the channel's live call"
	// check is the channel index's deleteIf — it also gates the call_end
	// broadcast so a newer generation's participants never receive a
	// call_end for a call they just joined.
	_ = s.shards.deleteIf(cs.callID, cs)
	owned := s.channelCalls.deleteIf(cs.channelID, cs)

	// Persist the end boundary and stats regardless of registry ownership:
	// this generation's call record owes its EndAt either way.
	call, err := s.store.Call().Get(cs.callID)
	if err != nil {
		s.log.Error("calls: failed to load call for end persistence",
			mlog.String("callID", cs.callID), mlog.Err(err))
	} else {
		call.EndAt = now
		if _, err := s.store.Call().Update(call); err != nil {
			s.log.Error("calls: failed to persist call end",
				mlog.String("callID", cs.callID), mlog.Err(err))
		}

		// Record aggregate stats (cheap; one row per call).
		if _, err := s.store.CallStat().Save(&model.CallStat{
			ID:               model.NewId(),
			CallID:           cs.callID,
			ChannelID:        cs.channelID,
			Participants:     participantCount,
			PeakParticipants: peakParticipants,
			DurationSeconds:  int((now - cs.startAt) / 1000),
			CreateAt:         now,
		}); err != nil {
			s.log.Error("calls: failed to persist call stats",
				mlog.String("callID", cs.callID), mlog.Err(err))
		}
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
	s.endCallPost(cs.callID, postID, participants)

	// Close every remaining session: its SFU leg (so the media session is
	// torn down server-side, not only when each browser notices the
	// call_end), its index entry, and its open call_sessions row. This is
	// the path a host-initiated end (or the idle reaper) takes over
	// still-connected participants.
	for _, id := range sessionIDs {
		if err := s.sendToHost(cs, rtcd.ClientMessage{
			Type: rtcd.ClientMessageLeave,
			Data: map[string]string{"sessionID": id},
		}); err != nil {
			s.log.Warn("calls: failed to close SFU session at call end",
				mlog.String("callID", cs.callID), mlog.String("sessionID", id), mlog.Err(err))
		}
		s.index.unlink(id, cs.connIDFor(id))
	}
	if _, err := s.store.CallSession().EndOpenSessions(cs.callID, now); err != nil {
		s.log.Warn("calls: failed to close open session boundaries at call end",
			mlog.String("callID", cs.callID), mlog.Err(err))
	}

	// Announce the end to channel members — but never when a newer
	// generation is already live on the channel (its participants must not
	// receive a call_end for a call they just joined).
	if owned {
		s.broadcast(eventCallEnd, map[string]any{
			"channel_id": cs.channelID,
			"call_id":    cs.callID,
			"end_at":     now,
		}, &model.WebsocketBroadcast{ChannelId: cs.channelID})
	}
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
	// ICEServers is the configured ICE server list (STUN/TURN URLs;
	// TURN entries carry their username/credential). Session-gated: only
	// authenticated clients fetch this endpoint.
	ICEServers []map[string]any `json:"iceServers,omitempty"`
}

// GetConfig returns the client-facing calls configuration.
func (s *CallService) GetConfig() *ConfigView {
	cfg := s.callsConfig()
	view := &ConfigView{
		Enabled:             s.Enabled() && s.HasRTCD(),
		MaxCallParticipants: cfg.maxParticipants(),
		AllowScreenSharing:  cfg.allowScreenSharing(),
		AllowRecording:      cfg.allowRecording(), // phase 4 (rtcd recording is not wired yet)
		EnableRinging:       cfg.enableRinging(),
		HostControlsAllowed: cfg.hostControlsAllowed(),
		GroupCallsAllowed:   cfg.groupCallsAllowed(),
		EnableVideo:         cfg.enableVideo(),
		EnableReactions:     cfg.enableReactions(),
		ICEServers:          s.iceServers(),
	}
	return view
}

// GetCallState returns a snapshot of the call with the given 26-char id.
func (s *CallService) GetCallState(callID string) (*CallStateView, error) {
	cs, ok := s.shards.get(callID)
	if !ok {
		return nil, ErrCallNotFound
	}
	return s.callStateView(cs), nil
}

// GetCallStateByChannel resolves the channel's current call. This is the
// runtime channel -> live-call mapping that replaced the historical
// channel-derived call ids: mirroring the Mattermost Calls design, the
// channel relationship lives in state, never in the persisted id — every
// call row carries its own model.NewId() like any other model row.
func (s *CallService) GetCallStateByChannel(channelID string) (*CallStateView, error) {
	cs, ok := s.channelCalls.get(channelID)
	if !ok {
		return nil, ErrCallNotFound
	}
	return s.callStateView(cs), nil
}

// callStateView builds the client-facing snapshot of a call state.
func (s *CallService) callStateView(cs *callState) *CallStateView {
	views, hostSessionID := cs.snapshot()
	return &CallStateView{
		CallID:        cs.callID,
		ChannelID:     cs.channelID,
		StartAt:       cs.startAt,
		EndAt:         cs.endedAt(),
		RTCDHost:      cs.rtcdHost,
		Sessions:      views,
		Participants:  len(views),
		HostSessionID: hostSessionID,
	}
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
