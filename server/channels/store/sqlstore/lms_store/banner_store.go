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

type SqlBannerStore struct {
	sqlStore store.Store
}

func NewSqlBannerStore(s store.Store) store.BannerStore {
	return &SqlBannerStore{sqlStore: s}
}

func (s *SqlBannerStore) Get(id string) (*lms_models.Banner, error) {
	banner, err := lms_models.FindBanner(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Banner", id)
		}
		return nil, errors.Wrap(err, "failed to find banner")
	}

	return banner, nil
}

func (s *SqlBannerStore) GetAll() ([]*lms_models.Banner, error) {
	banners, err := lms_models.Banners(
		qm.OrderBy(lms_models.BannerColumns.Position + " ASC"),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get banners")
	}

	return banners, nil
}

func (s *SqlBannerStore) Save(banner *lms_models.Banner) (*lms_models.Banner, error) {
	modelhelper.BannerPreCreate(banner)
	if err := modelhelper.BannerIsValid(banner); err != nil {
		return nil, err
	}

	if err := banner.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save banner")
	}

	return banner, nil
}

func (s *SqlBannerStore) Update(banner *lms_models.Banner) (*lms_models.Banner, error) {
	modelhelper.BannerPreUpdate(banner)
	if err := modelhelper.BannerIsValid(banner); err != nil {
		return nil, err
	}

	rowsAffected, err := banner.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update banner")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("Banner", banner.ID)
	}

	if err := banner.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload banner")
	}

	return banner, nil
}

func (s *SqlBannerStore) Delete(id string) error {
	banner, err := lms_models.FindBanner(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Banner", id)
		}
		return errors.Wrap(err, "failed to find banner for deletion")
	}

	if _, err := banner.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete banner")
	}

	return nil
}
