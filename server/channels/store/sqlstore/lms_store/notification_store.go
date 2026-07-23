package lmsstore

import (
	"database/sql"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	"github.com/pkg/errors"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

type SqlNotificationStore struct {
	sqlStore store.Store
}

func NewSqlNotificationStore(s store.Store) store.NotificationStore {
	return &SqlNotificationStore{sqlStore: s}
}

func (s *SqlNotificationStore) Get(id string) (*lms_models.Notification, error) {
	notification, err := lms_models.FindNotification(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Notification", id)
		}
		return nil, errors.Wrap(err, "failed to find notification")
	}

	return notification, nil
}

func (s *SqlNotificationStore) GetByUser(userID string) ([]*lms_models.Notification, error) {
	notifications, err := lms_models.Notifications(
		lms_models.NotificationWhere.UserID.EQ(userID),
		qm.OrderBy(lms_models.NotificationColumns.IsRead+" ASC, "+lms_models.NotificationColumns.Createat+" DESC"),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get notifications by user")
	}

	return notifications, nil
}

func (s *SqlNotificationStore) Save(n *lms_models.Notification) (*lms_models.Notification, error) {
	modelhelper.NotificationPreCreate(n)
	if err := modelhelper.NotificationIsValid(n); err != nil {
		return nil, err
	}

	if err := n.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save notification")
	}

	return n, nil
}

func (s *SqlNotificationStore) MarkAsRead(id string) error {
	notification, err := lms_models.FindNotification(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Notification", id)
		}
		return errors.Wrap(err, "failed to find notification")
	}

	notification.IsRead = true
	_, err = notification.Update(s.sqlStore.GetMasterExecuter(), boil.Whitelist(lms_models.NotificationColumns.IsRead))
	return errors.Wrap(err, "failed to mark notification as read")
}
