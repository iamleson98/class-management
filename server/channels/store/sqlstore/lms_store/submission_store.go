package lmsstore

import (
	"database/sql"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	"github.com/pkg/errors"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

type SqlSubmissionStore struct {
	sqlStore store.Store
}

func NewSqlSubmissionStore(s store.Store) store.SubmissionStore {
	return &SqlSubmissionStore{sqlStore: s}
}

func (s *SqlSubmissionStore) Get(id string) (*lms_models.Submission, error) {
	submission, err := lms_models.FindSubmission(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Submission", id)
		}
		return nil, errors.Wrap(err, "failed to find submission")
	}

	return submission, nil
}

func (s *SqlSubmissionStore) GetByHomework(homeworkID string) ([]*lms_models.Submission, error) {
	submissions, err := lms_models.Submissions(
		lms_models.SubmissionWhere.HomeworkID.EQ(homeworkID),
		qm.OrderBy(lms_models.SubmissionColumns.Createat+" DESC"),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get submissions by homework")
	}

	return submissions, nil
}

func (s *SqlSubmissionStore) GetByHomeworkAndStudent(homeworkID, studentID string) (*lms_models.Submission, error) {
	submission, err := lms_models.Submissions(
		lms_models.SubmissionWhere.HomeworkID.EQ(homeworkID),
		lms_models.SubmissionWhere.StudentID.EQ(studentID),
	).One(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Submission", homeworkID)
		}
		return nil, errors.Wrap(err, "failed to get submission by homework and student")
	}

	return submission, nil
}

func (s *SqlSubmissionStore) Save(sub *lms_models.Submission) (*lms_models.Submission, error) {
	modelhelper.SubmissionPreCreate(sub)
	if err := modelhelper.SubmissionIsValid(sub); err != nil {
		return nil, err
	}

	if err := sub.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save submission")
	}

	return sub, nil
}

func (s *SqlSubmissionStore) Update(sub *lms_models.Submission) (*lms_models.Submission, error) {
	modelhelper.SubmissionPreUpdate(sub)
	if err := modelhelper.SubmissionIsValid(sub); err != nil {
		return nil, err
	}

	rowsAffected, err := sub.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update submission")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("Submission", sub.ID)
	}

	if err := sub.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload submission")
	}

	return sub, nil
}

func (s *SqlSubmissionStore) Delete(id string) error {
	submission, err := lms_models.FindSubmission(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Submission", id)
		}
		return errors.Wrap(err, "failed to find submission for deletion")
	}

	if _, err := submission.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete submission")
	}

	return nil
}
