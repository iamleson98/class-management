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
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

// InitTuitions registers tuition routes on the LMS router.
func (a *LMSAPI) InitTuitions() {
	a.routes.Method(http.MethodGet, "/tuitions", a.api.APISessionRequired(getTuitions))
	a.routes.Method(http.MethodPost, "/tuitions", a.api.APISessionRequired(createTuition))
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

	q := r.URL.Query()
	opts := modelhelper.TuitionFilterOpts{
		StudentID: q.Get("student_id"),
		ClassID:   q.Get("class_id"),
		Status:    q.Get("status"),
		Search:    q.Get("search"),
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

	tuitions, err := c.App.LMS().GetTuitions(opts)
	if err != nil {
		c.Err = err
		return
	}

	if tuitions == nil {
		tuitions = []*lms_models.Tuition{}
	}

	res := utils.ResponseList{Items: tuitions}
	data, _ := json.Marshal(res)
	w.Write(data)
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
