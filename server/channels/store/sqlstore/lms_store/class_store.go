package lmsstore

import (
	"database/sql"
	"fmt"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlClassStore struct {
	sqlStore store.Store
}

func NewSqlClassStore(s store.Store) store.ClassStore {
	return &SqlClassStore{sqlStore: s}
}

func (s *SqlClassStore) Get(id string) (*lms_models.Class, error) {
	class, err := lms_models.FindClass(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Class", id)
		}
		return nil, errors.Wrap(err, "failed to get class")
	}
	return class, nil
}

func (s *SqlClassStore) Search(opts modelhelper.ClassFilterOpts) ([]*lms_models.Class, int64, error) {
	mods := []qm.QueryMod{}

	if opts.Search != "" {
		mods = append(mods, &utils.WhereOrs[utils.ClassColumn]{
			{
				Column:   utils.ClassColumn(lms_models.ClassTableColumns.Name),
				Operator: utils.OperatorILike,
				Value:    fmt.Sprintf("%%%s%%", opts.Search),
			},
		})
	}

	modsWithPagination := append(mods, &opts.SearchOpts)
	classes, err := lms_models.Classes(modsWithPagination...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to search classes")
	}
	totalCount := int64(len(classes))

	if opts.CountTotal {
		modsWithoutPagination := append(mods, opts.SearchOpts.ExludePaginationForCount())
		totalCount, err = lms_models.Classes(modsWithoutPagination...).Count(s.sqlStore.GetReplicaExecuter())
		if err != nil {
			return nil, 0, errors.Wrap(err, "failed to count classes")
		}
	}

	return classes, totalCount, nil
}

func (s *SqlClassStore) Save(class *lms_models.Class) (*lms_models.Class, error) {
	modelhelper.ClassPreCreate(class)
	if err := modelhelper.ClassIsValid(class); err != nil {
		return nil, err
	}

	if err := class.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save class")
	}
	return class, nil
}

func (s *SqlClassStore) Update(class *lms_models.Class) (*lms_models.Class, error) {
	modelhelper.ClassPreUpdate(class)
	if err := modelhelper.ClassIsValid(class); err != nil {
		return nil, err
	}

	rowsAffected, err := class.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update class")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("Class", class.ID)
	}

	if err := class.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload class")
	}
	return class, nil
}

func (s *SqlClassStore) Delete(id string) error {
	class, err := lms_models.FindClass(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Class", id)
		}
		return errors.Wrap(err, "failed to find class for deletion")
	}

	if _, err := class.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete class")
	}
	return nil
}
