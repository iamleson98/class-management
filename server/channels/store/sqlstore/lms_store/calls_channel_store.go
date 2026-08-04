// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package lmsstore

import (
	"database/sql"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

// SqlCallsChannelStore persists per-channel call configuration / defaults.
type SqlCallsChannelStore struct {
	sqlStore store.Store
}

// NewSqlCallsChannelStore creates a CallsChannelStore backed by the given Store.
func NewSqlCallsChannelStore(s store.Store) store.CallsChannelStore {
	return &SqlCallsChannelStore{sqlStore: s}
}

// Get returns the per-channel call configuration for a channel.
func (s *SqlCallsChannelStore) Get(channelID string) (*model.CallsChannel, error) {
	row := s.sqlStore.GetReplicaExecuter().QueryRow(
		`SELECT channelid, enabled, max_participants, allow_screen_sharing, allow_recording, createat, updateat
		 FROM calls_channels WHERE channelid = $1`,
		channelID,
	)
	cc, err := scanCallsChannel(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("CallsChannel", channelID)
		}
		return nil, errors.Wrap(err, "failed to find calls channel")
	}
	return cc, nil
}

// Save upserts a per-channel configuration row.
func (s *SqlCallsChannelStore) Save(cc *model.CallsChannel) (*model.CallsChannel, error) {
	cc.PreSave()
	_, err := s.sqlStore.GetMasterExecuter().Exec(
		`INSERT INTO calls_channels (channelid, enabled, max_participants, allow_screen_sharing, allow_recording, createat, updateat)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (channelid) DO UPDATE SET
		   enabled = EXCLUDED.enabled,
		   max_participants = EXCLUDED.max_participants,
		   allow_screen_sharing = EXCLUDED.allow_screen_sharing,
		   allow_recording = EXCLUDED.allow_recording,
		   updateat = EXCLUDED.updateat`,
		cc.ChannelID, cc.Enabled, cc.MaxParticipants, cc.AllowScreenSharing, cc.AllowRecording, cc.CreateAt, cc.UpdateAt,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to save calls channel")
	}
	return cc, nil
}

// Delete removes a per-channel configuration row.
func (s *SqlCallsChannelStore) Delete(channelID string) error {
	_, err := s.sqlStore.GetMasterExecuter().Exec(`DELETE FROM calls_channels WHERE channelid = $1`, channelID)
	if err != nil {
		return errors.Wrap(err, "failed to delete calls channel")
	}
	return nil
}

func scanCallsChannel(sc scanner) (*model.CallsChannel, error) {
	cc := &model.CallsChannel{}
	if err := sc.Scan(&cc.ChannelID, &cc.Enabled, &cc.MaxParticipants, &cc.AllowScreenSharing, &cc.AllowRecording, &cc.CreateAt, &cc.UpdateAt); err != nil {
		return nil, err
	}
	return cc, nil
}
