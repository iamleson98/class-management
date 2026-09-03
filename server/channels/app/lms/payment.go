package lms

import (
	"errors"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/shopspring/decimal"
)

func (a *LMSApp) GetPayments(opts modelhelper.PaymentFilterOpts) ([]*lms_models.Payment, int64, *model.AppError) {
	payments, totalCount, err := a.store.Payment().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetPayments", "app.lms.payment.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return payments, totalCount, nil
}

func (a *LMSApp) GetTuitionPayments(tuitionID string) ([]*lms_models.Payment, *model.AppError) {
	payments, err := a.store.Payment().GetByTuition(tuitionID)
	if err != nil {
		return nil, model.NewAppError("GetTuitionPayments", "app.lms.payment.get_by_tuition.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return payments, nil
}

func (a *LMSApp) CreatePayment(payment *lms_models.Payment) (*lms_models.Payment, *model.AppError) {
	saved, err := a.store.Payment().Save(payment)
	if err != nil {
		return nil, model.NewAppError("CreatePayment", "app.lms.payment.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Update the tuition's paid_amount, remaining_amount, and status.
	if updateErr := a.updateTuitionAfterPayment(payment.TuitionID); updateErr != nil {
		return nil, updateErr
	}

	if m := a.app.Metrics(); m != nil {
		m.IncrementLMSPaymentCreated(payment.Method)
	}

	return saved, nil
}

// updateTuitionAfterPayment recalculates and persists the tuition's paid_amount,
// remaining_amount, and status after a payment is created.
func (a *LMSApp) updateTuitionAfterPayment(tuitionID string) *model.AppError {
	tuition, err := a.store.Tuition().Get(tuitionID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("updateTuitionAfterPayment", "app.lms.tuition.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("updateTuitionAfterPayment", "app.lms.tuition.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Sum all payments for this tuition.
	payments, err := a.store.Payment().GetByTuition(tuitionID)
	if err != nil {
		return model.NewAppError("updateTuitionAfterPayment", "app.lms.payment.get_by_tuition.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	totalPaid := decimal.Zero
	for _, p := range payments {
		totalPaid = totalPaid.Add(p.Amount)
	}

	tuition.PaidAmount = totalPaid
	tuition.RemainingAmount = tuition.TotalAmount.Sub(totalPaid)

	// Determine new status.
	if tuition.RemainingAmount.LessThanOrEqual(decimal.Zero) {
		tuition.Status = "PAID"
	} else if tuition.PaidAmount.GreaterThan(decimal.Zero) {
		tuition.Status = "PARTIAL"
	}

	if _, err := a.store.Tuition().Update(tuition); err != nil {
		return model.NewAppError("updateTuitionAfterPayment", "app.lms.tuition.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}
