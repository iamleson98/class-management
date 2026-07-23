package api4

import "net/http"

func (api *API) InitBotLocal() {
	api.BaseRoutes.Bot.Method(http.MethodGet, "/", api.APILocal(getBot))
	api.BaseRoutes.Bot.Method(http.MethodPut, "/", api.APILocal(patchBot))
	api.BaseRoutes.Bot.Method(http.MethodPost, "/disable", api.APILocal(disableBot))
	api.BaseRoutes.Bot.Method(http.MethodPost, "/enable", api.APILocal(enableBot))
	api.BaseRoutes.Bot.Method(http.MethodPost, "/convert_to_user", api.APILocal(convertBotToUser))
	api.BaseRoutes.Bot.Method(http.MethodPost, "/assign/{user_id:[A-Za-z0-9]+}", api.APILocal(assignBot))
	api.BaseRoutes.Bots.Method(http.MethodGet, "/", api.APILocal(getBots))
}
