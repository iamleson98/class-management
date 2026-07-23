package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

func (api *API) InitAgents() {
	api.BaseRoutes.Agents.Method(http.MethodGet, "/", api.APISessionRequired(getAgents))
	api.BaseRoutes.Agents.Method(http.MethodGet, "/status", api.APISessionRequired(getAgentsStatus))
	api.BaseRoutes.LLMServices.Method(http.MethodGet, "/", api.APISessionRequired(getLLMServices))
}

func getAgentsStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	available, reason := c.App.GetAIPluginBridgeStatus(c.AppContext)

	resp := &model.AgentsIntegrityResponse{
		Available: available,
		Reason:    reason,
	}

	jsonData, err := json.Marshal(resp)
	if err != nil {
		c.Err = model.NewAppError("Api4.getAgentsStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(jsonData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAgents(c *Context, w http.ResponseWriter, r *http.Request) {
	agents, appErr := c.App.GetAgents(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getAgents", "app.agents.get_agents.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	jsonData, err := json.Marshal(agents)
	if err != nil {
		c.Err = model.NewAppError("Api4.getAgents", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(jsonData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getLLMServices(c *Context, w http.ResponseWriter, r *http.Request) {
	services, appErr := c.App.GetLLMServices(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getLLMServices", "app.agents.get_services.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	jsonData, err := json.Marshal(services)
	if err != nil {
		c.Err = model.NewAppError("Api4.getLLMServices", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(jsonData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
