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

// InitLeads registers lead routes on the LMS router.
func (a *LMSAPI) InitLeads() {
	a.routes.Method(http.MethodGet, "/leads", a.api.APISessionRequired(getLeads))
	a.routes.Method(http.MethodPost, "/leads", a.api.APISessionRequired(createLead))
	a.routes.Method(http.MethodGet, "/leads/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getLead))
	a.routes.Method(http.MethodPut, "/leads/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateLead))
	a.routes.Method(http.MethodDelete, "/leads/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteLead))
	a.routes.Method(http.MethodGet, "/leads/{id:[A-Za-z0-9]+}/activities", a.api.APISessionRequired(getLeadActivities))
	a.routes.Method(http.MethodPost, "/leads/{id:[A-Za-z0-9]+}/activities", a.api.APISessionRequired(createLeadActivity))
	a.routes.Method(http.MethodPost, "/leads/{id:[A-Za-z0-9]+}/convert", a.api.APISessionRequired(convertLead))
}

func getLeads(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	q := r.URL.Query()
	opts := modelhelper.LeadFilterOpts{
		Status:      q.Get("status"),
		Source:      q.Get("source"),
		CounselorID: q.Get("counselor_id"),
		Search:      q.Get("search"),
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

	leads, err := c.App.LMS().GetLeads(opts)
	if err != nil {
		c.Err = err
		return
	}

	if leads == nil {
		leads = []*lms_models.Lead{}
	}

	res := utils.ResponseList{
		Items:      leads,
		TotalCount: int64(len(leads)),
	}
	data, _ := json.Marshal(res)
	w.Write(data)
}

func createLead(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	var lead *lms_models.Lead
	if err := json.NewDecoder(r.Body).Decode(&lead); err != nil {
		c.Err = model.NewAppError("createLead", "api.lms.lead.create_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateLead(lead)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(created)
	w.Write(data)
}

func getLead(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	lead, err := c.App.LMS().GetLead(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(lead)
	w.Write(data)
}

func updateLead(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	var lead *lms_models.Lead
	if err := json.NewDecoder(r.Body).Decode(&lead); err != nil {
		c.Err = model.NewAppError("updateLead", "api.lms.lead.update_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	updated, err := c.App.LMS().UpdateLead(id, lead)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(updated)
	w.Write(data)
}

func deleteLead(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	if err := c.App.LMS().DeleteLead(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}

func getLeadActivities(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	activities, err := c.App.LMS().GetLeadActivities(id)
	if err != nil {
		c.Err = err
		return
	}

	if activities == nil {
		activities = []*lms_models.LeadActivity{}
	}

	data, _ := json.Marshal(activities)
	w.Write(data)
}

func createLeadActivity(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	var activity *lms_models.LeadActivity
	if err := json.NewDecoder(r.Body).Decode(&activity); err != nil {
		c.Err = model.NewAppError("createLeadActivity", "api.lms.lead.activity_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateLeadActivity(id, activity)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(created)
	w.Write(data)
}

func convertLead(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	user, lead, err := c.App.LMS().ConvertLeadToStudent(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: map[string]any{
		"user": user,
		"lead": lead,
	}})
	w.Write(data)
}
