package lmsapi

import (
	"encoding/json"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
)

// InitBranches registers branch routes on the LMS router.
func (a *LMSAPI) InitBranches() {
	a.routes.Method(http.MethodPost, "/branches", a.api.APISessionRequired(getBranches))
	a.routes.Method(http.MethodPost, "/branches/create", a.api.APISessionRequired(createBranch))
}

func getBranches(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageBranches) {
		c.SetPermissionError(model.PermissionLmsManageBranches)
		return
	}

	opts := modelhelper.BranchFilterOpts{}
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getBranches", "api.lms.branch.get_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	branches, totalCount, err := c.App.LMS().GetBranches(opts)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(utils.ResponseList{
		Items:      branches,
		TotalCount: totalCount,
	}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createBranch(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageBranches) {
		c.SetPermissionError(model.PermissionLmsManageBranches)
		return
	}
	var branch *lms_models.Branch
	if err := json.NewDecoder(r.Body).Decode(&branch); err != nil {
		c.Err = model.NewAppError("createBranch", "api.lms.branch.create_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateBranch(branch)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(created)
	w.Write(data)
}
