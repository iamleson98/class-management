package lmsapi

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (a *LMSAPI) InitStudents() {
	a.routes.Method(http.MethodPost, "/students", a.api.APISessionRequired(getStudents))
	a.routes.Method(http.MethodPost, "/students/create", a.api.APISessionRequired(createStudent))
	a.routes.Method(http.MethodGet, "/students/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getStudent))
	a.routes.Method(http.MethodPut, "/students/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateStudent))
	a.routes.Method(http.MethodDelete, "/students/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteStudent))

	// Counselor user <-> student conversions (gated by PermissionLmsManageStudents).
	a.routes.Method(http.MethodGet, "/students/convertible-users", a.api.APISessionRequired(getConvertibleUsers))
	a.routes.Method(http.MethodPost, "/users/{id:[A-Za-z0-9]+}/convert-to-student", a.api.APISessionRequired(convertUserToStudent))
	a.routes.Method(http.MethodPost, "/students/{id:[A-Za-z0-9]+}/revert-to-user", a.api.APISessionRequired(revertStudentToUser))
}

func getStudents(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageStudents) {
		c.SetPermissionError(model.PermissionLmsManageStudents)
		return
	}

	var opts modelhelper.StudentFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getStudents", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	students, totalCount, err := c.App.LMS().GetStudents(opts)
	if err != nil {
		c.Err = err
		return
	}

	res := utils.ResponseList{
		Items:      students,
		TotalCount: totalCount,
	}

	if err := json.NewEncoder(w).Encode(res); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

// getConvertibleUsers lists non-student, non-deactivated users that a counselor
// can convert into students.
func getConvertibleUsers(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageStudents) {
		c.SetPermissionError(model.PermissionLmsManageStudents)
		return
	}

	users, err := c.App.LMS().GetConvertibleUsers()
	if err != nil {
		c.Err = err
		return
	}

	if users == nil {
		users = []*model.User{}
	}

	data, _ := json.Marshal(LMSResponse{Data: users})
	w.Write(data)
}

// convertUserToStudent promotes an existing user to a student.
func convertUserToStudent(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageStudents) {
		c.SetPermissionError(model.PermissionLmsManageStudents)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	updated, err := c.App.LMS().ConvertUserToStudent(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: updated})
	w.Write(data)
}

// revertStudentToUser demotes a student back to a regular user.
func revertStudentToUser(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageStudents) {
		c.SetPermissionError(model.PermissionLmsManageStudents)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	updated, err := c.App.LMS().RevertStudentToUser(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: updated})
	w.Write(data)
}
