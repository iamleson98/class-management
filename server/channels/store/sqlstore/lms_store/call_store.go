// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package lmsstore

import (
	"database/sql"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

// SqlCallStore persists call lifecycle records (start / end).
//
// The authoritative live call state lives in-memory in the calls service;
// this store records only the durable boundaries for history and reporting.
//
// It follows the LMS store conventions: it lives in the lms_store subpackage,
// holds the store.Store interface (not *SqlStore), and reads/writes through
// GetReplicaExecuter()/GetMasterExecuter().
type SqlCallStore struct {
	sqlStore store.Store
}

// NewSqlCallStore creates a CallStore backed by the given Store.
func NewSqlCallStore(s store.Store) store.CallStore {
	return &SqlCallStore{sqlStore: s}
}

// Get returns the call with the given id.
func (s *SqlCallStore) Get(callID string) (*model.Call, error) {
	row := s.sqlStore.GetReplicaExecuter().QueryRow(
		`SELECT id, channelid, ownerid, postid, startat, endat, createat, updateat
		 FROM calls WHERE id = $1`,
		callID,
	)
	call, err := scanCall(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Call", callID)
		}
		return nil, errors.Wrap(err, "failed to find call")
	}
	return call, nil
}

// GetActiveByChannel returns the in-progress call (endat = 0) for a channel.
func (s *SqlCallStore) GetActiveByChannel(channelID string) (*model.Call, error) {
	row := s.sqlStore.GetReplicaExecuter().QueryRow(
		`SELECT id, channelid, ownerid, postid, startat, endat, createat, updateat
		 FROM calls WHERE channelid = $1 AND endat = 0 ORDER BY startat DESC LIMIT 1`,
		channelID,
	)
	call, err := scanCall(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Call", channelID)
		}
		return nil, errors.Wrap(err, "failed to get active call by channel")
	}
	return call, nil
}

// Search returns calls matching the given filter, newest first.
func (s *SqlCallStore) Search(opts store.CallFilterOpts) ([]*model.Call, error) {
	query := `SELECT id, channelid, ownerid, postid, startat, endat, createat, updateat FROM calls WHERE 1=1`
	args := []any{}
	i := 1
	if opts.ChannelID != "" {
		query += ` AND channelid = $` + argN(i)
		args = append(args, opts.ChannelID)
		i++
	}
	if opts.OwnerID != "" {
		query += ` AND ownerid = $` + argN(i)
		args = append(args, opts.OwnerID)
		i++
	}
	if opts.Active != nil {
		if *opts.Active {
			query += ` AND endat = 0`
		} else {
			query += ` AND endat > 0`
		}
	}
	query += ` ORDER BY startat DESC`
	if opts.PerPage > 0 {
		query += ` LIMIT $` + argN(i)
		args = append(args, opts.PerPage)
		i++
		if opts.Page > 0 {
			query += ` OFFSET $` + argN(i)
			args = append(args, opts.Page*opts.PerPage)
		}
	}

	rows, err := s.sqlStore.GetReplicaExecuter().Query(query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to search calls")
	}
	defer rows.Close()

	calls := []*model.Call{}
	for rows.Next() {
		call, err := scanCall(rows)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan call")
		}
		calls = append(calls, call)
	}
	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed to iterate calls")
	}
	return calls, nil
}

// Save inserts a new call record.
func (s *SqlCallStore) Save(call *model.Call) (*model.Call, error) {
	call.PreSave()
	if err := call.IsValid(); err != nil {
		return nil, err
	}
	_, err := s.sqlStore.GetMasterExecuter().Exec(
		`INSERT INTO calls (id, channelid, ownerid, postid, startat, endat, createat, updateat)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		call.ID, call.ChannelID, call.OwnerID, call.PostID, call.StartAt, call.EndAt, call.CreateAt, call.UpdateAt,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to save call")
	}
	return call, nil
}

// Update modifies an existing call record.
func (s *SqlCallStore) Update(call *model.Call) (*model.Call, error) {
	call.PreUpdate()
	res, err := s.sqlStore.GetMasterExecuter().Exec(
		`UPDATE calls SET channelid = $1, ownerid = $2, postid = $3, startat = $4, endat = $5, updateat = $6
		 WHERE id = $7`,
		call.ChannelID, call.OwnerID, call.PostID, call.StartAt, call.EndAt, call.UpdateAt, call.ID,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update call")
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return nil, store.NewErrNotFound("Call", call.ID)
	}
	return call, nil
}

// Delete removes a call record.
func (s *SqlCallStore) Delete(callID string) error {
	_, err := s.sqlStore.GetMasterExecuter().Exec(`DELETE FROM calls WHERE id = $1`, callID)
	if err != nil {
		return errors.Wrap(err, "failed to delete call")
	}
	return nil
}

// scanner abstracts *sql.Row and *sql.Rows for a single scan helper.
type scanner interface {
	Scan(dest ...any) error
}

func scanCall(sc scanner) (*model.Call, error) {
	c := &model.Call{}
	if err := sc.Scan(&c.ID, &c.ChannelID, &c.OwnerID, &c.PostID, &c.StartAt, &c.EndAt, &c.CreateAt, &c.UpdateAt); err != nil {
		return nil, err
	}
	return c, nil
}
