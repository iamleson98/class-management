package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitPluginLocal() {
	api.BaseRoutes.Plugins.Method(http.MethodPost, "/", api.APILocal(uploadPlugin, handlerParamFileAPI))
	api.BaseRoutes.Plugins.Method(http.MethodGet, "/", api.APILocal(getPlugins))
	api.BaseRoutes.Plugins.Method(http.MethodPost, "/install_from_url", api.APILocal(installPluginFromURL))
	api.BaseRoutes.Plugin.Method(http.MethodDelete, "/", api.APILocal(removePlugin))
	api.BaseRoutes.Plugin.Method(http.MethodPost, "/enable", api.APILocal(enablePlugin))
	api.BaseRoutes.Plugin.Method(http.MethodPost, "/disable", api.APILocal(disablePlugin))
	api.BaseRoutes.Plugins.Method(http.MethodPost, "/marketplace", api.APILocal(installMarketplacePlugin))
	api.BaseRoutes.Plugins.Method(http.MethodGet, "/marketplace", api.APILocal(getMarketplacePlugins))
	api.BaseRoutes.Plugins.Method(http.MethodPost, "/reattach", api.APILocal(reattachPlugin))
	api.BaseRoutes.Plugin.Method(http.MethodPost, "/detach", api.APILocal(detachPlugin))
}

// reattachPlugin allows the server to bind to an existing plugin instance launched elsewhere.
//
// This API is only exposed over a local socket.
func reattachPlugin(c *Context, w http.ResponseWriter, r *http.Request) {
	var pluginReattachRequest model.PluginReattachRequest
	if err := json.NewDecoder(r.Body).Decode(&pluginReattachRequest); err != nil {
		c.Err = model.NewAppError("reattachPlugin", "api4.plugin.reattachPlugin.invalid_request", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	if err := pluginReattachRequest.IsValid(); err != nil {
		c.Err = err
		return
	}

	err := c.App.ReattachPlugin(pluginReattachRequest.Manifest, pluginReattachRequest.PluginReattachConfig)
	if err != nil {
		c.Err = err
		return
	}
}

// detachPlugin detaches a previously reattached plugin.
//
// This API is only exposed over a local socket.
func detachPlugin(c *Context, w http.ResponseWriter, r *http.Request) {
	pluginIdStr := c.RequireParam("plugin_id", web.RequireString)
	if c.Err != nil {
		return
	}

	err := c.App.DetachPlugin(pluginIdStr)
	if err != nil {
		c.Err = err
		return
	}
}
