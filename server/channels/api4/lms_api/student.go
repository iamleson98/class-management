package lmsapi

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/app/lms"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (a *LMSAPI) InitStudents() {
	a.routes.Method(http.MethodGet, "/students", a.api.APISessionRequired(getStudents))
	a.routes.Method(http.MethodPost, "/students", a.api.APISessionRequired(createStudent))
	a.routes.Method(http.MethodGet, "/students/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getStudent))
	a.routes.Method(http.MethodPut, "/students/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateStudent))
	a.routes.Method(http.MethodDelete, "/students/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteStudent))
}

func getStudents(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageStudents) {
		c.SetPermissionError(model.PermissionLmsManageStudents)
		return
	}

	q := r.URL.Query()
	opts := lms.StudentFilterOpts{
		ClassID: q.Get("class_id"),
		Status:  q.Get("status"),
		Search:  q.Get("search"),
	}

	students, err := c.App.LMS().GetStudents(opts)
	if err != nil {
		c.Err = err
		return
	}
	if students == nil {
		students = []*model.User{}
	}

	data, _ := json.Marshal(LMSResponse{Data: students})
	w.Write(data)
}

func createStudent(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageStudents) {
		c.SetPermissionError(model.PermissionLmsManageStudents)
		return
	}

	var body struct {
		User  *model.User    `json:"user"`
		Props map[string]any `json:"props"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.Err = model.NewAppError("createStudent", "api.lms.create_student.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateStudent(body.User, body.Props)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(LMSResponse{Data: created})
	w.Write(data)
}

func getStudent(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageStudents) {
		c.SetPermissionError(model.PermissionLmsManageStudents)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	student, err := c.App.LMS().GetStudent(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: student})
	w.Write(data)
}

func updateStudent(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageStudents) {
		c.SetPermissionError(model.PermissionLmsManageStudents)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	var body struct {
		User  *model.User    `json:"user"`
		Props map[string]any `json:"props"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.Err = model.NewAppError("updateStudent", "api.lms.update_student.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	body.User.Id = id

	updated, err := c.App.LMS().UpdateStudent(body.User, body.Props)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: updated})
	w.Write(data)
}

func deleteStudent(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageStudents) {
		c.SetPermissionError(model.PermissionLmsManageStudents)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	if err := c.App.LMS().DeleteStudent(id); err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(`{"data":true}`))
}
