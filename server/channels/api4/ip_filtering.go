package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/app"
	"github.com/iamleson98/sitename/server/v8/einterfaces"
)

func (api *API) InitIPFiltering() {
	api.BaseRoutes.IPFiltering.Method(http.MethodGet, "/", api.APISessionRequired(getIPFilters))
	api.BaseRoutes.IPFiltering.Method(http.MethodPost, "/", api.APISessionRequired(applyIPFilters))
	api.BaseRoutes.IPFiltering.Method(http.MethodGet, "/my_ip", api.APISessionRequired(myIP))
}

func ensureIPFilteringInterface(c *Context, where string) (einterfaces.IPFilteringInterface, bool) {
	ipFilteringFeatureFlag := c.App.Config().FeatureFlags.CloudIPFiltering
	if c.App.IPFiltering() == nil || !ipFilteringFeatureFlag {
		c.Err = model.NewAppError(where, "api.context.ip_filtering.not_available.app_error", nil, "", http.StatusNotImplemented)
		return nil, false
	}
	return c.App.IPFiltering(), true
}

func getIPFilters(c *Context, w http.ResponseWriter, r *http.Request) {
	ipFiltering, ok := ensureIPFilteringInterface(c, "getIPFilters")
	if !ok {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadIPFilters) {
		c.SetPermissionError(model.PermissionSysconsoleReadIPFilters)
		return
	}

	allowedRanges, err := ipFiltering.GetIPFilters()
	if err != nil {
		c.Err = model.NewAppError("getIPFilters", "api.context.ip_filtering.get_ip_filters.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if err := json.NewEncoder(w).Encode(allowedRanges); err != nil {
		c.Err = model.NewAppError("getIPFilters", "api.context.ip_filtering.get_ip_filters.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
}

func applyIPFilters(c *Context, w http.ResponseWriter, r *http.Request) {
	ipFiltering, ok := ensureIPFilteringInterface(c, "applyIPFilters")
	if !ok {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteIPFilters) {
		c.SetPermissionError(model.PermissionSysconsoleWriteIPFilters)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventApplyIPFilters, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	allowedRanges := &model.AllowedIPRanges{} // Initialize the allowedRanges variable
	if err := json.NewDecoder(r.Body).Decode(allowedRanges); err != nil {
		c.Err = model.NewAppError("applyIPFilters", "api.context.ip_filtering.apply_ip_filters.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	model.AddEventParameterAuditableToAuditRec(auditRec, "IPFilter", allowedRanges)

	updatedAllowedRanges, err := ipFiltering.ApplyIPFilters(allowedRanges)

	if err != nil {
		c.Err = model.NewAppError("applyIPFilters", "api.context.ip_filtering.apply_ip_filters.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()

	go func() {
		if err := c.App.SendIPFiltersChangedEmail(c.AppContext, c.AppContext.Session().UserId); err != nil {
			c.Logger.Warn("Failed to send IP filters changed email", mlog.Err(err))
		}
	}()

	if err := json.NewEncoder(w).Encode(updatedAllowedRanges); err != nil {
		c.Err = model.NewAppError("getIPFilters", "api.context.ip_filtering.get_ip_filters.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
}

func myIP(c *Context, w http.ResponseWriter, r *http.Request) {
	_, ok := ensureIPFilteringInterface(c, "myIP")

	if !ok {
		return
	}

	response := &model.GetIPAddressResponse{
		IP: c.AppContext.IPAddress(),
	}

	json, err := json.Marshal(response)
	if err != nil {
		c.Err = model.NewAppError("myIP", "api.context.ip_filtering.get_my_ip.failed", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(json); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
