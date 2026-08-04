// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

// Package callsapi registers the HTTP routes for the realtime calls module
// under /api/v4/calls. It mirrors the lms_api self-registration pattern: an
// init() registers an Init function with the api4 package, which calls it
// during route setup to avoid an import cycle.
package callsapi

import (
	"github.com/iamleson98/sitename/server/v8/channels/api4"
)

// CallsAPI handles all calls API routes mounted at api/v4/calls.
type CallsAPI struct {
	routes *api4.Routes // reuses api4's shared route groups
	api    *api4.API
}

func init() {
	api4.RegisterInitCallsApiFunc(Init)
}

// Init registers all calls API routes.
func Init(api *api4.API) error {
	c := &CallsAPI{
		routes: api.BaseRoutes,
		api:    api,
	}

	c.InitCalls()
	return nil
}
