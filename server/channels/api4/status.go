package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

func (api *API) InitStatus() {
	api.BaseRoutes.User.Method(http.MethodGet, "/status", api.APISessionRequired(getUserStatus))
	api.BaseRoutes.Users.Method(http.MethodPost, "/status/ids", api.APISessionRequired(getUserStatusesByIds))
	api.BaseRoutes.User.Method(http.MethodPut, "/status", api.APISessionRequired(updateUserStatus))
	api.BaseRoutes.User.Method(http.MethodPut, "/status/custom", api.APISessionRequired(updateUserCustomStatus))
	api.BaseRoutes.User.Method(http.MethodDelete, "/status/custom", api.APISessionRequired(removeUserCustomStatus))

	// Both these handlers are for removing the recent custom status but the one with the POST method should be preferred
	// as DELETE method doesn't support request body in the mobile app.
	api.BaseRoutes.User.Method(http.MethodDelete, "/status/custom/recent", api.APISessionRequired(removeUserRecentCustomStatus))
	api.BaseRoutes.User.Method(http.MethodPost, "/status/custom/recent/delete", api.APISessionRequired(removeUserRecentCustomStatus))
}

func getUserStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	statusMap, err := c.App.GetUserStatusesByIds([]string{userIdStr})
	if err != nil {
		c.Err = err
		return
	}

	if len(statusMap) == 0 {
		c.Err = model.NewAppError("UserStatus", "api.status.user_not_found.app_error", nil, "", http.StatusNotFound)
		return
	}

	if err := json.NewEncoder(w).Encode(statusMap[0]); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUserStatusesByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getUserStatusesByIds", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	for _, userId := range userIds {
		if len(userId) != 26 {
			c.SetInvalidParam("user_ids")
			return
		}
	}

	// No permission check required
	statuses, appErr := c.App.GetUserStatusesByIds(userIds)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(statuses)
	if err != nil {
		c.Err = model.NewAppError("getUserStatusesByIds", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateUserStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	var status model.Status
	if jsonErr := json.NewDecoder(r.Body).Decode(&status); jsonErr != nil {
		c.SetInvalidParamWithErr("status", jsonErr)
		return
	}

	// The user being updated in the payload must be the same one as indicated in the URL.
	if status.UserId != userIdStr {
		c.SetInvalidParam("user_id")
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	currentStatus, err := c.App.GetStatus(userIdStr)
	if err != nil {
		c.Logger.Warn("Failed to get current status", mlog.Err(err))
	} else if currentStatus.Status == model.StatusOutOfOffice && status.Status != model.StatusOutOfOffice {
		err = c.App.DisableAutoResponder(c.AppContext, userIdStr, c.IsSystemAdmin())
		if err != nil {
			c.Logger.Warn("Failed to disable auto-responder", mlog.Err(err))
		}
	}

	switch status.Status {
	case "online":
		c.App.SetStatusOnline(userIdStr, true)
	case "offline":
		c.App.SetStatusOffline(userIdStr, true, false)
	case "away":
		c.App.SetStatusAwayIfNeeded(userIdStr, true)
	case "dnd":
		c.App.SetStatusDoNotDisturbTimed(userIdStr, status.DNDEndTime)
	default:
		c.SetInvalidParam("status")
		return
	}

	getUserStatus(c, w, r)
}

func updateUserCustomStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if !*c.App.Config().TeamSettings.EnableCustomUserStatuses {
		c.Err = model.NewAppError("updateUserCustomStatus", "api.custom_status.disabled", nil, "", http.StatusNotImplemented)
		return
	}

	var customStatus model.CustomStatus
	jsonErr := json.NewDecoder(r.Body).Decode(&customStatus)
	if jsonErr != nil || (customStatus.Emoji == "" && customStatus.Text == "") || !customStatus.AreDurationAndExpirationTimeValid() {
		c.SetInvalidParamWithErr("custom_status", jsonErr)
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	customStatus.PreSave()
	err := c.App.SetCustomStatus(c.AppContext, userIdStr, &customStatus)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func removeUserCustomStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if !*c.App.Config().TeamSettings.EnableCustomUserStatuses {
		c.Err = model.NewAppError("removeUserCustomStatus", "api.custom_status.disabled", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if err := c.App.RemoveCustomStatus(c.AppContext, userIdStr); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func removeUserRecentCustomStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if !*c.App.Config().TeamSettings.EnableCustomUserStatuses {
		c.Err = model.NewAppError("removeUserRecentCustomStatus", "api.custom_status.disabled", nil, "", http.StatusNotImplemented)
		return
	}

	var recentCustomStatus model.CustomStatus
	if jsonErr := json.NewDecoder(r.Body).Decode(&recentCustomStatus); jsonErr != nil {
		c.SetInvalidParamWithErr("recent_custom_status", jsonErr)
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if err := c.App.RemoveRecentCustomStatus(c.AppContext, userIdStr, &recentCustomStatus); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
