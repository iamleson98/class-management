package api4

import "net/http"

func (api *API) InitExportLocal() {
	api.BaseRoutes.Exports.Method(http.MethodGet, "/", api.APILocal(listExports))
	api.BaseRoutes.Export.Method(http.MethodDelete, "/", api.APILocal(deleteExport))
	api.BaseRoutes.Export.Method(http.MethodGet, "/", api.APILocal(downloadExport))
	api.BaseRoutes.Export.Method(http.MethodPost, "/presign-url", api.APILocal(generatePresignURLExport))
}
