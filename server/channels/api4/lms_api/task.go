package lmsapi

import (
	"encoding/json"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (a *LMSAPI) InitTasks() {
	a.routes.Method(http.MethodPost, "/tasks", a.api.APISessionRequired(getTasks))
	a.routes.Method(http.MethodPost, "/tasks/create", a.api.APISessionRequired(createTask))
	a.routes.Method(http.MethodGet, "/tasks/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getTask))
	a.routes.Method(http.MethodPut, "/tasks/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateTask))
	a.routes.Method(http.MethodDelete, "/tasks/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteTask))
}

func getTasks(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTasks) {
		c.SetPermissionError(model.PermissionLmsManageTasks)
		return
	}

	var opts modelhelper.TaskFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getTasks", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	items, totalCount, err := c.App.LMS().GetTasks(opts)
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

func createTask(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTasks) {
		c.SetPermissionError(model.PermissionLmsManageTasks)
		return
	}

	var task *lms_models.Task
	if err := json.NewDecoder(r.Body).Decode(&task); err != nil {
		c.Err = model.NewAppError("createTask", "api.lms.create_task.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateTask(task)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(LMSResponse{Data: created})
	w.Write(data)
}

func getTask(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTasks) {
		c.SetPermissionError(model.PermissionLmsManageTasks)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	task, err := c.App.LMS().GetTask(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: task})
	w.Write(data)
}

func updateTask(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTasks) {
		c.SetPermissionError(model.PermissionLmsManageTasks)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	var task *lms_models.Task
	if err := json.NewDecoder(r.Body).Decode(&task); err != nil {
		c.Err = model.NewAppError("updateTask", "api.lms.update_task.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	updated, err := c.App.LMS().UpdateTask(id, task)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: updated})
	w.Write(data)
}

func deleteTask(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageTasks) {
		c.SetPermissionError(model.PermissionLmsManageTasks)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	if err := c.App.LMS().DeleteTask(id); err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(`{"data":true}`))
}
