package lms

import (
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

func (a *LMSApp) GetAdditionalFee(id string) (*lms_models.AdditionalFee, *model.AppError) {
	af, err := a.store.AdditionalFee().Get(id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("GetAdditionalFee", "app.lms.additional_fee.not_found", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("GetAdditionalFee", "app.lms.additional_fee.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return af, nil
}

func (a *LMSApp) GetTuitionAdditionalFees(tuitionID string) ([]*lms_models.AdditionalFee, *model.AppError) {
	fees, err := a.store.AdditionalFee().GetByTuition(tuitionID)
	if err != nil {
		return nil, model.NewAppError("GetTuitionAdditionalFees", "app.lms.additional_fee.get_by_tuition.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fees, nil
}

func (a *LMSApp) CreateAdditionalFee(af *lms_models.AdditionalFee) (*lms_models.AdditionalFee, *model.AppError) {
	saved, err := a.store.AdditionalFee().Save(af)
	if err != nil {
		return nil, model.NewAppError("CreateAdditionalFee", "app.lms.additional_fee.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) DeleteAdditionalFee(id string) *model.AppError {
	if err := a.store.AdditionalFee().Delete(id); err != nil {
		if store.IsErrNotFound(err) {
			return model.NewAppError("DeleteAdditionalFee", "app.lms.additional_fee.not_found", nil, "", http.StatusNotFound)
		}
		return model.NewAppError("DeleteAdditionalFee", "app.lms.additional_fee.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
