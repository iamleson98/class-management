package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

func (api *API) InitLimits() {
	api.BaseRoutes.Limits.Method(http.MethodGet, "/server", api.APISessionRequired(getServerLimits)) //.Path("/server").Handler(api.APISessionRequired(getServerLimits))
}

func getServerLimits(c *Context, w http.ResponseWriter, r *http.Request) {
	// Only admins receive (and need) the user/guest counts, so only compute them for
	// admins. This keeps the expensive count queries off the per-login/per-refresh hot
	// path that non-admin clients hit via loadMe()/loadConfigAndMe().
	serverLimits, err := c.App.GetServerLimits(true)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(serverLimits); err != nil {
		c.Logger.Warn("Error writing server limits response", mlog.Err(err))
	}
}
