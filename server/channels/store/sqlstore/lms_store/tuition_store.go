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

type SqlTuitionStore struct {
	sqlStore store.Store
}

func NewSqlTuitionStore(s store.Store) store.TuitionStore {
	return &SqlTuitionStore{sqlStore: s}
}

func (s *SqlTuitionStore) Get(id string) (*lms_models.Tuition, error) {
	tuition, err := lms_models.FindTuition(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Tuition", id)
		}
		return nil, errors.Wrap(err, "failed to get tuition")
	}

	return tuition, nil
}

func (s *SqlTuitionStore) Search(opts modelhelper.TuitionFilterOpts) ([]*lms_models.Tuition, int64, error) {
	mods := []qm.QueryMod{}

	if opts.Search != "" {
		searchPattern := "%" + opts.Search + "%"
		mods = append(mods, qm.Or(
			"("+lms_models.TuitionTableColumns.StudentID+" IN (SELECT id FROM users WHERE username ILIKE ?) OR "+
				lms_models.TuitionTableColumns.StudentID+" IN (SELECT id FROM users WHERE first_name ILIKE ?) OR "+
				lms_models.TuitionTableColumns.StudentID+" IN (SELECT id FROM users WHERE last_name ILIKE ?))",
			searchPattern, searchPattern, searchPattern,
		))
	}

	modsWithPagination := append(mods, &opts.SearchOpts)
	tuitions, err := lms_models.Tuitions(modsWithPagination...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to search tuitions")
	}
	totalCount := int64(len(tuitions))

	if opts.CountTotal {
		modsWithoutPagination := append(mods, opts.SearchOpts.ExludePaginationForCount())
		totalCount, err = lms_models.Tuitions(modsWithoutPagination...).Count(s.sqlStore.GetReplicaExecuter())
		if err != nil {
			return nil, 0, errors.Wrap(err, "failed to count tuitions")
		}
	}

	return tuitions, totalCount, nil
}

func (s *SqlTuitionStore) Save(tuition *lms_models.Tuition) (*lms_models.Tuition, error) {
	modelhelper.TuitionPreCreate(tuition)
	if err := modelhelper.TuitionIsValid(tuition); err != nil {
		return nil, err
	}

	if err := tuition.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save tuition")
	}

	return tuition, nil
}

func (s *SqlTuitionStore) Update(tuition *lms_models.Tuition) (*lms_models.Tuition, error) {
	modelhelper.TuitionPreUpdate(tuition)
	if err := modelhelper.TuitionIsValid(tuition); err != nil {
		return nil, err
	}

	rowsAffected, err := tuition.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update tuition")
	}

	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("Tuition", tuition.ID)
	}

	if err := tuition.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload tuition after update")
	}

	return tuition, nil
}

func (s *SqlTuitionStore) Delete(id string) error {
	tuition, err := lms_models.FindTuition(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Tuition", id)
		}
		return errors.Wrap(err, "failed to find tuition for deletion")
	}

	rows, err := tuition.Delete(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete tuition")
	}

	if rows == 0 {
		return store.NewErrNotFound("Tuition", id)
	}

	return nil
}
