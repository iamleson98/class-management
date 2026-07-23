package api4

import (
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
)

// APIs for self-hosted workspaces to communicate with the backing customer & payments system.
// Endpoints for cloud installations should not go in this file.
func (api *API) InitHostedCustomer() {
	// POST /api/v4/hosted_customer/available
	api.BaseRoutes.HostedCustomer.Method(http.MethodGet, "/signup_available", api.APISessionRequired(handleSignupAvailable))
}

func handleSignupAvailable(c *Context, w http.ResponseWriter, r *http.Request) {
	const where = "Api4.handleSignupAvailable"
	c.Err = model.NewAppError(where, "api.server.hosted_signup_unavailable.error", nil, "", http.StatusNotImplemented)
}
