package lmsapi

import (
	"encoding/json"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (a *LMSAPI) InitNotifications() {
	a.routes.Method(http.MethodGet, "/notifications", a.api.APISessionRequired(getNotifications))
	a.routes.Method(http.MethodPost, "/notifications/{id:[A-Za-z0-9]+}/read", a.api.APISessionRequired(markNotificationAsRead))
}

func getNotifications(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsViewNotifications) {
		c.SetPermissionError(model.PermissionLmsViewNotifications)
		return
	}

	userID := c.AppContext.Session().UserId

	notifications, unreadCount, err := c.App.LMS().GetNotifications(userID)
	if err != nil {
		c.Err = err
		return
	}

	if notifications == nil {
		notifications = []*lms_models.Notification{}
	}

	if err := json.NewEncoder(w).Encode(LMSResponse{Data: map[string]any{
		"notifications": notifications,
		"unread_count":  unreadCount,
	}}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func markNotificationAsRead(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsViewNotifications) {
		c.SetPermissionError(model.PermissionLmsViewNotifications)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if err := c.App.LMS().MarkNotificationAsRead(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}
