package lmsapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
)

// LMSAPI handles all LMS API routes.
type LMSAPI struct {
	routes *chi.Mux // api/v4/lms
	api    *api4.API
}

func init() {
	api4.RegisterInitLmsApiFunc(Init)
}

// Init registers all LMS API routes and initializes all sub-route groups.
func Init(api *api4.API) error {
	lmsAPI := &LMSAPI{
		routes: api.BaseRoutes.LMS,
		api:    api,
	}

	// Public routes (no auth required)
	lmsAPI.InitPublic()

	// Dev-only: serve OpenAPI JSON spec
	api4.InitSwaggerRoutes(func(method, pattern string, handler http.Handler) {
		lmsAPI.routes.Method(method, pattern, handler)
	})

	// Authenticated routes
	lmsAPI.InitBranches()
	lmsAPI.InitCourses()
	lmsAPI.InitClasses()
	lmsAPI.InitSessions()
	lmsAPI.InitLeads()
	lmsAPI.InitFeePackages()
	lmsAPI.InitTuitions()
	lmsAPI.InitPayments()
	lmsAPI.InitPosts()
	lmsAPI.InitHomework()
	lmsAPI.InitWeeklyReviews()
	lmsAPI.InitTasks()
	lmsAPI.InitBanners()
	lmsAPI.InitNotifications()
	lmsAPI.InitMaterials()
	lmsAPI.InitClassMedia()
	lmsAPI.InitStudents()
	lmsAPI.InitUsers()
	lmsAPI.InitDashboard()
	lmsAPI.InitReports()

	return nil
}
