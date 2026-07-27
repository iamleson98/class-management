package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

const maxUpdatePreferences = 100

func (api *API) InitPreference() {
	api.BaseRoutes.Preferences.Method(http.MethodGet, "/", api.APISessionRequired(getPreferences))
	api.BaseRoutes.Preferences.Method(http.MethodPut, "/", api.APISessionRequired(updatePreferences))
	api.BaseRoutes.Preferences.Method(http.MethodPost, "/delete", api.APISessionRequired(deletePreferences))
	api.BaseRoutes.Preferences.Method(http.MethodGet, "/{category:[A-Za-z0-9_]+}", api.APISessionRequired(getPreferencesByCategory))
	api.BaseRoutes.Preferences.Method(http.MethodGet, "/{category:[A-Za-z0-9_]+}/name/{preference_name:[A-Za-z0-9_]+}", api.APISessionRequired(getPreferenceByCategoryAndName))
}

func getPreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	preferences, err := c.App.GetPreferencesForUser(c.AppContext, userIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(preferences); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPreferencesByCategory(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)
	categoryStr := c.RequireParam("category", web.RequireValidName)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	preferences, err := c.App.GetPreferenceByCategoryForUser(c.AppContext, userIdStr, categoryStr)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(preferences); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPreferenceByCategoryAndName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)
	categoryStr := c.RequireParam("category", web.RequireValidName)
	preferenceNameStr := c.RequireParam("preference_name", web.RequireValidName)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	preferences, err := c.App.GetPreferenceByCategoryAndNameForUser(c.AppContext, userIdStr, categoryStr, preferenceNameStr)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(preferences); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updatePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	auditRec := c.MakeAuditRecord(model.AuditEventUpdatePreferences, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	var preferences model.Preferences
	err := model.StructFromJSONLimited(r.Body, &preferences)
	if err != nil {
		c.SetInvalidParamWithErr("preferences", err)
		return
	} else if len(preferences) == 0 || len(preferences) > maxUpdatePreferences {
		c.SetInvalidParam("preferences")
		return
	}

	var sanitizedPreferences model.Preferences
	channelMap := make(map[string]*model.Channel)

	for _, pref := range preferences {
		if pref.Category == model.PreferenceCategoryFlaggedPost {
			post, err := c.App.GetSinglePost(c.AppContext, pref.Name, false)
			if err != nil {
				c.SetInvalidParam("preference.name")
				return
			}

			channel, ok := channelMap[post.ChannelId]
			if !ok {
				channel, err = c.App.GetChannel(c.AppContext, post.ChannelId)
				if err != nil {
					c.Err = err
					return
				}
			}

			if ok, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel); !ok {
				c.SetPermissionError(model.PermissionReadChannelContent)
				return
			}
		}

		sanitizedPreferences = append(sanitizedPreferences, pref)
	}

	if err := c.App.UpdatePreferences(c.AppContext, userIdStr, sanitizedPreferences); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func deletePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	auditRec := c.MakeAuditRecord(model.AuditEventDeletePreferences, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	var preferences model.Preferences
	err := model.StructFromJSONLimited(r.Body, &preferences)
	if err != nil {
		c.SetInvalidParamWithErr("preferences", err)
		return
	} else if len(preferences) == 0 || len(preferences) > maxUpdatePreferences {
		c.SetInvalidParam("preferences")
		return
	}

	if err := c.App.DeletePreferences(c.AppContext, userIdStr, preferences); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
