package lmsstore

import (
	"database/sql"

	"github.com/aarondl/sqlboiler/v4/boil"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlAttendanceStore struct {
	sqlStore store.Store
}

func NewSqlAttendanceStore(s store.Store) store.AttendanceStore {
	return &SqlAttendanceStore{sqlStore: s}
}

func (s *SqlAttendanceStore) Get(id string) (*lms_models.Attendance, error) {
	attendance, err := lms_models.FindAttendance(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Attendance", id)
		}
		return nil, errors.Wrap(err, "failed to get attendance")
	}
	return attendance, nil
}

func (s *SqlAttendanceStore) GetBySession(sessionID string) ([]*lms_models.Attendance, error) {
	attendances, err := lms_models.Attendances(
		lms_models.AttendanceWhere.SessionID.EQ(sessionID),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get attendances by session")
	}

	return attendances, nil
}

func (s *SqlAttendanceStore) GetBySessionAndStudent(sessionID, studentID string) (*lms_models.Attendance, error) {
	attendance, err := lms_models.Attendances(
		lms_models.AttendanceWhere.SessionID.EQ(sessionID),
		lms_models.AttendanceWhere.StudentID.EQ(studentID),
	).One(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, errors.Wrap(err, "failed to get attendance by session and student")
	}
	return attendance, nil
}

func (s *SqlAttendanceStore) Save(attendance *lms_models.Attendance) (*lms_models.Attendance, error) {
	modelhelper.AttendancePreCreate(attendance)
	if err := modelhelper.AttendanceIsValid(attendance); err != nil {
		return nil, err
	}

	if err := attendance.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save attendance")
	}
	return attendance, nil
}

func (s *SqlAttendanceStore) DeleteBySession(sessionID string) error {
	_, err := lms_models.Attendances(
		lms_models.AttendanceWhere.SessionID.EQ(sessionID),
	).DeleteAll(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete attendances by session")
	}
	return nil
}

func (s *SqlAttendanceStore) Delete(id string) error {
	attendance, err := lms_models.FindAttendance(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Attendance", id)
		}
		return errors.Wrap(err, "failed to find attendance for deletion")
	}

	if _, err := attendance.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete attendance")
	}
	return nil
}
