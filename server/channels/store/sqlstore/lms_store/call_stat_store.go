// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package lmsstore

import (
	"database/sql"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

// SqlCallStatStore persists one aggregate row per completed call. Written once
// at call end (or by a cleanup job). Never on the live (hot) path.
type SqlCallStatStore struct {
	sqlStore store.Store
}

// NewSqlCallStatStore creates a CallStatStore backed by the given Store.
func NewSqlCallStatStore(s store.Store) store.CallStatStore {
	return &SqlCallStatStore{sqlStore: s}
}

// Get returns the call stat with the given id.
func (s *SqlCallStatStore) Get(statID string) (*model.CallStat, error) {
	row := s.sqlStore.GetReplicaExecuter().QueryRow(
		`SELECT id, callid, channelid, participants, peak_participants, duration_seconds, createat
		 FROM call_stats WHERE id = $1`,
		statID,
	)
	stat, err := scanCallStat(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("CallStat", statID)
		}
		return nil, errors.Wrap(err, "failed to find call stat")
	}
	return stat, nil
}

// GetByCall returns the aggregate stat for a call.
func (s *SqlCallStatStore) GetByCall(callID string) (*model.CallStat, error) {
	row := s.sqlStore.GetReplicaExecuter().QueryRow(
		`SELECT id, callid, channelid, participants, peak_participants, duration_seconds, createat
		 FROM call_stats WHERE callid = $1`,
		callID,
	)
	stat, err := scanCallStat(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("CallStat", callID)
		}
		return nil, errors.Wrap(err, "failed to get call stat by call")
	}
	return stat, nil
}

// GetByChannel returns historical call stats for a channel, newest first.
func (s *SqlCallStatStore) GetByChannel(channelID string, page, perPage int) ([]*model.CallStat, error) {
	q := `SELECT id, callid, channelid, participants, peak_participants, duration_seconds, createat
	      FROM call_stats WHERE channelid = $1 ORDER BY createat DESC`
	args := []any{channelID}
	if perPage > 0 {
		q += ` LIMIT $2`
		args = append(args, perPage)
		if page > 0 {
			q += ` OFFSET $3`
			args = append(args, page*perPage)
		}
	}
	rows, err := s.sqlStore.GetReplicaExecuter().Query(q, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get call stats by channel")
	}
	defer rows.Close()

	stats := []*model.CallStat{}
	for rows.Next() {
		stat, err := scanCallStat(rows)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan call stat")
		}
		stats = append(stats, stat)
	}
	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed to iterate call stats")
	}
	return stats, nil
}

// Save inserts a new call stat record.
func (s *SqlCallStatStore) Save(stat *model.CallStat) (*model.CallStat, error) {
	if stat.CreateAt == 0 {
		stat.CreateAt = model.GetMillis()
	}
	_, err := s.sqlStore.GetMasterExecuter().Exec(
		`INSERT INTO call_stats (id, callid, channelid, participants, peak_participants, duration_seconds, createat)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		stat.ID, stat.CallID, stat.ChannelID, stat.Participants, stat.PeakParticipants, stat.DurationSeconds, stat.CreateAt,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to save call stat")
	}
	return stat, nil
}

func scanCallStat(sc scanner) (*model.CallStat, error) {
	stat := &model.CallStat{}
	if err := sc.Scan(&stat.ID, &stat.CallID, &stat.ChannelID, &stat.Participants, &stat.PeakParticipants, &stat.DurationSeconds, &stat.CreateAt); err != nil {
		return nil, err
	}
	return stat, nil
}
