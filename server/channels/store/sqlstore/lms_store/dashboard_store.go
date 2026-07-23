package lmsstore

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlDashboardStore struct {
	sqlStore store.Store
}

func NewSqlDashboardStore(s store.Store) store.DashboardStore {
	return &SqlDashboardStore{sqlStore: s}
}

func (s *SqlDashboardStore) CountStudents() (int64, error) {
	var count int64
	err := s.sqlStore.GetReplicaExecuter().QueryRow(
		"SELECT COUNT(*) FROM Users WHERE Roles LIKE '%STUDENT%' AND DeleteAt = 0",
	).Scan(&count)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count students")
	}
	return count, nil
}

func (s *SqlDashboardStore) GetChildrenByParentID(parentID string) ([]*model.User, error) {
	rows, err := s.sqlStore.GetReplicaExecuter().Query(
		"SELECT Id, Username, Email FROM Users WHERE DeleteAt = 0 AND Props::jsonb->>'parent_id' = $1",
		parentID,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get children by parent id")
	}
	defer rows.Close()

	var users []*model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.Id, &u.Username, &u.Email); err != nil {
			return nil, errors.Wrap(err, "failed to scan child user")
		}
		users = append(users, &u)
	}
	return users, nil
}
