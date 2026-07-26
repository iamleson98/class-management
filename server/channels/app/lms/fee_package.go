package lms

import (
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

func (a *LMSApp) GetFeePackages(opts modelhelper.FeePackageFilterOpts) ([]*lms_models.FeePackage, int64, *model.AppError) {
	packages, totalCount, err := a.store.FeePackage().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetFeePackages", "app.lms.fee_package.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return packages, totalCount, nil
}

func (a *LMSApp) CreateFeePackage(fp *lms_models.FeePackage) (*lms_models.FeePackage, *model.AppError) {
	saved, err := a.store.FeePackage().Save(fp)
	if err != nil {
		return nil, model.NewAppError("CreateFeePackage", "app.lms.fee_package.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) DeleteFeePackage(id string) *model.AppError {
	if err := a.store.FeePackage().Delete(id); err != nil {
		if store.IsErrNotFound(err) {
			return model.NewAppError("DeleteFeePackage", "app.lms.fee_package.not_found", nil, "", http.StatusNotFound)
		}
		return model.NewAppError("DeleteFeePackage", "app.lms.fee_package.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
