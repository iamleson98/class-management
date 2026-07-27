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

func (a *LMSAPI) InitMaterials() {
	a.routes.Method(http.MethodPost, "/materials", a.api.APISessionRequired(getMaterials))
	a.routes.Method(http.MethodPost, "/materials/create", a.api.APISessionRequired(createMaterial))
	a.routes.Method(http.MethodGet, "/materials/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getMaterial))
	a.routes.Method(http.MethodPut, "/materials/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateMaterial))
	a.routes.Method(http.MethodDelete, "/materials/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteMaterial))
}

func getMaterials(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageMaterials) {
		c.SetPermissionError(model.PermissionLmsManageMaterials)
		return
	}

	var opts modelhelper.MaterialFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getMaterials", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	items, totalCount, err := c.App.LMS().GetMaterials(opts)
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

func createMaterial(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageMaterials) {
		c.SetPermissionError(model.PermissionLmsManageMaterials)
		return
	}

	var material *lms_models.Material
	if err := json.NewDecoder(r.Body).Decode(&material); err != nil {
		c.Err = model.NewAppError("createMaterial", "api.lms.create_material.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateMaterial(material)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getMaterial(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageMaterials) {
		c.SetPermissionError(model.PermissionLmsManageMaterials)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	material, err := c.App.LMS().GetMaterial(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(material); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateMaterial(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageMaterials) {
		c.SetPermissionError(model.PermissionLmsManageMaterials)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var material *lms_models.Material
	if err := json.NewDecoder(r.Body).Decode(&material); err != nil {
		c.Err = model.NewAppError("updateMaterial", "api.lms.update_material.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	updated, err := c.App.LMS().UpdateMaterial(id, material)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(updated); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteMaterial(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageMaterials) {
		c.SetPermissionError(model.PermissionLmsManageMaterials)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if err := c.App.LMS().DeleteMaterial(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}
