package lmsstore

import (
	"database/sql"
	"time"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
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

func (s *SqlPaymentStore) Search(opts modelhelper.PaymentFilterOpts) ([]*lms_models.Payment, int64, error) {
	mods := []qm.QueryMod{}

	for idx, opt := range opts.WhereAnds {
		if opt.Column == utils.PaymentPaymentDate {
			if opt.Value == nil {
				continue
			}
			if valStr, ok := opt.Value.(string); ok {
				timeVal, err := time.Parse(time.RFC3339, valStr)
				if err != nil {
					return nil, 0, errors.Wrap(err, "invalid payment date format")
				}
				opts.WhereAnds[idx].Value = timeVal.UnixMilli()
			}
		}
	}

	for idx, opt := range opts.WhereOrs {
		if opt.Column == utils.PaymentPaymentDate {
			if opt.Value == nil {
				continue
			}
			if valStr, ok := opt.Value.(string); ok {
				timeVal, err := time.Parse(time.RFC3339, valStr)
				if err != nil {
					return nil, 0, errors.Wrap(err, "invalid payment date format")
				}
				opts.WhereOrs[idx].Value = timeVal.UnixMilli()
			}
		}
	}

	modsWithPagination := append(mods, &opts.SearchOpts)
	payments, err := lms_models.Payments(modsWithPagination...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to search payments")
	}
	totalCount := int64(len(payments))

	if opts.CountTotal {
		modsWithoutPagination := append(mods, opts.SearchOpts.ExludePaginationForCount())
		totalCount, err = lms_models.Payments(modsWithoutPagination...).Count(s.sqlStore.GetReplicaExecuter())
		if err != nil {
			return nil, 0, errors.Wrap(err, "failed to count payments")
		}
	}

	return payments, totalCount, nil
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
