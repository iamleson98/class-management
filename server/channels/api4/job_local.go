package api4

import "net/http"

func (api *API) InitJobLocal() {
	api.BaseRoutes.Jobs.Method(http.MethodGet, "/", api.APILocal(getJobs))
	api.BaseRoutes.Jobs.Method(http.MethodPost, "/", api.APILocal(createJob))
	api.BaseRoutes.Jobs.Method(http.MethodGet, "/{job_id:[A-Za-z0-9]+}", api.APILocal(getJob))
	api.BaseRoutes.Jobs.Method(http.MethodGet, "/{job_id:[A-Za-z0-9]+}/download", api.APILocal(downloadJob))
	api.BaseRoutes.Jobs.Method(http.MethodPost, "/{job_id:[A-Za-z0-9]+}/cancel", api.APILocal(cancelJob))
	api.BaseRoutes.Jobs.Method(http.MethodGet, "/type/{job_type:[A-Za-z0-9_-]+}", api.APILocal(getJobsByType))
	api.BaseRoutes.Jobs.Method(http.MethodPatch, "/{job_id:[A-Za-z0-9]+}/status", api.APILocal(updateJobStatus))
}
