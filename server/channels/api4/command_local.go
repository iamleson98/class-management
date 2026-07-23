package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

func (api *API) InitCommandLocal() {
	api.BaseRoutes.Commands.Method(http.MethodPost, "/", api.APILocal(localCreateCommand))
	api.BaseRoutes.Commands.Method(http.MethodGet, "/", api.APILocal(listCommands))

	api.BaseRoutes.Command.Method(http.MethodGet, "/", api.APILocal(getCommand))
	api.BaseRoutes.Command.Method(http.MethodPut, "/", api.APILocal(updateCommand))
	api.BaseRoutes.Command.Method(http.MethodPut, "/move", api.APILocal(moveCommand))
	api.BaseRoutes.Command.Method(http.MethodDelete, "/", api.APILocal(deleteCommand))
}

func localCreateCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	var cmd model.Command
	if jsonErr := json.NewDecoder(r.Body).Decode(&cmd); jsonErr != nil {
		c.SetInvalidParamWithErr("command", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLocalCreateCommand, model.AuditStatusFail)
	model.AddEventParameterAuditableToAuditRec(auditRec, "command", &cmd)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	rcmd, err := c.App.CreateCommand(&cmd)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")
	auditRec.AddEventResultState(rcmd)
	auditRec.AddEventObjectType("command")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rcmd); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
