// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package lmsstore

import (
	"database/sql"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

// SqlCallSessionStore persists per-participant join/leave records.
// Written exactly twice per participant per call (on join, on leave).
type SqlCallSessionStore struct {
	sqlStore store.Store
}

// NewSqlCallSessionStore creates a CallSessionStore backed by the given Store.
func NewSqlCallSessionStore(s store.Store) store.CallSessionStore {
	return &SqlCallSessionStore{sqlStore: s}
}

// Get returns the call session with the given id.
func (s *SqlCallSessionStore) Get(sessionID string) (*model.CallSession, error) {
	row := s.sqlStore.GetReplicaExecuter().QueryRow(
		`SELECT id, callid, userid, connid, startat, endat, createat, updateat
                 FROM call_sessions WHERE id = $1`,
		sessionID,
	)
	sess, err := scanCallSession(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("CallSession", sessionID)
		}
		return nil, errors.Wrap(err, "failed to find call session")
	}
	return sess, nil
}

// GetByCall returns all sessions for a call, ordered by join time.
func (s *SqlCallSessionStore) GetByCall(callID string) ([]*model.CallSession, error) {
	rows, err := s.sqlStore.GetReplicaExecuter().Query(
		`SELECT id, callid, userid, connid, startat, endat, createat, updateat
                 FROM call_sessions WHERE callid = $1 ORDER BY startat ASC`,
		callID,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get call sessions by call")
	}
	defer rows.Close()
	return iterateCallSessions(rows)
}

// GetByCallAndUser returns a user's most recent session in a call.
func (s *SqlCallSessionStore) GetByCallAndUser(callID, userID string) (*model.CallSession, error) {
	row := s.sqlStore.GetReplicaExecuter().QueryRow(
		`SELECT id, callid, userid, connid, startat, endat, createat, updateat
                 FROM call_sessions WHERE callid = $1 AND userid = $2
                 ORDER BY startat DESC LIMIT 1`,
		callID, userID,
	)
	sess, err := scanCallSession(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("CallSession", callID+","+userID)
		}
		return nil, errors.Wrap(err, "failed to get call session by call and user")
	}
	return sess, nil
}

// Save inserts a new call session record.
func (s *SqlCallSessionStore) Save(sess *model.CallSession) (*model.CallSession, error) {
	sess.PreSave()
	if err := sess.IsValid(); err != nil {
		return nil, err
	}
	_, err := s.sqlStore.GetMasterExecuter().Exec(
		`INSERT INTO call_sessions (id, callid, userid, connid, startat, endat, createat, updateat)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		sess.ID, sess.CallID, sess.UserID, sess.ConnID, sess.StartAt, sess.EndAt, sess.CreateAt, sess.UpdateAt,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to save call session")
	}
	return sess, nil
}

// Update modifies an existing call session record.
func (s *SqlCallSessionStore) Update(sess *model.CallSession) (*model.CallSession, error) {
	sess.PreUpdate()
	res, err := s.sqlStore.GetMasterExecuter().Exec(
		`UPDATE call_sessions SET startat = $1, endat = $2, updateat = $3 WHERE id = $4`,
		sess.StartAt, sess.EndAt, sess.UpdateAt, sess.ID,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update call session")
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return nil, store.NewErrNotFound("CallSession", sess.ID)
	}
	return sess, nil
}

// EndSession stamps the leave boundary on the open row for one session
// (callid + connid, where connid is the participant's stable call session id).
// Returns the number of rows closed (0 or 1). Closing per session id — not per
// user — keeps a second device of the same user in the call unaffected.
func (s *SqlCallSessionStore) EndSession(callID, connID string, endAt int64) (int64, error) {
	res, err := s.sqlStore.GetMasterExecuter().Exec(
		`UPDATE call_sessions SET endat = $1, updateat = $1
                 WHERE callid = $2 AND connid = $3 AND endat = 0`,
		endAt, callID, connID,
	)
	if err != nil {
		return 0, errors.Wrap(err, "failed to end call session")
	}
	rows, _ := res.RowsAffected()
	return rows, nil
}

// EndOpenSessions stamps the leave boundary on every open row of the call —
// the call-level teardown (host ends the call, idle reaper). Closing rows for
// participants whose own leave never ran keeps durations accurate; rows whose
// sessions already left normally have endat set and stay untouched.
func (s *SqlCallSessionStore) EndOpenSessions(callID string, endAt int64) (int64, error) {
	res, err := s.sqlStore.GetMasterExecuter().Exec(
		`UPDATE call_sessions SET endat = $1, updateat = $1
                 WHERE callid = $2 AND endat = 0`,
		endAt, callID,
	)
	if err != nil {
		return 0, errors.Wrap(err, "failed to end open call sessions")
	}
	rows, _ := res.RowsAffected()
	return rows, nil
}

// Delete removes a call session record.
func (s *SqlCallSessionStore) Delete(sessionID string) error {
	_, err := s.sqlStore.GetMasterExecuter().Exec(`DELETE FROM call_sessions WHERE id = $1`, sessionID)
	if err != nil {
		return errors.Wrap(err, "failed to delete call session")
	}
	return nil
}

func scanCallSession(sc scanner) (*model.CallSession, error) {
	sess := &model.CallSession{}
	if err := sc.Scan(&sess.ID, &sess.CallID, &sess.UserID, &sess.ConnID, &sess.StartAt, &sess.EndAt, &sess.CreateAt, &sess.UpdateAt); err != nil {
		return nil, err
	}
	return sess, nil
}

func iterateCallSessions(rows *sql.Rows) ([]*model.CallSession, error) {
	sessions := []*model.CallSession{}
	for rows.Next() {
		sess, err := scanCallSession(rows)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan call session")
		}
		sessions = append(sessions, sess)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed to iterate call sessions")
	}
	return sessions, nil
}
