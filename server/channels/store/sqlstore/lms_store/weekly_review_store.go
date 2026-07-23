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

type SqlWeeklyReviewStore struct {
	sqlStore store.Store
}

func NewSqlWeeklyReviewStore(s store.Store) store.WeeklyReviewStore {
	return &SqlWeeklyReviewStore{sqlStore: s}
}

func (s *SqlWeeklyReviewStore) Get(id string) (*lms_models.WeeklyReview, error) {
	review, err := lms_models.FindWeeklyReview(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("WeeklyReview", id)
		}
		return nil, errors.Wrap(err, "failed to find weekly review")
	}

	return review, nil
}

func (s *SqlWeeklyReviewStore) GetAll(opts modelhelper.WeeklyReviewFilterOpts) ([]*lms_models.WeeklyReview, error) {
	var mods []qm.QueryMod

	if opts.StudentID != "" {
		mods = append(mods, lms_models.WeeklyReviewWhere.StudentID.EQ(opts.StudentID))
	}
	if opts.ClassID != "" {
		mods = append(mods, lms_models.WeeklyReviewWhere.ClassID.EQ(opts.ClassID))
	}

	mods = append(mods, qm.OrderBy(lms_models.WeeklyReviewColumns.WeekNumber+" ASC"))

	reviews, err := lms_models.WeeklyReviews(mods...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get weekly reviews")
	}

	return reviews, nil
}

func (s *SqlWeeklyReviewStore) Save(wr *lms_models.WeeklyReview) (*lms_models.WeeklyReview, error) {
	modelhelper.WeeklyReviewPreCreate(wr)
	if err := modelhelper.WeeklyReviewIsValid(wr); err != nil {
		return nil, err
	}

	if err := wr.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save weekly review")
	}

	return wr, nil
}

func (s *SqlWeeklyReviewStore) Update(wr *lms_models.WeeklyReview) (*lms_models.WeeklyReview, error) {
	modelhelper.WeeklyReviewPreUpdate(wr)
	if err := modelhelper.WeeklyReviewIsValid(wr); err != nil {
		return nil, err
	}

	rowsAffected, err := wr.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update weekly review")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("WeeklyReview", wr.ID)
	}

	if err := wr.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload weekly review")
	}

	return wr, nil
}

func (s *SqlWeeklyReviewStore) Delete(id string) error {
	review, err := lms_models.FindWeeklyReview(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("WeeklyReview", id)
		}
		return errors.Wrap(err, "failed to find weekly review for deletion")
	}

	if _, err := review.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete weekly review")
	}

	return nil
}

func (s *SqlWeeklyReviewStore) Count(opts modelhelper.WeeklyReviewFilterOpts) (int64, error) {
	var mods []qm.QueryMod

	if opts.StudentID != "" {
		mods = append(mods, lms_models.WeeklyReviewWhere.StudentID.EQ(opts.StudentID))
	}
	if opts.ClassID != "" {
		mods = append(mods, lms_models.WeeklyReviewWhere.ClassID.EQ(opts.ClassID))
	}

	count, err := lms_models.WeeklyReviews(mods...).Count(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return 0, errors.Wrap(err, "failed to count weekly reviews")
	}
	return count, nil
}
