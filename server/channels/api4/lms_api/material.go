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

func (a *LMSAPI) InitMaterials() {
	a.routes.Method(http.MethodGet, "/materials", a.api.APISessionRequired(getMaterials))
	a.routes.Method(http.MethodPost, "/materials", a.api.APISessionRequired(createMaterial))
	a.routes.Method(http.MethodGet, "/materials/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getMaterial))
	a.routes.Method(http.MethodPut, "/materials/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateMaterial))
	a.routes.Method(http.MethodDelete, "/materials/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteMaterial))
}

func getMaterials(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageMaterials) {
		c.SetPermissionError(model.PermissionLmsManageMaterials)
		return
	}

	q := r.URL.Query()
	opts := modelhelper.MaterialFilterOpts{
		CourseID:   q.Get("course_id"),
		Visibility: q.Get("visibility"),
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

	materials, err := c.App.LMS().GetMaterials(opts)
	if err != nil {
		c.Err = err
		return
	}

	if materials == nil {
		materials = []*lms_models.Material{}
	}

	res := utils.ResponseList{Items: materials}
	data, _ := json.Marshal(res)
	w.Write(data)
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
	data, _ := json.Marshal(created)
	w.Write(data)
}

func getMaterial(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageMaterials) {
		c.SetPermissionError(model.PermissionLmsManageMaterials)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	material, err := c.App.LMS().GetMaterial(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(material)
	w.Write(data)
}

func updateMaterial(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageMaterials) {
		c.SetPermissionError(model.PermissionLmsManageMaterials)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

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

	data, _ := json.Marshal(updated)
	w.Write(data)
}

func deleteMaterial(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageMaterials) {
		c.SetPermissionError(model.PermissionLmsManageMaterials)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	if err := c.App.LMS().DeleteMaterial(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}
