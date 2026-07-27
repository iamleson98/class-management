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

func (a *LMSAPI) InitClassMedia() {
	a.routes.Method(http.MethodPost, "/class-media", a.api.APISessionRequired(createClassMedia))
	a.routes.Method(http.MethodPost, "/class-media/search", a.api.APISessionRequired(getClassMedia))
	a.routes.Method(http.MethodDelete, "/class-media/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteClassMedia))
}

func getClassMedia(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClassMedia) {
		c.SetPermissionError(model.PermissionLmsManageClassMedia)
		return
	}

	var opts modelhelper.ClassMediaFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getClassMedia", "api.lms.get_class_media.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	media, totalCount, err := c.App.LMS().GetClassMedia(opts)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(utils.ResponseList{
		Items:      media,
		TotalCount: totalCount,
	}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteClassMedia(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageClassMedia) {
		c.SetPermissionError(model.PermissionLmsManageClassMedia)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if err := c.App.LMS().DeleteClassMedia(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}
