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

func (a *LMSAPI) InitClassMedia() {
	a.routes.Method(http.MethodGet, "/class-media", a.api.APISessionRequired(getClassMedia))
	a.routes.Method(http.MethodPost, "/class-media", a.api.APISessionRequired(createClassMedia))
	a.routes.Method(http.MethodDelete, "/class-media/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteClassMedia))
}

func getClassMedia(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClassMedia) {
		c.SetPermissionError(model.PermissionLmsManageClassMedia)
		return
	}

	q := r.URL.Query()
	opts := modelhelper.ClassMediaFilterOpts{
		ClassID:   q.Get("class_id"),
		SessionID: q.Get("session_id"),
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

	medium, err := c.App.LMS().GetClassMedia(opts)
	if err != nil {
		c.Err = err
		return
	}
	if medium == nil {
		medium = []*lms_models.ClassMedium{}
	}

	res := utils.ResponseList{Items: medium}
	data, _ := json.Marshal(res)
	w.Write(data)
}

func createClassMedia(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClassMedia) {
		c.SetPermissionError(model.PermissionLmsManageClassMedia)
		return
	}

	var classMedia *lms_models.ClassMedium
	if err := json.NewDecoder(r.Body).Decode(&classMedia); err != nil {
		c.Err = model.NewAppError("createClassMedia", "api.lms.create_class_media.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateClassMedia(classMedia)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(created)
	w.Write(data)
}

func deleteClassMedia(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClassMedia) {
		c.SetPermissionError(model.PermissionLmsManageClassMedia)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	if err := c.App.LMS().DeleteClassMedia(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}
