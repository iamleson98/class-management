// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"errors"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

// Per-channel calls management: enable/disable calls for one channel (the
// plugin's "Enable calls" channel-header action), the channel-scoped state
// feed used by the webapp to seed join buttons for every channel in one
// request, and incoming-call dismissal sync across a user's devices.

var ErrChannelCallsDisabled = errors.New("calls: calls are disabled for this channel")

// CallsChannelView is the per-channel configuration surfaced to clients.
type CallsChannelView struct {
	ChannelID          string `json:"channel_id"`
	Enabled            bool   `json:"enabled"`
	MaxParticipants    int    `json:"max_participants"`
	AllowScreenSharing bool   `json:"allow_screen_sharing"`
	AllowRecording     bool   `json:"allow_recording"`
}

// GetCallsChannel returns the per-channel calls configuration. Channels
// without a stored row are enabled by default.
func (s *CallService) GetCallsChannel(channelID string) *CallsChannelView {
	view := &CallsChannelView{ChannelID: channelID, Enabled: true}

	if cc, err := s.store.CallsChannel().Get(channelID); err == nil && cc != nil {
		view.Enabled = cc.Enabled
		view.MaxParticipants = cc.MaxParticipants
		view.AllowScreenSharing = cc.AllowScreenSharing
		view.AllowRecording = cc.AllowRecording
	} else if err != nil && !store.IsErrNotFound(err) {
		s.log.Warn("calls: failed to load calls channel config",
			mlog.String("channelID", channelID), mlog.Err(err))
	}
	return view
}

// SetCallsChannelEnabled turns calls on/off for one channel, persists the
// preference, and broadcasts the channel_enable_voice / channel_disable_voice
// events so every connected client updates its header button immediately.
func (s *CallService) SetCallsChannelEnabled(channelID string, enabled bool, userID string) error {
	if channelID == "" {
		return errors.New("calls: channelID is required")
	}

	now := model.GetMillis()
	if _, err := s.store.CallsChannel().Save(&model.CallsChannel{
		ChannelID:          channelID,
		Enabled:            enabled,
		MaxParticipants:    0, // reserved for per-channel overrides
		AllowScreenSharing: true,
		AllowRecording:     false,
		CreateAt:           now,
		UpdateAt:           now,
	}); err != nil {
		return err
	}

	ev := eventChannelDisableVoice
	if enabled {
		ev = eventChannelEnableVoice
	}
	s.publishChannel(channelID, ev, map[string]any{
		"channel_id": channelID,
		"user_id":    userID,
	})
	return nil
}

// callsEnabledForChannel reports whether a call may run in the channel
// (global enable AND the channel's own preference).
func (s *CallService) callsEnabledForChannel(channelID string) bool {
	return s.GetCallsChannel(channelID).Enabled
}

// GetCallStates returns a snapshot of every in-progress call. The webapp uses
// this single request to seed join buttons and toasts for all channels
// instead of polling per channel.
func (s *CallService) GetCallStates() []CallStateView {
	states := s.allCallStates()
	out := make([]CallStateView, 0, len(states))
	for _, cs := range states {
		if cs.ended() {
			continue
		}
		views, hostSessionID := cs.snapshot()
		out = append(out, CallStateView{
			CallID:        cs.callID,
			ChannelID:     cs.channelID,
			StartAt:       cs.startAt,
			RTCDHost:      cs.rtcdHost,
			Sessions:      views,
			Participants:  len(views),
			HostSessionID: hostSessionID,
		})
	}
	return out
}

// DismissNotification syncs an incoming-call dismissal across the user's other
// devices: every connected session of the dismissing user receives
// user_dismissed_notification and stops ringing. No server state is kept —
// ringing is inherently transient (30s) and the event covers the live window.
func (s *CallService) DismissNotification(channelID, userID string) error {
	if channelID == "" || userID == "" {
		return errors.New("calls: channelID and userID are required")
	}
	s.hub.Publish(eventUserDismissedNotification, map[string]any{
		"channel_id": channelID,
		"user_id":    userID,
	}, &model.WebsocketBroadcast{UserId: userID, ReliableClusterSend: true})
	return nil
}
