package lmsapi

import (
	"encoding/json"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
)

// InitFeePackages registers fee package routes on the LMS router.
func (a *LMSAPI) InitFeePackages() {
	a.routes.Method(http.MethodPost, "/fee-packages", a.api.APISessionRequired(getFeePackages))
	a.routes.Method(http.MethodPost, "/fee-packages/create", a.api.APISessionRequired(createFeePackage))
}

func getFeePackages(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageFeePackages) {
		c.SetPermissionError(model.PermissionLmsManageFeePackages)
		return
	}

	var opts modelhelper.FeePackageFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getFeePackages", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	items, totalCount, err := c.App.LMS().GetFeePackages(opts)
	if err != nil {
		c.Err = err
		return
	}

	res := utils.ResponseList{
		Items:      items,
		TotalCount: totalCount,
	}

	if err := json.NewEncoder(w).Encode(res); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createFeePackage(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageFeePackages) {
		c.SetPermissionError(model.PermissionLmsManageFeePackages)
		return
	}

	var feePackage *lms_models.FeePackage
	if err := json.NewDecoder(r.Body).Decode(&feePackage); err != nil {
		c.Err = model.NewAppError("createFeePackage", "api.lms.fee_package.create_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateFeePackage(feePackage)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
