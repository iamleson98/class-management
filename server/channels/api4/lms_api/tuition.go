package lmsapi

import (
	"encoding/json"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

// InitTuitions registers tuition routes on the LMS router.
func (a *LMSAPI) InitTuitions() {
	a.routes.Method(http.MethodPost, "/tuitions", a.api.APISessionRequired(getTuitions))
	a.routes.Method(http.MethodPost, "/tuitions/create", a.api.APISessionRequired(createTuition))
	a.routes.Method(http.MethodGet, "/tuitions/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getTuition))
	a.routes.Method(http.MethodPut, "/tuitions/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateTuition))
	a.routes.Method(http.MethodDelete, "/tuitions/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteTuition))
	a.routes.Method(http.MethodGet, "/tuitions/{id:[A-Za-z0-9]+}/payments", a.api.APISessionRequired(getTuitionPayments))
	a.routes.Method(http.MethodPost, "/tuitions/{id:[A-Za-z0-9]+}/payments", a.api.APISessionRequired(createTuitionPayment))
}

func getTuitions(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTuition) {
		c.SetPermissionError(model.PermissionLmsManageTuition)
		return
	}

	var opts modelhelper.TuitionFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getTuitions", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	items, totalCount, err := c.App.LMS().GetTuitions(opts)
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

func createTuition(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTuition) {
		c.SetPermissionError(model.PermissionLmsManageTuition)
		return
	}

	var tuition *lms_models.Tuition
	if err := json.NewDecoder(r.Body).Decode(&tuition); err != nil {
		c.Err = model.NewAppError("createTuition", "api.lms.tuition.create_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateTuition(tuition)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(created)
	w.Write(data)
}

func getTuition(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTuition) {
		c.SetPermissionError(model.PermissionLmsManageTuition)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	tuition, err := c.App.LMS().GetTuition(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(tuition)
	w.Write(data)
}

func updateTuition(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTuition) {
		c.SetPermissionError(model.PermissionLmsManageTuition)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	var tuition *lms_models.Tuition
	if err := json.NewDecoder(r.Body).Decode(&tuition); err != nil {
		c.Err = model.NewAppError("updateTuition", "api.lms.tuition.update_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	updated, err := c.App.LMS().UpdateTuition(id, tuition)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(updated)
	w.Write(data)
}

func deleteTuition(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTuition) {
		c.SetPermissionError(model.PermissionLmsManageTuition)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	if err := c.App.LMS().DeleteTuition(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}

func getTuitionPayments(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTuition) {
		c.SetPermissionError(model.PermissionLmsManageTuition)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	payments, err := c.App.LMS().GetTuitionPayments(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(payments)
	w.Write(data)
}

func createTuitionPayment(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTuition) {
		c.SetPermissionError(model.PermissionLmsManageTuition)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	var payment *lms_models.Payment
	if err := json.NewDecoder(r.Body).Decode(&payment); err != nil {
		c.Err = model.NewAppError("createTuitionPayment", "api.lms.tuition.payment_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	payment.TuitionID = id

	created, err := c.App.LMS().CreatePayment(payment)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(created)
	w.Write(data)
}
