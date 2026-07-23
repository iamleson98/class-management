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

// InitSessions registers session routes on the LMS router.
func (a *LMSAPI) InitSessions() {
	a.routes.Method(http.MethodGet, "/sessions", a.api.APISessionRequired(getSessions))
	a.routes.Method(http.MethodPost, "/sessions", a.api.APISessionRequired(createSession))
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
	q := r.URL.Query()
	opts := modelhelper.SessionFilterOpts{
		ClassID:   q.Get("class_id"),
		TeacherID: q.Get("teacher_id"),
		StudentID: q.Get("student_id"),
		Month:     q.Get("month"),
		Date:      q.Get("date"),
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

	sessions, err := c.App.LMS().GetSessions(opts)
	if err != nil {
		c.Err = err
		return
	}

	if sessions == nil {
		sessions = []*lms_models.LMSSession{}
	}

	res := utils.ResponseList{Items: sessions}
	data, _ := json.Marshal(res)
	w.Write(data)
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
	data, _ := json.Marshal(LMSResponse{Data: created})
	w.Write(data)
}

func getSession(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageSessions) {
		c.SetPermissionError(model.PermissionLmsManageSessions)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	session, err := c.App.LMS().GetSession(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: session})
	w.Write(data)
}

func updateSession(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageSessions) {
		c.SetPermissionError(model.PermissionLmsManageSessions)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

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

	data, _ := json.Marshal(LMSResponse{Data: updated})
	w.Write(data)
}

func deleteSession(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageSessions) {
		c.SetPermissionError(model.PermissionLmsManageSessions)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	if err := c.App.LMS().DeleteSession(id); err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(`{"data":true}`))
}

func getAttendance(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageAttendance) {
		c.SetPermissionError(model.PermissionLmsManageAttendance)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	attendance, err := c.App.LMS().GetAttendance(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: attendance})
	w.Write(data)
}

func saveAttendance(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageAttendance) {
		c.SetPermissionError(model.PermissionLmsManageAttendance)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

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

	data, _ := json.Marshal(LMSResponse{Data: result})
	w.Write(data)
}
