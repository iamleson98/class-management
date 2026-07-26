//go:build !production

package api4

import "net/http"

// InitSwaggerRoutes registers the OpenAPI JSON endpoint on the given router.
// Only compiled into non-production builds.
func InitSwaggerRoutes(route func(method, pattern string, handler http.Handler)) {
	route(http.MethodGet, "/openapi.json", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Write(openapiSpec)
	}))
}
