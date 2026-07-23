package lms

import (
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
)

func (a *LMSApp) GetFeeRefunds(tuitionID string) ([]*lms_models.FeeRefund, *model.AppError) {
	refunds, err := a.store.FeeRefund().GetByTuition(tuitionID)
	if err != nil {
		return nil, model.NewAppError("GetFeeRefunds", "app.lms.fee_refund.get_by_tuition.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return refunds, nil
}

func (a *LMSApp) CreateFeeRefund(refund *lms_models.FeeRefund) (*lms_models.FeeRefund, *model.AppError) {
	saved, err := a.store.FeeRefund().Save(refund)
	if err != nil {
		return nil, model.NewAppError("CreateFeeRefund", "app.lms.fee_refund.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}
