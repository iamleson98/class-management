package api4

import "net/http"

func (api *API) InitPreferenceLocal() {
	api.BaseRoutes.Preferences.Method(http.MethodGet, "/", api.APILocal(getPreferences))
	api.BaseRoutes.Preferences.Method(http.MethodPut, "/", api.APILocal(updatePreferences))
	api.BaseRoutes.Preferences.Method(http.MethodPost, "/delete", api.APILocal(deletePreferences))
	api.BaseRoutes.Preferences.Method(http.MethodGet, "/{category:[A-Za-z0-9_]+}", api.APILocal(getPreferencesByCategory))
	api.BaseRoutes.Preferences.Method(http.MethodGet, "/{category:[A-Za-z0-9_]+}/name/{preference_name:[A-Za-z0-9_]+}", api.APILocal(getPreferenceByCategoryAndName))
}
