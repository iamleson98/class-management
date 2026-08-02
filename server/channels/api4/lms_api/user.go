package lmsapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (a *LMSAPI) InitUsers() {
	a.routes.Method(http.MethodPost, "/users", a.api.APISessionRequired(createUser))
	a.routes.Method(http.MethodGet, "/users/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getUser))
	a.routes.Method(http.MethodPut, "/users/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateUser))
	a.routes.Method(http.MethodDelete, "/users/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteUser))
	a.routes.Method(http.MethodPost, "/users/{id:[A-Za-z0-9]+}/deactivate", a.api.APISessionRequired(deactivateUser))
	a.routes.Method(http.MethodPost, "/users/{id:[A-Za-z0-9]+}/reactivate", a.api.APISessionRequired(reactivateUser))
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

	user.EmailVerified = true
	if user.Username == "" {
		user.Username, _, _ = strings.Cut(user.Email, "@")
	}

	created, err := c.App.CreateUser(c.AppContext, user)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUser(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageUsers) {
		c.SetPermissionError(model.PermissionLmsManageUsers)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	user, err := c.App.GetUser(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateUser(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageUsers) {
		c.SetPermissionError(model.PermissionLmsManageUsers)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var user *model.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		c.Err = model.NewAppError("updateUser", "api.lms.update_user.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	user.Id = id

	// A user (including the super admin) must not reassign their own role.
	// Changing one's own role could lock the user out of the system or strip
	// the only super admin. Non-role edits (name, phone, ...) remain allowed.
	if user.Roles != "" && id == c.AppContext.Session().UserId {
		c.Err = model.NewAppError("updateUser", "api.lms.update_user.self_role.app_error", nil, "", http.StatusForbidden)
		return
	}

	updated, err := c.App.LMS().UpdateUser(user)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(LMSResponse{Data: updated}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteUser(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageUsers) {
		c.SetPermissionError(model.PermissionLmsManageUsers)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if err := c.App.LMS().DeleteUser(id); err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]bool{"data": true}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deactivateUser(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageUsers) {
		c.SetPermissionError(model.PermissionLmsManageUsers)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	updated, err := c.App.LMS().DeactivateUser(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(LMSResponse{Data: updated}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func reactivateUser(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageUsers) {
		c.SetPermissionError(model.PermissionLmsManageUsers)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	updated, err := c.App.LMS().ReactivateUser(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(LMSResponse{Data: updated}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
