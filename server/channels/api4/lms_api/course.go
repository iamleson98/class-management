package lmsapi

import (
	"encoding/json"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

// InitCourses registers course routes on the LMS router.
func (a *LMSAPI) InitCourses() {
	a.routes.Method(http.MethodGet, "/courses", a.api.APISessionRequired(getCourses))
	a.routes.Method(http.MethodPost, "/courses", a.api.APISessionRequired(createCourse))
	a.routes.Method(http.MethodGet, "/courses/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getCourse))
	a.routes.Method(http.MethodPut, "/courses/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateCourse))
	a.routes.Method(http.MethodDelete, "/courses/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteCourse))
}

func getCourses(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	courses, err := c.App.LMS().GetCourses()
	if err != nil {
		c.Err = err
		return
	}

	if courses == nil {
		courses = []*lms_models.Course{}
	}

	res := utils.ResponseList{
		Items:      courses,
		TotalCount: int64(len(courses)),
	}

	if err := json.NewEncoder(w).Encode(res); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createCourse(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageCourses) {
		c.SetPermissionError(model.PermissionLmsManageCourses)
		return
	}
	var course *lms_models.Course
	if err := json.NewDecoder(r.Body).Decode(&course); err != nil {
		c.Err = model.NewAppError("createCourse", "api.lms.course.create_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateCourse(course)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getCourse(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageCourses) {
		c.SetPermissionError(model.PermissionLmsManageCourses)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	course, err := c.App.LMS().GetCourse(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(course); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateCourse(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageCourses) {
		c.SetPermissionError(model.PermissionLmsManageCourses)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var course *lms_models.Course
	if err := json.NewDecoder(r.Body).Decode(&course); err != nil {
		c.Err = model.NewAppError("updateCourse", "api.lms.course.update_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	updated, err := c.App.LMS().UpdateCourse(id, course)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(updated); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteCourse(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageCourses) {
		c.SetPermissionError(model.PermissionLmsManageCourses)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if err := c.App.LMS().DeleteCourse(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}
