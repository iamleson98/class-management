package api4

import "net/http"

func (api *API) InitLdapLocal() {
	api.BaseRoutes.LDAP.Method(http.MethodPost, "/migrateid", api.APILocal(migrateIDLdap))
	api.BaseRoutes.LDAP.Method(http.MethodPost, "/sync", api.APILocal(syncLdap))
	api.BaseRoutes.LDAP.Method(http.MethodPost, "/test", api.APILocal(testLdap))
	api.BaseRoutes.LDAP.Method(http.MethodGet, "/groups", api.APILocal(getLdapGroups))
	api.BaseRoutes.LDAP.Method(http.MethodPost, "/certificate/public", api.APILocal(addLdapPublicCertificate))
	api.BaseRoutes.LDAP.Method(http.MethodPost, "/certificate/private", api.APILocal(addLdapPrivateCertificate))
	api.BaseRoutes.LDAP.Method(http.MethodDelete, "/certificate/public", api.APILocal(removeLdapPublicCertificate))
	api.BaseRoutes.LDAP.Method(http.MethodDelete, "/certificate/private", api.APILocal(removeLdapPrivateCertificate))
}
