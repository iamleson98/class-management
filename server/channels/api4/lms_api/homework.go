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

func (a *LMSAPI) InitHomework() {
	a.routes.Method(http.MethodPost, "/homeworks", a.api.APISessionRequired(getHomeworks))
	a.routes.Method(http.MethodPost, "/homeworks/create", a.api.APISessionRequired(createHomework))
	a.routes.Method(http.MethodGet, "/homeworks/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getHomework))
	a.routes.Method(http.MethodPut, "/homeworks/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateHomework))
	a.routes.Method(http.MethodDelete, "/homeworks/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteHomework))
	a.routes.Method(http.MethodGet, "/homeworks/{id:[A-Za-z0-9]+}/submissions", a.api.APISessionRequired(getHomeworkSubmissions))
	a.routes.Method(http.MethodPost, "/homeworks/{id:[A-Za-z0-9]+}/submissions", a.api.APISessionRequired(upsertHomeworkSubmission))
	a.routes.Method(http.MethodPost, "/homeworks/bulk-assign", a.api.APISessionRequired(bulkAssignHomework))
}

func getHomeworks(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageHomework) {
		c.SetPermissionError(model.PermissionLmsManageHomework)
		return
	}

	var opts modelhelper.HomeworkFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getHomeworks", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	items, totalCount, err := c.App.LMS().GetHomework(opts)
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

func createHomework(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageHomework) {
		c.SetPermissionError(model.PermissionLmsManageHomework)
		return
	}

	var homework *lms_models.Homework
	if err := json.NewDecoder(r.Body).Decode(&homework); err != nil {
		c.Err = model.NewAppError("createHomework", "api.lms.create_homework.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateHomework(homework)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getHomework(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageHomework) {
		c.SetPermissionError(model.PermissionLmsManageHomework)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	homework, err := c.App.LMS().GetHomeworkByID(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(homework); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateHomework(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageHomework) {
		c.SetPermissionError(model.PermissionLmsManageHomework)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var homework *lms_models.Homework
	if err := json.NewDecoder(r.Body).Decode(&homework); err != nil {
		c.Err = model.NewAppError("updateHomework", "api.lms.update_homework.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	updated, err := c.App.LMS().UpdateHomework(id, homework)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(updated); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteHomework(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageHomework) {
		c.SetPermissionError(model.PermissionLmsManageHomework)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if err := c.App.LMS().DeleteHomework(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}

func getHomeworkSubmissions(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageHomework) {
		c.SetPermissionError(model.PermissionLmsManageHomework)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	submissions, err := c.App.LMS().GetHomeworkSubmissions(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(submissions); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func upsertHomeworkSubmission(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageHomework) {
		c.SetPermissionError(model.PermissionLmsManageHomework)
		return
	}
	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var submission *lms_models.Submission
	if err := json.NewDecoder(r.Body).Decode(&submission); err != nil {
		c.Err = model.NewAppError("upsertHomeworkSubmission", "api.lms.upsert_homework_submission.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().UpsertHomeworkSubmission(id, submission.StudentID, submission)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func bulkAssignHomework(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageHomework) {
		c.SetPermissionError(model.PermissionLmsManageHomework)
		return
	}

	var payload struct {
		Homework   *lms_models.Homework `json:"homework"`
		StudentIDs []string             `json:"student_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		c.Err = model.NewAppError("bulkAssignHomework", "api.lms.bulk_assign_homework.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	count, err := c.App.LMS().BulkAssignHomework(payload.Homework, payload.StudentIDs)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]any{"count": count}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
