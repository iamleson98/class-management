package lms

import (
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
)

func (a *LMSApp) GetNotifications(userID string) ([]*lms_models.Notification, int64, *model.AppError) {
	notifications, err := a.store.Notification().GetByUser(userID)
	if err != nil {
		return nil, 0, model.NewAppError("GetNotifications", "app.lms.notification.get_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var unreadCount int64
	for _, n := range notifications {
		if !n.IsRead {
			unreadCount++
		}
	}

	return notifications, unreadCount, nil
}

func (a *LMSApp) MarkNotificationAsRead(id string) *model.AppError {
	if err := a.store.Notification().MarkAsRead(id); err != nil {
		return model.NewAppError("MarkNotificationAsRead", "app.lms.notification.mark_as_read.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
