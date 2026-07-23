package api4

import "net/http"

func (api *API) InitImportLocal() {
	api.BaseRoutes.Imports.Method(http.MethodGet, "/", api.APILocal(listImports))
	api.BaseRoutes.Import.Method(http.MethodDelete, "/", api.APILocal(deleteImport))
}
