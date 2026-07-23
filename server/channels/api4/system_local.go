package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

func (api *API) InitSystemLocal() {
	api.BaseRoutes.System.Method(http.MethodGet, "/ping", api.APILocal(getSystemPing))
	api.BaseRoutes.APIRoot.Method(http.MethodGet, "/logs", api.APILocal(getLogs))
	api.BaseRoutes.APIRoot.Method(http.MethodPost, "/server_busy", api.APILocal(setServerBusy))
	api.BaseRoutes.APIRoot.Method(http.MethodGet, "/server_busy", api.APILocal(getServerBusyExpires))
	api.BaseRoutes.APIRoot.Method(http.MethodDelete, "/server_busy", api.APILocal(clearServerBusy))
	api.BaseRoutes.System.Method(http.MethodGet, "/support_packet", api.APILocal(generateSupportPacket))
	api.BaseRoutes.APIRoot.Method(http.MethodPost, "/integrity", api.APILocal(localCheckIntegrity))
	api.BaseRoutes.System.Method(http.MethodGet, "/schema/version", api.APILocal(getAppliedSchemaMigrations))
}

func localCheckIntegrity(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord(model.AuditEventLocalCheckIntegrity, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	var results []model.IntegrityCheckResult
	resultsChan := c.App.CheckIntegrity()
	for result := range resultsChan {
		results = append(results, result)
	}

	data, err := json.Marshal(results)
	if err != nil {
		c.Err = model.NewAppError("Api4.localCheckIntegrity", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	if _, err := w.Write(data); err != nil {
		c.Logger.Warn("Failed to write response", mlog.Err(err))
	}
}
