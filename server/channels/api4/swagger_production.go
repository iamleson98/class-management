//go:build production

package api4

import "net/http"

// InitSwaggerRoutes is a no-op in production builds.
func InitSwaggerRoutes(route func(method, pattern string, handler http.Handler)) {
	// Do not serve OpenAPI spec in production.
}
