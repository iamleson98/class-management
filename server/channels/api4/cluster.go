package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

func (api *API) InitCluster() {
	api.BaseRoutes.Cluster.Method(http.MethodGet, "/status", api.APISessionRequired(getClusterStatus))
}

func getClusterStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionToAndNotRestrictedAdmin(*c.AppContext.Session(), model.PermissionSysconsoleReadEnvironmentHighAvailability) {
		c.SetPermissionError(model.PermissionSysconsoleReadEnvironmentHighAvailability)
		return
	}

	infos, err := c.App.GetClusterStatus(c.AppContext)
	if err != nil {
		c.Err = model.NewAppError("getClusterStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	js, err := json.Marshal(infos)
	if err != nil {
		c.Err = model.NewAppError("getClusterStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
