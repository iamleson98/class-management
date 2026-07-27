package lmsapi

import (
	"encoding/json"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

// InitBanners registers banner routes on the LMS router.
func (a *LMSAPI) InitBanners() {
	a.routes.Method(http.MethodGet, "/banners", a.api.APISessionRequired(getBanners))
	a.routes.Method(http.MethodPost, "/banners", a.api.APISessionRequired(createBanner))
	a.routes.Method(http.MethodGet, "/banners/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getBanner))
	a.routes.Method(http.MethodPut, "/banners/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateBanner))
	a.routes.Method(http.MethodDelete, "/banners/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteBanner))
}

func getBanners(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageBanners) {
		c.SetPermissionError(model.PermissionLmsManageBanners)
		return
	}

	banners, err := c.App.LMS().GetBanners()
	if err != nil {
		c.Err = err
		return
	}

	res := utils.ResponseList{
		Items:      banners,
		TotalCount: int64(len(banners)),
	}

	if err := json.NewEncoder(w).Encode(res); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createBanner(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageBanners) {
		c.SetPermissionError(model.PermissionLmsManageBanners)
		return
	}

	var banner lms_models.Banner
	if err := json.NewDecoder(r.Body).Decode(&banner); err != nil {
		c.Err = model.NewAppError("createBanner", "api.lms.banner.create_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateBanner(&banner)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getBanner(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageBanners) {
		c.SetPermissionError(model.PermissionLmsManageBanners)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	banner, err := c.App.LMS().GetBanner(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(banner); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateBanner(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageBanners) {
		c.SetPermissionError(model.PermissionLmsManageBanners)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var banner *lms_models.Banner
	if err := json.NewDecoder(r.Body).Decode(&banner); err != nil {
		c.Err = model.NewAppError("updateBanner", "api.lms.banner.update_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	updated, err := c.App.LMS().UpdateBanner(id, banner)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(updated); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteBanner(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageBanners) {
		c.SetPermissionError(model.PermissionLmsManageBanners)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if err := c.App.LMS().DeleteBanner(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}
