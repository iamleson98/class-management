package lmsstore

import (
	"database/sql"
	"fmt"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlLeadStore struct {
	sqlStore store.Store
}

func NewSqlLeadStore(s store.Store) store.LeadStore {
	return &SqlLeadStore{sqlStore: s}
}

func (s *SqlLeadStore) Get(id string) (*lms_models.Lead, error) {
	lead, err := lms_models.FindLead(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Lead", id)
		}
		return nil, errors.Wrap(err, "failed to get lead")
	}
	return lead, nil
}

func (s *SqlLeadStore) Search(opts modelhelper.LeadFilterOpts) ([]*lms_models.Lead, int64, error) {
	mods := []qm.QueryMod{}

	if opts.Search != "" {
		mods = append(mods, &utils.WhereOrs[utils.LeadColumn]{
			{
				Column:   utils.LeadColumn(lms_models.LeadTableColumns.Name),
				Operator: utils.OperatorILike,
				Value:    fmt.Sprintf("%%%s%%", opts.Search),
			},
			{
				Column:   utils.LeadColumn(lms_models.LeadTableColumns.Phone),
				Operator: utils.OperatorILike,
				Value:    fmt.Sprintf("%%%s%%", opts.Search),
			},
			{
				Column:   utils.LeadColumn(lms_models.LeadTableColumns.Email),
				Operator: utils.OperatorILike,
				Value:    fmt.Sprintf("%%%s%%", opts.Search),
			},
		})
	}

	modsWithPagination := append(mods, &opts.SearchOpts)
	leads, err := lms_models.Leads(modsWithPagination...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to search leads")
	}
	totalCount := int64(len(leads))

	if opts.CountTotal {
		modsWithoutPagination := append(mods, opts.SearchOpts.ExludePaginationForCount())
		totalCount, err = lms_models.Leads(modsWithoutPagination...).Count(s.sqlStore.GetReplicaExecuter())
		if err != nil {
			return nil, 0, errors.Wrap(err, "failed to count leads")
		}
	}

	return leads, totalCount, nil
}

func (s *SqlLeadStore) Save(lead *lms_models.Lead) (*lms_models.Lead, error) {
	modelhelper.LeadPreCreate(lead)
	if err := modelhelper.LeadIsValid(lead); err != nil {
		return nil, err
	}

	if err := lead.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save lead")
	}
	return lead, nil
}

func (s *SqlLeadStore) Update(lead *lms_models.Lead) (*lms_models.Lead, error) {
	modelhelper.LeadPreUpdate(lead)
	if err := modelhelper.LeadIsValid(lead); err != nil {
		return nil, err
	}

	rowsAffected, err := lead.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update lead")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("Lead", lead.ID)
	}

	if err := lead.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload lead")
	}
	return lead, nil
}

func (s *SqlLeadStore) Delete(id string) error {
	lead, err := lms_models.FindLead(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Lead", id)
		}
		return errors.Wrap(err, "failed to find lead for deletion")
	}

	if _, err := lead.Delete(s.sqlStore.GetMasterExecuter()); err != nil {
		return errors.Wrap(err, "failed to delete lead")
	}
	return nil
}

func (s *SqlLeadStore) CountNewThisMonth(counselorId string) (int64, error) {
	var count int64
	args := []any{}

	query := `SELECT COUNT(*)
FROM leads
WHERE status = 'NEW'
AND EXTRACT(MONTH FROM to_timestamp(createat)) = EXTRACT(MONTH FROM CURRENT_TIMESTAMP)
AND EXTRACT(YEAR  FROM to_timestamp(createat)) = EXTRACT(YEAR  FROM CURRENT_TIMESTAMP)`
	if model.IsValidId(counselorId) {
		query += " AND counselor_id = $1"
		args = append(args, counselorId)
	}

	query += ";"

	err := s.sqlStore.GetReplicaExecuter().QueryRow(query, args...).Scan(&count)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count new leads this month")
	}
	return count, nil
}
