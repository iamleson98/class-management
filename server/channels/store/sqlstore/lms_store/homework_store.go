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

type SqlHomeworkStore struct {
	sqlStore store.Store
}

func NewSqlHomeworkStore(s store.Store) store.HomeworkStore {
	return &SqlHomeworkStore{sqlStore: s}
}

func (s *SqlHomeworkStore) Get(id string) (*lms_models.Homework, error) {
	homework, err := lms_models.FindHomework(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Homework", id)
		}
		return nil, errors.Wrap(err, "failed to find homework")
	}

	return homework, nil
}

func (s *SqlHomeworkStore) Search(opts modelhelper.HomeworkFilterOpts) ([]*lms_models.Homework, int64, error) {
	mods := []qm.QueryMod{}

	modsWithPagination := append(mods, &opts.SearchOpts)
	homeworks, err := lms_models.Homeworks(modsWithPagination...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to search homeworks")
	}
	totalCount := int64(len(homeworks))

	if opts.CountTotal {
		modsWithoutPagination := append(mods, opts.SearchOpts.ExludePaginationForCount())
		totalCount, err = lms_models.Homeworks(modsWithoutPagination...).Count(s.sqlStore.GetReplicaExecuter())
		if err != nil {
			return nil, 0, errors.Wrap(err, "failed to count homeworks")
		}
	}

	return homeworks, totalCount, nil
}

func (s *SqlHomeworkStore) Save(hw *lms_models.Homework) (*lms_models.Homework, error) {
	modelhelper.HomeworkPreCreate(hw)
	if err := modelhelper.HomeworkIsValid(hw); err != nil {
		return nil, err
	}

	if err := hw.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save homework")
	}

	return hw, nil
}

func (s *SqlHomeworkStore) Update(hw *lms_models.Homework) (*lms_models.Homework, error) {
	modelhelper.HomeworkPreUpdate(hw)
	if err := modelhelper.HomeworkIsValid(hw); err != nil {
		return nil, err
	}

	rowsAffected, err := hw.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update homework")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("Homework", hw.ID)
	}

	if err := hw.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload homework")
	}

	return hw, nil
}

func (s *SqlHomeworkStore) Delete(id string) error {
	homework, err := lms_models.FindHomework(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Homework", id)
		}
		return errors.Wrap(err, "failed to find homework for deletion")
	}

	if _, err := homework.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete homework")
	}

	return nil
}
