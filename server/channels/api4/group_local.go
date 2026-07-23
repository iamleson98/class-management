package api4

import (
	"net/http"

	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitGroupLocal() {
	api.BaseRoutes.Channels.Method(http.MethodGet, "/{channel_id:[A-Za-z0-9]+}/groups", api.APILocal(getGroupsByChannelLocal))
	api.BaseRoutes.Teams.Method(http.MethodGet, "/{team_id:[A-Za-z0-9]+}/groups", api.APILocal(getGroupsByTeamLocal))
}

func getGroupsByChannelLocal(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	b, appErr := getGroupsByChannelCommon(c, r)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupsByTeamLocal(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireParam("team_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	b, appError := getGroupsByTeamCommon(c, r)
	if appError != nil {
		c.Err = appError
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
