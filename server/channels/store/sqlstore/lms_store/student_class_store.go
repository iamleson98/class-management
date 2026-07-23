package lmsstore

import (
	"database/sql"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlStudentClassStore struct {
	sqlStore store.Store
}

func NewSqlStudentClassStore(s store.Store) store.StudentClassStore {
	return &SqlStudentClassStore{sqlStore: s}
}

func (s *SqlStudentClassStore) Get(id string) (*lms_models.StudentClass, error) {
	sc, err := lms_models.FindStudentClass(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("StudentClass", id)
		}
		return nil, errors.Wrap(err, "failed to get student class")
	}
	return sc, nil
}

func (s *SqlStudentClassStore) GetByClass(classID string) ([]*lms_models.StudentClass, error) {
	records, err := lms_models.StudentClasses(
		lms_models.StudentClassWhere.ClassID.EQ(classID),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get student classes by class")
	}

	return records, nil
}

func (s *SqlStudentClassStore) GetByStudent(studentID string) ([]*lms_models.StudentClass, error) {
	records, err := lms_models.StudentClasses(
		lms_models.StudentClassWhere.StudentID.EQ(studentID),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get student classes by student")
	}

	return records, nil
}

func (s *SqlStudentClassStore) GetExisting(studentID, classID string) (*lms_models.StudentClass, error) {
	sc, err := lms_models.StudentClasses(
		lms_models.StudentClassWhere.StudentID.EQ(studentID),
		lms_models.StudentClassWhere.ClassID.EQ(classID),
	).One(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, errors.Wrap(err, "failed to get existing student class")
	}
	return sc, nil
}

func (s *SqlStudentClassStore) Save(sc *lms_models.StudentClass) (*lms_models.StudentClass, error) {
	modelhelper.StudentClassPreCreate(sc)
	if err := modelhelper.StudentClassIsValid(sc); err != nil {
		return nil, err
	}

	if err := sc.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save student class")
	}
	return sc, nil
}

func (s *SqlStudentClassStore) Delete(id string) error {
	sc, err := lms_models.FindStudentClass(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("StudentClass", id)
		}
		return errors.Wrap(err, "failed to find student class for deletion")
	}

	if _, err := sc.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete student class")
	}
	return nil
}

func (s *SqlStudentClassStore) DeleteByClass(classID string) error {
	_, err := lms_models.StudentClasses(
		lms_models.StudentClassWhere.ClassID.EQ(classID),
	).DeleteAll(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete student classes by class")
	}
	return nil
}

func (s *SqlStudentClassStore) DeleteByStudent(studentID string) error {
	_, err := lms_models.StudentClasses(
		lms_models.StudentClassWhere.StudentID.EQ(studentID),
	).DeleteAll(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete student classes by student")
	}
	return nil
}

func (s *SqlStudentClassStore) CountByStudent(studentID, status string) (int64, error) {
	var mods []qm.QueryMod
	mods = append(mods, lms_models.StudentClassWhere.StudentID.EQ(studentID))
	if status != "" {
		mods = append(mods, lms_models.StudentClassWhere.Status.EQ(status))
	}
	count, err := lms_models.StudentClasses(mods...).Count(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return 0, errors.Wrap(err, "failed to count student classes")
	}
	return count, nil
}
