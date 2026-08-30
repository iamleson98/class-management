// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

// CallPostType is the post type for the channel posts that announce calls
// (start/end). The webapp renders these as interactive call cards with a
// join/leave button, matching the Calls plugin's custom_calls post type.
const CallPostType = "custom_calls"

// PostCreator is the app-layer bridge for persisting call posts. The calls
// service never touches the post store directly; the app (which owns post
// creation, websocket fan-out and notifications) adapts this interface in
// server/channels/app.
type PostCreator interface {
	// CreateCallPost creates a channel post announcing a call start, returning
	// the new post id.
	CreateCallPost(channelID, userID string, props map[string]any) (string, error)
	// UpdateCallPostEnded marks the call's post as ended (end_at, participants).
	UpdateCallPostEnded(postID string, props map[string]any) error
}

// callPostPropsStart builds the post props for a call start.
func callPostPropsStart(startAt int64) map[string]any {
	return map[string]any{
		"start_at": startAt,
		"title":    "Call started",
	}
}

// callPostPropsEnd builds the post props merged onto the call post at end.
func callPostPropsEnd(endAt int64, participants []string) map[string]any {
	if participants == nil {
		participants = []string{}
	}
	return map[string]any{
		"end_at":       endAt,
		"participants": participants,
	}
}

// createCallPost announces a started call in its channel. Failures are logged
// and swallowed: a call must be able to run even when post creation fails
// (e.g. notifications pipeline degraded).
func (s *CallService) createCallPost(cs *callState, ownerID string) string {
	pc := s.postCreator()
	if pc == nil {
		return ""
	}
	postID, err := pc.CreateCallPost(cs.channelID, ownerID, callPostPropsStart(cs.startAt))
	if err != nil {
		s.log.Warn("calls: failed to create call post", mlog.Err(err))
		return ""
	}
	return postID
}

// endCallPost marks the call's announcement post as ended. Best effort.
func (s *CallService) endCallPost(callID, postID string, participants []string) {
	if postID == "" {
		return
	}
	pc := s.postCreator()
	if pc == nil {
		return
	}
	if err := pc.UpdateCallPostEnded(postID, callPostPropsEnd(model.GetMillis(), participants)); err != nil {
		s.log.Warn("calls: failed to update call post", mlog.String("callID", callID), mlog.Err(err))
	}
}

// postCreator resolves the (lazily wired) app-layer post bridge.
func (s *CallService) postCreator() PostCreator {
	if s.cfg.PostCreatorFn == nil {
		return nil
	}
	return s.cfg.PostCreatorFn()
}
