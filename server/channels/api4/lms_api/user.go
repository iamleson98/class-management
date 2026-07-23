package lmsapi

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/app/lms"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (a *LMSAPI) InitUsers() {
	a.routes.Method(http.MethodGet, "/users", a.api.APISessionRequired(getUsers))
	a.routes.Method(http.MethodPost, "/users", a.api.APISessionRequired(createUser))
	a.routes.Method(http.MethodGet, "/users/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getUser))
	a.routes.Method(http.MethodPut, "/users/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateUser))
	a.routes.Method(http.MethodDelete, "/users/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteUser))
}

func getUsers(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageUsers) {
		c.SetPermissionError(model.PermissionLmsManageUsers)
		return
	}

	q := r.URL.Query()
	opts := lms.UserFilterOpts{
		Role: q.Get("role"),
	}

	users, err := c.App.LMS().GetUsers(opts)
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

func createUser(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageUsers) {
		c.SetPermissionError(model.PermissionLmsManageUsers)
		return
	}

	var user *model.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		c.Err = model.NewAppError("createUser", "api.lms.create_user.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateUser(user)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(LMSResponse{Data: created})
	w.Write(data)
}

func getUser(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageUsers) {
		c.SetPermissionError(model.PermissionLmsManageUsers)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	user, err := c.App.LMS().GetUser(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: user})
	w.Write(data)
}

func updateUser(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageUsers) {
		c.SetPermissionError(model.PermissionLmsManageUsers)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	var user *model.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		c.Err = model.NewAppError("updateUser", "api.lms.update_user.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	user.Id = id

	updated, err := c.App.LMS().UpdateUser(user)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: updated})
	w.Write(data)
}

func deleteUser(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageUsers) {
		c.SetPermissionError(model.PermissionLmsManageUsers)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	if err := c.App.LMS().DeleteUser(id); err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(`{"data":true}`))
}
