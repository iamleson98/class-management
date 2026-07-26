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

type SqlBranchStore struct {
	sqlStore store.Store
}

func NewSqlBranchStore(s store.Store) store.BranchStore {
	return &SqlBranchStore{sqlStore: s}
}

func (s *SqlBranchStore) Get(id string) (*lms_models.Branch, error) {
	branch, err := lms_models.FindBranch(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Branch", id)
		}
		return nil, errors.Wrap(err, "failed to get branch")
	}
	return branch, nil
}

func (s *SqlBranchStore) Search(opts modelhelper.BranchFilterOpts) ([]*lms_models.Branch, int64, error) {
	mods := []qm.QueryMod{}

	modsWithPagination := append(mods, &opts.SearchOpts)
	branches, err := lms_models.Branches(modsWithPagination...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to search branches")
	}
	totalCount := int64(len(branches))

	if opts.CountTotal {
		modsWithoutPagination := append(mods, opts.SearchOpts.ExludePaginationForCount())
		totalCount, err = lms_models.Branches(modsWithoutPagination...).Count(s.sqlStore.GetReplicaExecuter())
		if err != nil {
			return nil, 0, errors.Wrap(err, "failed to count branches")
		}
	}

	return branches, totalCount, nil
}

func (s *SqlBranchStore) Save(branch *lms_models.Branch) (*lms_models.Branch, error) {
	modelhelper.BranchPreCreate(branch)
	if err := modelhelper.BranchIsValid(branch); err != nil {
		return nil, err
	}

	if err := branch.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to insert branch")
	}
	return branch, nil
}

func (s *SqlBranchStore) Delete(id string) error {
	branch, err := lms_models.FindBranch(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("Branch", id)
		}
		return errors.Wrap(err, "failed to find branch for deletion")
	}

	rowsAffected, err := branch.Delete(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete branch")
	}
	if rowsAffected == 0 {
		return store.NewErrNotFound("Branch", id)
	}
	return nil
}
