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

type SqlMaterialStore struct {
	sqlStore store.Store
}

func NewSqlMaterialStore(s store.Store) store.MaterialStore {
	return &SqlMaterialStore{sqlStore: s}
}

func (s *SqlMaterialStore) Get(id string) (*lms_models.Material, error) {
	material, err := lms_models.FindMaterial(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Material", id)
		}
		return nil, errors.Wrap(err, "failed to find material")
	}

	return material, nil
}

func (s *SqlMaterialStore) GetAll(opts modelhelper.MaterialFilterOpts) ([]*lms_models.Material, error) {
	var mods []qm.QueryMod

	if opts.CourseID != "" {
		mods = append(mods, lms_models.MaterialWhere.CourseID.EQ(opts.CourseID))
	}
	if opts.Visibility != "" {
		mods = append(mods, lms_models.MaterialWhere.Visibility.EQ(opts.Visibility))
	}

	mods = append(mods, qm.OrderBy(lms_models.MaterialColumns.Createat+" DESC"))

	materials, err := lms_models.Materials(mods...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get materials")
	}

	return materials, nil
}

func (s *SqlMaterialStore) Save(m *lms_models.Material) (*lms_models.Material, error) {
	modelhelper.MaterialPreCreate(m)
	if err := modelhelper.MaterialIsValid(m); err != nil {
		return nil, err
	}

	if err := m.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save material")
	}

	return m, nil
}

func (s *SqlMaterialStore) Update(m *lms_models.Material) (*lms_models.Material, error) {
	modelhelper.MaterialPreUpdate(m)
	if err := modelhelper.MaterialIsValid(m); err != nil {
		return nil, err
	}

	rowsAffected, err := m.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update material")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("Material", m.ID)
	}

	if err := m.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload material")
	}

	return m, nil
}

func (s *SqlMaterialStore) Delete(id string) error {
	material, err := lms_models.FindMaterial(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Material", id)
		}
		return errors.Wrap(err, "failed to find material for deletion")
	}

	if _, err := material.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete material")
	}

	return nil
}

func (s *SqlMaterialStore) Count(opts modelhelper.MaterialFilterOpts) (int64, error) {
	var mods []qm.QueryMod

	if opts.CourseID != "" {
		mods = append(mods, lms_models.MaterialWhere.CourseID.EQ(opts.CourseID))
	}
	if opts.Visibility != "" {
		mods = append(mods, lms_models.MaterialWhere.Visibility.EQ(opts.Visibility))
	}

	count, err := lms_models.Materials(mods...).Count(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return 0, errors.Wrap(err, "failed to count materials")
	}
	return count, nil
}
