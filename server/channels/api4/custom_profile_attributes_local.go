package api4

import "net/http"

func (api *API) InitCustomProfileAttributesLocal() {
	if api.srv.Config().FeatureFlags.CustomProfileAttributes {
		api.BaseRoutes.CustomProfileAttributesFields.Method(http.MethodGet, "/", api.APILocal(listCPAFields))
		api.BaseRoutes.CustomProfileAttributesFields.Method(http.MethodPost, "/", api.APILocal(createCPAField))
		api.BaseRoutes.CustomProfileAttributesField.Method(http.MethodPatch, "/", api.APILocal(patchCPAField))
		api.BaseRoutes.CustomProfileAttributesField.Method(http.MethodDelete, "/", api.APILocal(deleteCPAField))
		api.BaseRoutes.User.Method(http.MethodGet, "/custom_profile_attributes", api.APILocal(listCPAValues))
		api.BaseRoutes.CustomProfileAttributesValues.Method(http.MethodPatch, "/", api.APILocal(patchCPAValues))
		api.BaseRoutes.User.Method(http.MethodPatch, "/custom_profile_attributes", api.APILocal(patchCPAValuesForUser))
	}
}
