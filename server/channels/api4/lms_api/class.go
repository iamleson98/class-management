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

// InitClasses registers class routes on the LMS router.
func (a *LMSAPI) InitClasses() {
	a.routes.Method(http.MethodGet, "/classes", a.api.APISessionRequired(getClasses))
	a.routes.Method(http.MethodPost, "/classes", a.api.APISessionRequired(createClass))
	a.routes.Method(http.MethodGet, "/classes/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getClass))
	a.routes.Method(http.MethodPut, "/classes/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateClass))
	a.routes.Method(http.MethodDelete, "/classes/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteClass))
	a.routes.Method(http.MethodPost, "/classes/{id:[A-Za-z0-9]+}/enroll", a.api.APISessionRequired(enrollStudents))
}

func getClasses(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}
	q := r.URL.Query()
	opts := modelhelper.ClassFilterOpts{
		CourseID:  q.Get("course_id"),
		Status:    q.Get("status"),
		TeacherID: q.Get("teacher_id"),
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

	classes, err := c.App.LMS().GetClasses(opts)
	if err != nil {
		c.Err = err
		return
	}

	if classes == nil {
		classes = []*lms_models.Class{}
	}

	res := utils.ResponseList{
		Items:      classes,
		TotalCount: int64(len(classes)),
	}
	data, _ := json.Marshal(res)
	w.Write(data)
}

func createClass(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}
	var class *lms_models.Class
	if err := json.NewDecoder(r.Body).Decode(&class); err != nil {
		c.Err = model.NewAppError("createClass", "api.lms.class.create_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateClass(class)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(created)
	w.Write(data)
}

func getClass(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	class, err := c.App.LMS().GetClass(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(class)
	w.Write(data)
}

func updateClass(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	var class *lms_models.Class
	if err := json.NewDecoder(r.Body).Decode(&class); err != nil {
		c.Err = model.NewAppError("updateClass", "api.lms.class.update_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	updated, err := c.App.LMS().UpdateClass(id, class)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(updated)
	w.Write(data)
}

func deleteClass(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	if err := c.App.LMS().DeleteClass(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}

func enrollStudents(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClasses) {
		c.SetPermissionError(model.PermissionLmsManageClasses)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	var req struct {
		StudentIDs []string `json:"student_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.Err = model.NewAppError("enrollStudents", "api.lms.class.enroll_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := c.App.LMS().EnrollStudents(id, req.StudentIDs)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(result)
	w.Write(data)
}
