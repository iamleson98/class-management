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

type SqlFeePackageStore struct {
	sqlStore store.Store
}

func NewSqlFeePackageStore(s store.Store) store.FeePackageStore {
	return &SqlFeePackageStore{sqlStore: s}
}

func (s *SqlFeePackageStore) Get(id string) (*lms_models.FeePackage, error) {
	fp, err := lms_models.FindFeePackage(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("FeePackage", id)
		}
		return nil, errors.Wrap(err, "failed to get fee package")
	}

	return fp, nil
}

func (s *SqlFeePackageStore) Search(opts modelhelper.FeePackageFilterOpts) ([]*lms_models.FeePackage, int64, error) {
	mods := []qm.QueryMod{}

	modsWithPagination := append(mods, &opts.SearchOpts)
	feePackages, err := lms_models.FeePackages(modsWithPagination...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to search fee packages")
	}
	totalCount := int64(len(feePackages))

	if opts.CountTotal {
		modsWithoutPagination := append(mods, opts.SearchOpts.ExludePaginationForCount())
		totalCount, err = lms_models.FeePackages(modsWithoutPagination...).Count(s.sqlStore.GetReplicaExecuter())
		if err != nil {
			return nil, 0, errors.Wrap(err, "failed to count fee packages")
		}
	}

	return feePackages, totalCount, nil
}

func (s *SqlFeePackageStore) Save(fp *lms_models.FeePackage) (*lms_models.FeePackage, error) {
	modelhelper.FeePackagePreCreate(fp)
	if err := modelhelper.FeePackageIsValid(fp); err != nil {
		return nil, err
	}

	if err := fp.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save fee package")
	}

	return fp, nil
}

func (s *SqlFeePackageStore) Delete(id string) error {
	fp, err := lms_models.FindFeePackage(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("FeePackage", id)
		}
		return errors.Wrap(err, "failed to find fee package for deletion")
	}

	rows, err := fp.Delete(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete fee package")
	}

	if rows == 0 {
		return store.NewErrNotFound("FeePackage", id)
	}

	return nil
}
