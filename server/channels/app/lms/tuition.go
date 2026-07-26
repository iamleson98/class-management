package lms

import (
	"errors"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

// TuitionWithDetails wraps a Tuition with its payments, refunds, and additional fees.
type TuitionWithDetails struct {
	Tuition        *lms_models.Tuition        `json:"tuition"`
	Payments       []*lms_models.Payment      `json:"payments"`
	Refunds        []*lms_models.FeeRefund    `json:"refunds"`
	AdditionalFees []*lms_models.AdditionalFee `json:"additional_fees"`
}

func (a *LMSApp) GetTuition(id string) (*lms_models.Tuition, *model.AppError) {
	tuition, err := a.store.Tuition().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetTuition", "app.lms.tuition.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetTuition", "app.lms.tuition.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return tuition, nil
}

// GetTuitionWithDetails returns a tuition along with its payments, refunds, and additional fees.
func (a *LMSApp) GetTuitionWithDetails(id string) (*TuitionWithDetails, *model.AppError) {
	tuition, appErr := a.GetTuition(id)
	if appErr != nil {
		return nil, appErr
	}

	payments, err := a.store.Payment().GetByTuition(id)
	if err != nil {
		return nil, model.NewAppError("GetTuitionWithDetails", "app.lms.tuition.get_payments.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	refunds, err := a.store.FeeRefund().GetByTuition(id)
	if err != nil {
		return nil, model.NewAppError("GetTuitionWithDetails", "app.lms.tuition.get_refunds.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	additionalFees, err := a.store.AdditionalFee().GetByTuition(id)
	if err != nil {
		return nil, model.NewAppError("GetTuitionWithDetails", "app.lms.tuition.get_additional_fees.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &TuitionWithDetails{
		Tuition:        tuition,
		Payments:       payments,
		Refunds:        refunds,
		AdditionalFees: additionalFees,
	}, nil
}

func (a *LMSApp) GetTuitions(opts modelhelper.TuitionFilterOpts) ([]*lms_models.Tuition, int64, *model.AppError) {
	tuitions, totalCount, err := a.store.Tuition().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetTuitions", "app.lms.tuition.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return tuitions, totalCount, nil
}

func (a *LMSApp) CreateTuition(tuition *lms_models.Tuition) (*lms_models.Tuition, *model.AppError) {
	saved, err := a.store.Tuition().Save(tuition)
	if err != nil {
		return nil, model.NewAppError("CreateTuition", "app.lms.tuition.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) UpdateTuition(id string, tuition *lms_models.Tuition) (*lms_models.Tuition, *model.AppError) {
	tuition.ID = id
	updated, err := a.store.Tuition().Update(tuition)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateTuition", "app.lms.tuition.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateTuition", "app.lms.tuition.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return updated, nil
}

func (a *LMSApp) DeleteTuition(id string) *model.AppError {
	err := a.store.Tuition().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteTuition", "app.lms.tuition.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteTuition", "app.lms.tuition.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return nil
}
