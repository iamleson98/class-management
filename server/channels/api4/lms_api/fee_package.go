package lmsapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
)

// InitFeePackages registers fee package routes on the LMS router.
func (a *LMSAPI) InitFeePackages() {
	a.routes.Method(http.MethodGet, "/fee-packages", a.api.APISessionRequired(getFeePackages))
	a.routes.Method(http.MethodPost, "/fee-packages", a.api.APISessionRequired(createFeePackage))
}

func getFeePackages(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageFeePackages) {
		c.SetPermissionError(model.PermissionLmsManageFeePackages)
		return
	}

	q := r.URL.Query()
	opts := modelhelper.FeePackageFilterOpts{
		CourseID: q.Get("course_id"),
	}
	if v := q.Get("page"); v != "" {
		opts.Page, _ = strconv.Atoi(v)
	}
	if v := q.Get("per_page"); v != "" {
		opts.PerPage, _ = strconv.Atoi(v)
	}
	if q.Get("count_total") == "true" {
		opts.CountTotal = true
	}

	feePackages, err := c.App.LMS().GetFeePackages(opts)
	if err != nil {
		c.Err = err
		return
	}

	if feePackages == nil {
		feePackages = []*lms_models.FeePackage{}
	}

	res := utils.ResponseList{
		Items:      feePackages,
		TotalCount: int64(len(feePackages)),
	}
	data, _ := json.Marshal(res)
	w.Write(data)
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
	data, _ := json.Marshal(created)
	w.Write(data)
}
