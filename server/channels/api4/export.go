package api4

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitExport() {
	api.BaseRoutes.Exports.Method(http.MethodGet, "/", api.APISessionRequired(listExports))
	api.BaseRoutes.Export.Method(http.MethodDelete, "/", api.APISessionRequired(deleteExport))
	api.BaseRoutes.Export.Method(http.MethodGet, "/", api.APISessionRequired(downloadExport))
	api.BaseRoutes.Export.Method(http.MethodPost, "/presign-url", api.APISessionRequired(generatePresignURLExport))
}

func listExports(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	exports, appErr := c.App.ListExports()
	if appErr != nil {
		c.Err = appErr
		return
	}

	data, err := json.Marshal(exports)
	if err != nil {
		c.Err = model.NewAppError("listImports", "app.export.marshal.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(data); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteExport(c *Context, w http.ResponseWriter, r *http.Request) {
	exportName := c.RequireParam("export_name", web.RequireString)
	if c.Err != nil {
		return
	}
	exportNameStr := exportName.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteExport, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "export_name", exportNameStr)

	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if err := c.App.DeleteExport(exportNameStr); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func downloadExport(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	exportName := c.RequireParam("export_name", web.RequireString)
	if c.Err != nil {
		return
	}
	exportNameStr := exportName.(string)

	filePath := filepath.Join(*c.App.Config().ExportSettings.Directory, exportNameStr)
	if ok, err := c.App.ExportFileExists(filePath); err != nil {
		c.Err = err
		return
	} else if !ok {
		c.Err = model.NewAppError("downloadExport", "api.export.export_not_found.app_error", nil, "", http.StatusNotFound)
		return
	}

	file, err := c.App.ExportFileReader(filePath)
	if err != nil {
		c.Err = err
		return
	}
	defer file.Close()

	w.Header().Set("Content-Type", "application/zip")
	http.ServeContent(w, r, exportNameStr, time.Time{}, file)
}

func generatePresignURLExport(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord(model.AuditEventGeneratePresignURLExport, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	exportName := c.RequireParam("export_name", web.RequireString)
	if c.Err != nil {
		return
	}
	exportNameStr := exportName.(string)

	model.AddEventParameterToAuditRec(auditRec, "export_name", exportNameStr)

	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	res, appErr := c.App.GeneratePresignURLForExport(exportNameStr)
	if appErr != nil {
		c.Err = appErr
		return
	}

	data, err := json.Marshal(res)
	if err != nil {
		c.Err = model.NewAppError("generatePresignURLExport", "app.export.marshal.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	if _, err := w.Write(data); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
