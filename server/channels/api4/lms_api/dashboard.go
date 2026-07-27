package lmsapi

import (
	"encoding/json"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
)

func (a *LMSAPI) InitDashboard() {
	a.routes.Method(http.MethodGet, "/dashboard", a.api.APISessionRequired(getDashboard))
}

func getDashboard(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageDashboard) {
		c.SetPermissionError(model.PermissionLmsManageDashboard)
		return
	}

	stats, err := c.App.LMS().GetDashboardStats()
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(stats); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
