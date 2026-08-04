// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

// Call represents one realtime call session in a channel.
//
// The authoritative live state (sessions map, transient presence) is held
// in-memory in the calls service. This struct is the persisted record used for
// call lifecycle (start/end) and history.
type Call struct {
	ID        string `json:"id" db:"id"`
	ChannelID string `json:"channel_id" db:"channelid"`
	OwnerID   string `json:"owner_id" db:"ownerid"`
	PostID    string `json:"post_id" db:"postid"`
	StartAt   int64  `json:"start_at" db:"startat"`
	EndAt     int64  `json:"end_at" db:"endat"`
	CreateAt  int64  `json:"create_at" db:"createat"`
	UpdateAt  int64  `json:"update_at" db:"updateat"`
}

// IsValid returns an AppError if the Call has invalid required fields.
func (c *Call) IsValid() *AppError {
	if c.ID == "" {
		return NewAppError("Call.IsValid", "model.calls.id.app_error", nil, "", http.StatusBadRequest)
	}
	if c.ChannelID == "" {
		return NewAppError("Call.IsValid", "model.calls.channel_id.app_error", nil, "", http.StatusBadRequest)
	}
	if c.OwnerID == "" {
		return NewAppError("Call.IsValid", "model.calls.owner_id.app_error", nil, "", http.StatusBadRequest)
	}
	if c.CreateAt == 0 {
		return NewAppError("Call.IsValid", "model.calls.create_at.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

// PreSave fills in CreateAt/UpdateAt if unset.
func (c *Call) PreSave() {
	now := GetMillis()
	if c.CreateAt == 0 {
		c.CreateAt = now
	}
	c.UpdateAt = now
}

// PreUpdate sets UpdateAt.
func (c *Call) PreUpdate() {
	c.UpdateAt = GetMillis()
}

// CallSession represents one participant's join/leave record for a call.
//
// Written exactly twice per participant per call (on join, on leave). Transient
// presence (mute/voice/screen/video) is intentionally NOT persisted — those are
// fanned out as realtime events only.
type CallSession struct {
	ID       string `json:"id" db:"id"`
	CallID   string `json:"call_id" db:"callid"`
	UserID   string `json:"user_id" db:"userid"`
	ConnID   string `json:"conn_id" db:"connid"`
	StartAt  int64  `json:"start_at" db:"startat"`
	EndAt    int64  `json:"end_at" db:"endat"`
	CreateAt int64  `json:"create_at" db:"createat"`
	UpdateAt int64  `json:"update_at" db:"updateat"`
}

func (s *CallSession) IsValid() *AppError {
	if s.ID == "" {
		return NewAppError("CallSession.IsValid", "model.call_session.id.app_error", nil, "", http.StatusBadRequest)
	}
	if s.CallID == "" {
		return NewAppError("CallSession.IsValid", "model.call_session.call_id.app_error", nil, "", http.StatusBadRequest)
	}
	if s.UserID == "" {
		return NewAppError("CallSession.IsValid", "model.call_session.user_id.app_error", nil, "", http.StatusBadRequest)
	}
	if s.ConnID == "" {
		return NewAppError("CallSession.IsValid", "model.call_session.conn_id.app_error", nil, "", http.StatusBadRequest)
	}
	if s.CreateAt == 0 {
		return NewAppError("CallSession.IsValid", "model.call_session.create_at.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func (s *CallSession) PreSave() {
	now := GetMillis()
	if s.CreateAt == 0 {
		s.CreateAt = now
	}
	s.UpdateAt = now
}

func (s *CallSession) PreUpdate() {
	s.UpdateAt = GetMillis()
}

// CallJobType enumerates the kinds of background jobs attached to a call.
type CallJobType string

const (
	CallJobTypeRecording     CallJobType = "recording"
	CallJobTypeTranscription CallJobType = "transcription"
	CallJobTypeLiveCaptions  CallJobType = "live_captions"
)

// CallJob represents a recording / transcription / captions job. A job
// corresponds to a bot user joining the call as a participant; rtcd sends the
// bot a mixed stream which the job captures (e.g. via ffmpeg). Props holds
// job-specific JSON.
type CallJob struct {
	ID       string      `json:"id" db:"id"`
	CallID   string      `json:"call_id" db:"callid"`
	Type     CallJobType `json:"type" db:"type"`
	StartAt  int64       `json:"start_at" db:"startat"`
	EndAt    int64       `json:"end_at" db:"endat"`
	Props    string      `json:"props" db:"props"`
	Err      string      `json:"err" db:"err"`
	CreateAt int64       `json:"create_at" db:"createat"`
	UpdateAt int64       `json:"update_at" db:"updateat"`
}

func (j *CallJob) PreSave() {
	now := GetMillis()
	if j.CreateAt == 0 {
		j.CreateAt = now
	}
	j.UpdateAt = now
}

func (j *CallJob) PreUpdate() {
	j.UpdateAt = GetMillis()
}

// CallStat is the aggregate historical record for a completed call.
// Written once at call end (or by a cleanup job) for reporting. Never on the
// live (hot) path.
type CallStat struct {
	ID               string `json:"id" db:"id"`
	CallID           string `json:"call_id" db:"callid"`
	ChannelID        string `json:"channel_id" db:"channelid"`
	Participants     int    `json:"participants" db:"participants"`
	PeakParticipants int    `json:"peak_participants" db:"peak_participants"`
	DurationSeconds  int    `json:"duration_seconds" db:"duration_seconds"`
	CreateAt         int64  `json:"create_at" db:"createat"`
}

// CallsChannel holds per-channel call configuration / defaults. Lazily created
// on first use; absent row means "channel defaults apply".
type CallsChannel struct {
	ChannelID          string `json:"channel_id" db:"channelid"`
	Enabled            bool   `json:"enabled" db:"enabled"`
	MaxParticipants    int    `json:"max_participants" db:"max_participants"`
	AllowScreenSharing bool   `json:"allow_screen_sharing" db:"allow_screen_sharing"`
	AllowRecording     bool   `json:"allow_recording" db:"allow_recording"`
	CreateAt           int64  `json:"create_at" db:"createat"`
	UpdateAt           int64  `json:"update_at" db:"updateat"`
}

func (cc *CallsChannel) PreSave() {
	now := GetMillis()
	if cc.CreateAt == 0 {
		cc.CreateAt = now
	}
	cc.UpdateAt = now
}

func (cc *CallsChannel) PreUpdate() {
	cc.UpdateAt = GetMillis()
}
