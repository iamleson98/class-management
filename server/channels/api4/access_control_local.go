package api4

import "net/http"

func (api *API) InitAccessControlPolicyLocal() {
	if !api.srv.Config().FeatureFlags.AttributeBasedAccessControl {
		return
	}
	api.BaseRoutes.AccessControlPolicies.Method(http.MethodPut, "/", api.APILocal(createAccessControlPolicy))
	api.BaseRoutes.AccessControlPolicies.Method(http.MethodPost, "/search", api.APILocal(searchAccessControlPolicies))
	api.BaseRoutes.AccessControlPolicies.Method(http.MethodPut, "/activate", api.APILocal(setActiveStatus))

	api.BaseRoutes.AccessControlPolicies.Method(http.MethodPost, "/cel/check", api.APILocal(checkExpression))
	api.BaseRoutes.AccessControlPolicies.Method(http.MethodPost, "/cel/test", api.APILocal(testExpression))
	api.BaseRoutes.AccessControlPolicies.Method(http.MethodPost, "/cel/validate_requester", api.APILocal(validateExpressionAgainstRequester))
	api.BaseRoutes.AccessControlPolicies.Method(http.MethodGet, "/cel/autocomplete/fields", api.APILocal(getFieldsAutocomplete))
	api.BaseRoutes.AccessControlPolicies.Method(http.MethodPost, "/cel/visual_ast", api.APILocal(convertToVisualAST))

	api.BaseRoutes.AccessControlPolicy.Method(http.MethodGet, "/", api.APILocal(getAccessControlPolicy))
	api.BaseRoutes.AccessControlPolicy.Method(http.MethodDelete, "/", api.APILocal(deleteAccessControlPolicy))
	api.BaseRoutes.AccessControlPolicy.Method(http.MethodPost, "/assign", api.APILocal(assignAccessPolicy))
	api.BaseRoutes.AccessControlPolicy.Method(http.MethodDelete, "/unassign", api.APILocal(unassignAccessPolicy))
	api.BaseRoutes.AccessControlPolicy.Method(http.MethodGet, "/resources/channels", api.APILocal(getChannelsForAccessControlPolicy))
	api.BaseRoutes.AccessControlPolicy.Method(http.MethodPost, "/resources/channels/search", api.APILocal(searchChannelsForAccessControlPolicy))
}
