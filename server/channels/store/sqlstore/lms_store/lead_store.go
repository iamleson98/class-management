package lmsstore

import (
	"database/sql"

	"github.com/aarondl/null/v8"
	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
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

func (s *SqlLeadStore) GetAll(opts modelhelper.LeadFilterOpts) ([]*lms_models.Lead, error) {
	var mods []qm.QueryMod

	if opts.Status != "" {
		mods = append(mods, lms_models.LeadWhere.Status.EQ(opts.Status))
	}
	if opts.Source != "" {
		mods = append(mods, lms_models.LeadWhere.Source.EQ(null.StringFrom(opts.Source)))
	}
	if opts.CounselorID != "" {
		mods = append(mods, lms_models.LeadWhere.CounselorID.EQ(null.StringFrom(opts.CounselorID)))
	}
	if opts.Search != "" {
		pattern := "%" + opts.Search + "%"
		mods = append(mods, qm.Or(
			"("+lms_models.LeadColumns.Name+" ILIKE ? OR "+lms_models.LeadColumns.Phone+" ILIKE ? OR "+lms_models.LeadColumns.Email+" ILIKE ?)",
			pattern, pattern, pattern,
		))
	}

	mods = append(mods, qm.OrderBy(lms_models.LeadColumns.Createat+" DESC"))

	if opts.PerPage > 0 {
		mods = append(mods, qm.Limit(opts.PerPage))
		if opts.Page > 0 {
			mods = append(mods, qm.Offset((opts.Page-1)*opts.PerPage))
		}
	}

	leads, err := lms_models.Leads(mods...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get leads")
	}

	result := make([]*lms_models.Lead, len(leads))
	copy(result, leads)
	return result, nil
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

func (s *SqlLeadStore) Count(opts modelhelper.LeadFilterOpts) (int64, error) {
	var mods []qm.QueryMod

	if opts.Status != "" {
		mods = append(mods, lms_models.LeadWhere.Status.EQ(opts.Status))
	}
	if opts.Source != "" {
		mods = append(mods, lms_models.LeadWhere.Source.EQ(null.StringFrom(opts.Source)))
	}
	if opts.CounselorID != "" {
		mods = append(mods, lms_models.LeadWhere.CounselorID.EQ(null.StringFrom(opts.CounselorID)))
	}
	if opts.Search != "" {
		pattern := "%" + opts.Search + "%"
		mods = append(mods, qm.Or(
			"("+lms_models.LeadColumns.Name+" ILIKE ? OR "+lms_models.LeadColumns.Phone+" ILIKE ? OR "+lms_models.LeadColumns.Email+" ILIKE ?)",
			pattern, pattern, pattern,
		))
	}

	count, err := lms_models.Leads(mods...).Count(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return 0, errors.Wrap(err, "failed to count leads")
	}
	return count, nil
}

func (s *SqlLeadStore) CountNewThisMonth() (int64, error) {
	var count int64
	err := s.sqlStore.GetReplicaExecuter().QueryRow(
		"SELECT COUNT(*) FROM Leads WHERE Status = 'NEW' AND EXTRACT(MONTH FROM createat) = EXTRACT(MONTH FROM CURRENT_TIMESTAMP) AND EXTRACT(YEAR FROM createat) = EXTRACT(YEAR FROM CURRENT_TIMESTAMP)",
	).Scan(&count)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count new leads this month")
	}
	return count, nil
}
