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

type SqlPostCategoryStore struct {
	sqlStore store.Store
}

func NewSqlPostCategoryStore(s store.Store) store.PostCategoryStore {
	return &SqlPostCategoryStore{sqlStore: s}
}

func (s *SqlPostCategoryStore) Get(id string) (*lms_models.PostCategory, error) {
	category, err := lms_models.FindPostCategory(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("PostCategory", id)
		}
		return nil, errors.Wrap(err, "failed to get post category")
	}

	return category, nil
}

func (s *SqlPostCategoryStore) GetAll() ([]*lms_models.PostCategory, error) {
	categories, err := lms_models.PostCategories(
		qm.OrderBy(lms_models.PostCategoryColumns.Name + " ASC"),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get all post categories")
	}

	return categories, nil
}

func (s *SqlPostCategoryStore) Save(pc *lms_models.PostCategory) (*lms_models.PostCategory, error) {
	modelhelper.PostCategoryPreCreate(pc)
	if err := modelhelper.PostCategoryIsValid(pc); err != nil {
		return nil, err
	}

	if err := pc.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save post category")
	}

	return pc, nil
}

func (s *SqlPostCategoryStore) Delete(id string) error {
	category, err := lms_models.FindPostCategory(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("PostCategory", id)
		}
		return errors.Wrap(err, "failed to find post category for deletion")
	}

	rows, err := category.Delete(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete post category")
	}

	if rows == 0 {
		return store.NewErrNotFound("PostCategory", id)
	}

	return nil
}
