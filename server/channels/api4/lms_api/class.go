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

// InitClasses registers class routes on the LMS router.
func (a *LMSAPI) InitClasses() {
	a.routes.Method(http.MethodPost, "/classes", a.api.APISessionRequired(getClasses))
	a.routes.Method(http.MethodPost, "/classes/create", a.api.APISessionRequired(createClass))
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

	var opts modelhelper.ClassFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getClasses", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	items, totalCount, err := c.App.LMS().GetClasses(opts)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(utils.ResponseList{
		Items:      items,
		TotalCount: totalCount,
	}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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
