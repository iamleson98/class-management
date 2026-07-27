package lmsapi

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
)

func (a *LMSAPI) InitReports() {
	a.routes.Method(http.MethodGet, "/reports", a.api.APISessionRequired(getReport))
}

func getReport(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsViewReports) {
		c.SetPermissionError(model.PermissionLmsViewReports)
		return
	}

	reportType := r.URL.Query().Get("type")

	data, err := c.App.LMS().GetReport(reportType)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(data); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
