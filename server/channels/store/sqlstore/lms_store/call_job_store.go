// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package lmsstore

import (
	"database/sql"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

// SqlCallJobStore persists recording / transcription / captions jobs. A job
// corresponds to a bot user joining the call as a participant.
type SqlCallJobStore struct {
	sqlStore store.Store
}

// NewSqlCallJobStore creates a CallJobStore backed by the given Store.
func NewSqlCallJobStore(s store.Store) store.CallJobStore {
	return &SqlCallJobStore{sqlStore: s}
}

// Get returns the call job with the given id.
func (s *SqlCallJobStore) Get(jobID string) (*model.CallJob, error) {
	row := s.sqlStore.GetReplicaExecuter().QueryRow(
		`SELECT id, callid, type, startat, endat, props, err, createat, updateat
		 FROM call_jobs WHERE id = $1`,
		jobID,
	)
	job, err := scanCallJob(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("CallJob", jobID)
		}
		return nil, errors.Wrap(err, "failed to find call job")
	}
	return job, nil
}

// GetByCall returns all jobs for a call, ordered by start time.
func (s *SqlCallJobStore) GetByCall(callID string) ([]*model.CallJob, error) {
	rows, err := s.sqlStore.GetReplicaExecuter().Query(
		`SELECT id, callid, type, startat, endat, props, err, createat, updateat
		 FROM call_jobs WHERE callid = $1 ORDER BY startat ASC`,
		callID,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get call jobs by call")
	}
	defer rows.Close()
	return iterateCallJobs(rows)
}

// Save inserts a new call job record.
func (s *SqlCallJobStore) Save(job *model.CallJob) (*model.CallJob, error) {
	job.PreSave()
	_, err := s.sqlStore.GetMasterExecuter().Exec(
		`INSERT INTO call_jobs (id, callid, type, startat, endat, props, err, createat, updateat)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		job.ID, job.CallID, job.Type, job.StartAt, job.EndAt, job.Props, job.Err, job.CreateAt, job.UpdateAt,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to save call job")
	}
	return job, nil
}

// Update modifies an existing call job record.
func (s *SqlCallJobStore) Update(job *model.CallJob) (*model.CallJob, error) {
	job.PreUpdate()
	res, err := s.sqlStore.GetMasterExecuter().Exec(
		`UPDATE call_jobs SET startat = $1, endat = $2, props = $3, err = $4, updateat = $5 WHERE id = $6`,
		job.StartAt, job.EndAt, job.Props, job.Err, job.UpdateAt, job.ID,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update call job")
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return nil, store.NewErrNotFound("CallJob", job.ID)
	}
	return job, nil
}

// Delete removes a call job record.
func (s *SqlCallJobStore) Delete(jobID string) error {
	_, err := s.sqlStore.GetMasterExecuter().Exec(`DELETE FROM call_jobs WHERE id = $1`, jobID)
	if err != nil {
		return errors.Wrap(err, "failed to delete call job")
	}
	return nil
}

func scanCallJob(sc scanner) (*model.CallJob, error) {
	job := &model.CallJob{}
	if err := sc.Scan(&job.ID, &job.CallID, &job.Type, &job.StartAt, &job.EndAt, &job.Props, &job.Err, &job.CreateAt, &job.UpdateAt); err != nil {
		return nil, err
	}
	return job, nil
}

func iterateCallJobs(rows *sql.Rows) ([]*model.CallJob, error) {
	jobs := []*model.CallJob{}
	for rows.Next() {
		job, err := scanCallJob(rows)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan call job")
		}
		jobs = append(jobs, job)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed to iterate call jobs")
	}
	return jobs, nil
}
