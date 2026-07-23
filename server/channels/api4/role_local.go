package api4

import "net/http"

func (api *API) InitRoleLocal() {
	api.BaseRoutes.Roles.Method(http.MethodGet, "/", api.APILocal(getAllRoles))
	api.BaseRoutes.Roles.Method(http.MethodGet, "/{role_id:[A-Za-z0-9]+}", api.APILocal(getRole))
	api.BaseRoutes.Roles.Method(http.MethodGet, "/name/{role_name:[a-z0-9_]+}", api.APILocal(getRoleByName))
	api.BaseRoutes.Roles.Method(http.MethodPost, "/names", api.APILocal(getRolesByNames))
	api.BaseRoutes.Roles.Method(http.MethodPut, "/{role_id:[A-Za-z0-9]+}/patch", api.APILocal(patchRole))
}
