package lmsstore

import (
	"database/sql"

	"github.com/aarondl/sqlboiler/v4/boil"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlAdditionalFeeStore struct {
	sqlStore store.Store
}

func NewSqlAdditionalFeeStore(s store.Store) store.AdditionalFeeStore {
	return &SqlAdditionalFeeStore{sqlStore: s}
}

func (s *SqlAdditionalFeeStore) Get(id string) (*lms_models.AdditionalFee, error) {
	fee, err := lms_models.FindAdditionalFee(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("AdditionalFee", id)
		}
		return nil, errors.Wrap(err, "failed to get additional fee")
	}

	return fee, nil
}

func (s *SqlAdditionalFeeStore) GetByTuition(tuitionID string) ([]*lms_models.AdditionalFee, error) {
	fees, err := lms_models.AdditionalFees(
		lms_models.AdditionalFeeWhere.TuitionID.EQ(tuitionID),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get additional fees by tuition")
	}

	return fees, nil
}

func (s *SqlAdditionalFeeStore) Save(fee *lms_models.AdditionalFee) (*lms_models.AdditionalFee, error) {
	modelhelper.AdditionalFeePreCreate(fee)
	if err := modelhelper.AdditionalFeeIsValid(fee); err != nil {
		return nil, err
	}

	if err := fee.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save additional fee")
	}

	return fee, nil
}

func (s *SqlAdditionalFeeStore) Delete(id string) error {
	fee, err := lms_models.FindAdditionalFee(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("AdditionalFee", id)
		}
		return errors.Wrap(err, "failed to find additional fee for deletion")
	}

	rows, err := fee.Delete(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete additional fee")
	}

	if rows == 0 {
		return store.NewErrNotFound("AdditionalFee", id)
	}

	return nil
}

func (s *SqlAdditionalFeeStore) DeleteByTuition(tuitionID string) error {
	_, err := lms_models.AdditionalFees(
		lms_models.AdditionalFeeWhere.TuitionID.EQ(tuitionID),
	).DeleteAll(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete additional fees by tuition")
	}

	return nil
}
