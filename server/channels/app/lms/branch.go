package lms

import (
	"errors"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

// LMSApp is the LMS application layer that wraps store access with business logic.
type LMSApp struct {
	store store.Store
}

func NewLMSApp(s store.Store) *LMSApp {
	return &LMSApp{store: s}
}

// Branch
func (a *LMSApp) GetBranch(id string) (*lms_models.Branch, *model.AppError) {
	branch, err := a.store.Branch().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetBranch", "app.lms.branch.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetBranch", "app.lms.branch.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return branch, nil
}

func (a *LMSApp) GetBranches(opts modelhelper.BranchFilterOpts) ([]*lms_models.Branch, *model.AppError) {
	branches, err := a.store.Branch().GetAll(opts)
	if err != nil {
		return nil, model.NewAppError("GetBranches", "app.lms.branch.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return branches, nil
}

func (a *LMSApp) CreateBranch(branch *lms_models.Branch) (*lms_models.Branch, *model.AppError) {
	saved, err := a.store.Branch().Save(branch)
	if err != nil {
		return nil, model.NewAppError("CreateBranch", "app.lms.branch.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return saved, nil
}

func (a *LMSApp) DeleteBranch(id string) *model.AppError {
	err := a.store.Branch().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteBranch", "app.lms.branch.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteBranch", "app.lms.branch.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}
