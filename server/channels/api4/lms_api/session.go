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
	"github.com/iamleson98/sitename/server/v8/channels/app/lms"
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

	// The body is a bare LMSSession plus two optional controls:
	//   repeat_until ("YYYY-MM-DD" or "") — weekly expansion end (inclusive)
	//   force (bool)                      — create despite teacher conflicts
	var body struct {
		*lms_models.LMSSession
		RepeatUntil string `json:"repeat_until"`
		Force       bool   `json:"force"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.Err = model.NewAppError("createSession", "api.lms.session.create_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}
	if body.LMSSession == nil {
		c.Err = model.NewAppError("createSession", "api.lms.session.create_body.app_error", nil, "missing session object", http.StatusBadRequest)
		return
	}

	created, conflicts, err := c.App.LMS().CreateSessionsWithRepeat(body.LMSSession, body.RepeatUntil, body.Force)
	if err != nil {
		c.Err = err
		return
	}
	if len(conflicts) > 0 {
		writeSessionConflictResponse(c, w, conflicts)
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(struct {
		Sessions []*lms_models.LMSSession `json:"sessions"`
		Count    int                      `json:"count"`
	}{Sessions: created, Count: len(created)}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// writeSessionConflictResponse answers 409 with the AppError shape the
// frontend already parses, extended with a `conflicts` array
// (date/time/class/teacher) the schedule dialog renders for review.
func writeSessionConflictResponse(c *api4.Context, w http.ResponseWriter, conflicts []*lms.SessionConflict) {
	appErr := model.NewAppError(
		"createSession",
		"app.lms.session.teacher_conflict.app_error",
		map[string]any{"Count": len(conflicts)},
		lms.SessionConflictSummary(conflicts),
		http.StatusConflict,
	)
	appErr.Translate(c.AppContext.T)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusConflict)
	if err := json.NewEncoder(w).Encode(struct {
		model.AppError
		Conflicts []*lms.SessionConflict `json:"conflicts"`
	}{AppError: *appErr, Conflicts: conflicts}); err != nil {
		c.Logger.Warn("Error while writing conflict response", mlog.Err(err))
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

	// LMSSession fields + optional force flag (proceed despite conflicts).
	var body struct {
		*lms_models.LMSSession
		Force bool `json:"force"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.Err = model.NewAppError("updateSession", "api.lms.session.update_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}
	if body.LMSSession == nil {
		c.Err = model.NewAppError("updateSession", "api.lms.session.update_body.app_error", nil, "missing session object", http.StatusBadRequest)
		return
	}

	updated, conflicts, err := c.App.LMS().UpdateSession(id, body.LMSSession, body.Force)
	if err != nil {
		c.Err = err
		return
	}
	if len(conflicts) > 0 {
		writeSessionConflictResponse(c, w, conflicts)
		return
	}

	if err := json.NewEncoder(w).Encode(struct {
		Sessions []*lms_models.LMSSession `json:"sessions"`
		Count    int                      `json:"count"`
	}{Sessions: []*lms_models.LMSSession{updated}, Count: 1}); err != nil {
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
