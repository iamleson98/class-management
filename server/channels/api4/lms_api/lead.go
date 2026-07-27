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
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

// InitLeads registers lead routes on the LMS router.
func (a *LMSAPI) InitLeads() {
	a.routes.Method(http.MethodPost, "/leads", a.api.APISessionRequired(getLeads))
	a.routes.Method(http.MethodPost, "/leads/create", a.api.APISessionRequired(createLead))
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

	var opts modelhelper.LeadFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getLeads", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	items, totalCount, err := c.App.LMS().GetLeads(opts)
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
	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getLead(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	lead, err := c.App.LMS().GetLead(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(lead); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateLead(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

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

	if err := json.NewEncoder(w).Encode(updated); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteLead(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	if err := c.App.LMS().DeleteLead(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}

func getLeadActivities(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	activities, err := c.App.LMS().GetLeadActivities(id)
	if err != nil {
		c.Err = err
		return
	}

	if activities == nil {
		activities = []*lms_models.LeadActivity{}
	}

	if err := json.NewEncoder(w).Encode(activities); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createLeadActivity(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

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
	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func convertLead(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageLeads) {
		c.SetPermissionError(model.PermissionLmsManageLeads)
		return
	}

	user, lead, err := c.App.LMS().ConvertLeadToStudent(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(LMSResponse{Data: map[string]any{
		"user": user,
		"lead": lead,
	}}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
