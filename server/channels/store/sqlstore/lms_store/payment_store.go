package lmsstore

import (
	"database/sql"
	"time"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlPaymentStore struct {
	sqlStore store.Store
}

func NewSqlPaymentStore(s store.Store) store.PaymentStore {
	return &SqlPaymentStore{sqlStore: s}
}

func (s *SqlPaymentStore) Get(id string) (*lms_models.Payment, error) {
	payment, err := lms_models.FindPayment(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Payment", id)
		}
		return nil, errors.Wrap(err, "failed to get payment")
	}

	return payment, nil
}

func (s *SqlPaymentStore) GetAll(opts modelhelper.PaymentFilterOpts) ([]*lms_models.Payment, error) {
	mods := []qm.QueryMod{}

	if opts.FromDate != "" {
		fromDate, err := time.Parse(time.RFC3339, opts.FromDate)
		if err != nil {
			fromDate, err = time.Parse("2006-01-02", opts.FromDate)
			if err != nil {
				return nil, errors.Wrap(err, "failed to parse FromDate")
			}
		}
		mods = append(mods, lms_models.PaymentWhere.PaymentDate.GTE(fromDate))
	}
	if opts.ToDate != "" {
		toDate, err := time.Parse(time.RFC3339, opts.ToDate)
		if err != nil {
			toDate, err = time.Parse("2006-01-02", opts.ToDate)
			if err != nil {
				return nil, errors.Wrap(err, "failed to parse ToDate")
			}
		}
		mods = append(mods, lms_models.PaymentWhere.PaymentDate.LTE(toDate))
	}

	mods = append(mods, qm.OrderBy(lms_models.PaymentColumns.PaymentDate+" DESC"))

	payments, err := lms_models.Payments(mods...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get payments")
	}

	return payments, nil
}

func (s *SqlPaymentStore) GetByTuition(tuitionID string) ([]*lms_models.Payment, error) {
	payments, err := lms_models.Payments(
		lms_models.PaymentWhere.TuitionID.EQ(tuitionID),
		qm.OrderBy(lms_models.PaymentColumns.PaymentDate+" DESC"),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get payments by tuition")
	}

	return payments, nil
}

func (s *SqlPaymentStore) Save(payment *lms_models.Payment) (*lms_models.Payment, error) {
	modelhelper.PaymentPreCreate(payment)
	if err := modelhelper.PaymentIsValid(payment); err != nil {
		return nil, err
	}

	if err := payment.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save payment")
	}

	return payment, nil
}

func (s *SqlPaymentStore) Count(opts modelhelper.PaymentFilterOpts) (int64, error) {
	var mods []qm.QueryMod

	if opts.FromDate != "" {
		fromDate, err := time.Parse(time.RFC3339, opts.FromDate)
		if err != nil {
			fromDate, err = time.Parse("2006-01-02", opts.FromDate)
			if err != nil {
				return 0, errors.Wrap(err, "failed to parse FromDate")
			}
		}
		mods = append(mods, lms_models.PaymentWhere.PaymentDate.GTE(fromDate))
	}
	if opts.ToDate != "" {
		toDate, err := time.Parse(time.RFC3339, opts.ToDate)
		if err != nil {
			toDate, err = time.Parse("2006-01-02", opts.ToDate)
			if err != nil {
				return 0, errors.Wrap(err, "failed to parse ToDate")
			}
		}
		mods = append(mods, lms_models.PaymentWhere.PaymentDate.LTE(toDate))
	}

	count, err := lms_models.Payments(mods...).Count(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return 0, errors.Wrap(err, "failed to count payments")
	}
	return count, nil
}
