package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitImport() {
	api.BaseRoutes.Imports.Method(http.MethodGet, "/", api.APISessionRequired(listImports))
	api.BaseRoutes.Import.Method(http.MethodDelete, "/", api.APISessionRequired(deleteImport))
}

func listImports(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	imports, appErr := c.App.ListImports()
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(imports); err != nil {
		c.Logger.Warn("Error writing imports", mlog.Err(err))
	}
}

func deleteImport(c *Context, w http.ResponseWriter, r *http.Request) {
	importNameStr := c.RequireParam("import_name", web.RequireString)
	if c.Err != nil {
		return
	}
	auditRec := c.MakeAuditRecord(model.AuditEventDeleteImport, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("import_name", importNameStr)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if err := c.App.DeleteImport(importNameStr); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
