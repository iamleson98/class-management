package api4

import "net/http"

func (api *API) InitUploadLocal() {
	api.BaseRoutes.Uploads.Method(http.MethodPost, "/", api.APILocal(createUpload, handlerParamFileAPI))
	api.BaseRoutes.Upload.Method(http.MethodGet, "/", api.APILocal(getUpload))
	api.BaseRoutes.Upload.Method(http.MethodPost, "/", api.APILocal(uploadData, handlerParamFileAPI))
}
