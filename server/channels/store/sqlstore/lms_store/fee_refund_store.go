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

type SqlFeeRefundStore struct {
	sqlStore store.Store
}

func NewSqlFeeRefundStore(s store.Store) store.FeeRefundStore {
	return &SqlFeeRefundStore{sqlStore: s}
}

func (s *SqlFeeRefundStore) Get(id string) (*lms_models.FeeRefund, error) {
	refund, err := lms_models.FindFeeRefund(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("FeeRefund", id)
		}
		return nil, errors.Wrap(err, "failed to get fee refund")
	}

	return refund, nil
}

func (s *SqlFeeRefundStore) GetByTuition(tuitionID string) ([]*lms_models.FeeRefund, error) {
	refunds, err := lms_models.FeeRefunds(
		lms_models.FeeRefundWhere.TuitionID.EQ(tuitionID),
		qm.OrderBy(lms_models.FeeRefundColumns.RefundDate+" DESC"),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get fee refunds by tuition")
	}

	return refunds, nil
}

func (s *SqlFeeRefundStore) Save(refund *lms_models.FeeRefund) (*lms_models.FeeRefund, error) {
	modelhelper.FeeRefundPreCreate(refund)
	if err := modelhelper.FeeRefundIsValid(refund); err != nil {
		return nil, err
	}

	if err := refund.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save fee refund")
	}

	return refund, nil
}

func (s *SqlFeeRefundStore) Delete(id string) error {
	refund, err := lms_models.FindFeeRefund(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("FeeRefund", id)
		}
		return errors.Wrap(err, "failed to find fee refund for deletion")
	}

	rows, err := refund.Delete(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete fee refund")
	}

	if rows == 0 {
		return store.NewErrNotFound("FeeRefund", id)
	}

	return nil
}
