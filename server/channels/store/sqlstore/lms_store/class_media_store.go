package lmsstore

import (
	"database/sql"

	"github.com/aarondl/null/v8"
	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	"github.com/pkg/errors"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

type SqlClassMediaStore struct {
	sqlStore store.Store
}

func NewSqlClassMediaStore(s store.Store) store.ClassMediaStore {
	return &SqlClassMediaStore{sqlStore: s}
}

func (s *SqlClassMediaStore) Get(id string) (*lms_models.ClassMedium, error) {
	classMedia, err := lms_models.FindClassMedium(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("ClassMedium", id)
		}
		return nil, errors.Wrap(err, "failed to find class media")
	}

	return classMedia, nil
}

func (s *SqlClassMediaStore) GetAll(opts modelhelper.ClassMediaFilterOpts) ([]*lms_models.ClassMedium, error) {
	var mods []qm.QueryMod

	if opts.ClassID != "" {
		mods = append(mods, lms_models.ClassMediumWhere.ClassID.EQ(opts.ClassID))
	}
	if opts.SessionID != "" {
		mods = append(mods, lms_models.ClassMediumWhere.SessionID.EQ(null.StringFrom(opts.SessionID)))
	}

	mods = append(mods, qm.OrderBy(lms_models.ClassMediumColumns.Createat+" DESC"))

	classMedia, err := lms_models.ClassMedia(mods...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get class media")
	}

	return classMedia, nil
}

func (s *SqlClassMediaStore) Save(cm *lms_models.ClassMedium) (*lms_models.ClassMedium, error) {
	modelhelper.ClassMediaPreCreate(cm)
	if err := modelhelper.ClassMediaIsValid(cm); err != nil {
		return nil, err
	}

	if err := cm.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save class media")
	}

	return cm, nil
}

func (s *SqlClassMediaStore) Delete(id string) error {
	classMedia, err := lms_models.FindClassMedium(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("ClassMedia", id)
		}
		return errors.Wrap(err, "failed to find class media for deletion")
	}

	if _, err := classMedia.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete class media")
	}

	return nil
}

func (s *SqlClassMediaStore) Count(opts modelhelper.ClassMediaFilterOpts) (int64, error) {
	var mods []qm.QueryMod

	if opts.ClassID != "" {
		mods = append(mods, lms_models.ClassMediumWhere.ClassID.EQ(opts.ClassID))
	}
	if opts.SessionID != "" {
		mods = append(mods, lms_models.ClassMediumWhere.SessionID.EQ(null.StringFrom(opts.SessionID)))
	}

	count, err := lms_models.ClassMedia(mods...).Count(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return 0, errors.Wrap(err, "failed to count class media")
	}
	return count, nil
}
