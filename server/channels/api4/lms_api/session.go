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

// InitSessions registers session routes on the LMS router.
func (a *LMSAPI) InitSessions() {
	a.routes.Method(http.MethodPost, "/sessions", a.api.APISessionRequired(getSessions))
	a.routes.Method(http.MethodPost, "/sessions/create", a.api.APISessionRequired(createSession))
	a.routes.Method(http.MethodGet, "/sessions/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getSession))
	a.routes.Method(http.MethodPut, "/sessions/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateSession))
	a.routes.Method(http.MethodDelete, "/sessions/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteSession))
	a.routes.Method(http.MethodGet, "/sessions/{id:[A-Za-z0-9]+}/attendance", a.api.APISessionRequired(getAttendance))
	a.routes.Method(http.MethodPost, "/sessions/{id:[A-Za-z0-9]+}/attendance", a.api.APISessionRequired(saveAttendance))
}

func getSessions(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageSessions) {
		c.SetPermissionError(model.PermissionLmsManageSessions)
		return
	}

	var opts modelhelper.SessionFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getSessions", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	items, totalCount, err := c.App.LMS().GetSessions(opts)
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

func createSession(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageSessions) {
		c.SetPermissionError(model.PermissionLmsManageSessions)
		return
	}
	var session *lms_models.LMSSession
	if err := json.NewDecoder(r.Body).Decode(&session); err != nil {
		c.Err = model.NewAppError("createSession", "api.lms.session.create_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateSession(session)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(LMSResponse{Data: created}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getSession(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageSessions) {
		c.SetPermissionError(model.PermissionLmsManageSessions)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	session, err := c.App.LMS().GetSession(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(LMSResponse{Data: session}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateSession(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageSessions) {
		c.SetPermissionError(model.PermissionLmsManageSessions)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var session *lms_models.LMSSession
	if err := json.NewDecoder(r.Body).Decode(&session); err != nil {
		c.Err = model.NewAppError("updateSession", "api.lms.session.update_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	updated, err := c.App.LMS().UpdateSession(id, session)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(LMSResponse{Data: updated}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteSession(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageSessions) {
		c.SetPermissionError(model.PermissionLmsManageSessions)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if err := c.App.LMS().DeleteSession(id); err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]bool{"data": true}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAttendance(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageAttendance) {
		c.SetPermissionError(model.PermissionLmsManageAttendance)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	attendance, err := c.App.LMS().GetAttendance(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(LMSResponse{Data: attendance}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func saveAttendance(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageAttendance) {
		c.SetPermissionError(model.PermissionLmsManageAttendance)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var records []*lms_models.Attendance
	if err := json.NewDecoder(r.Body).Decode(&records); err != nil {
		c.Err = model.NewAppError("saveAttendance", "api.lms.session.attendance_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.App.LMS().SaveAttendance(id, records)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(LMSResponse{Data: result}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
