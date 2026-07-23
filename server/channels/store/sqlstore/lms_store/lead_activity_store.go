package lmsstore

import (
	"database/sql"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlLeadActivityStore struct {
	sqlStore store.Store
}

func NewSqlLeadActivityStore(s store.Store) store.LeadActivityStore {
	return &SqlLeadActivityStore{sqlStore: s}
}

func (s *SqlLeadActivityStore) Get(id string) (*lms_models.LeadActivity, error) {
	activity, err := lms_models.FindLeadActivity(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("LeadActivity", id)
		}
		return nil, errors.Wrap(err, "failed to get lead activity")
	}

	return activity, nil
}

func (s *SqlLeadActivityStore) GetByLead(leadID string) ([]*lms_models.LeadActivity, error) {
	activities, err := lms_models.LeadActivities(
		lms_models.LeadActivityWhere.LeadID.EQ(leadID),
		qm.OrderBy(lms_models.LeadActivityColumns.Createat+" DESC"),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get lead activities by lead")
	}

	return activities, nil
}

func (s *SqlLeadActivityStore) Save(activity *lms_models.LeadActivity) (*lms_models.LeadActivity, error) {
	modelhelper.LeadActivityPreCreate(activity)
	if err := modelhelper.LeadActivityIsValid(activity); err != nil {
		return nil, err
	}

	if err := activity.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save lead activity")
	}

	return activity, nil
}
