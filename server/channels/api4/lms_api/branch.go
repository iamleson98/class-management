package lmsapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
)

// InitBranches registers branch routes on the LMS router.
func (a *LMSAPI) InitBranches() {
	a.routes.Method(http.MethodGet, "/branches", a.api.APISessionRequired(getBranches))
	a.routes.Method(http.MethodPost, "/branches", a.api.APISessionRequired(createBranch))
}

func getBranches(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageBranches) {
		c.SetPermissionError(model.PermissionLmsManageBranches)
		return
	}

	q := r.URL.Query()
	opts := modelhelper.BranchFilterOpts{}
	if v := q.Get("page"); v != "" {
		opts.Page, _ = strconv.Atoi(v)
	}
	if v := q.Get("per_page"); v != "" {
		opts.PerPage, _ = strconv.Atoi(v)
	}

	branches, err := c.App.LMS().GetBranches(opts)
	if err != nil {
		c.Err = err
		return
	}

	if branches == nil {
		branches = []*lms_models.Branch{}
	}

	data, _ := json.Marshal(utils.ResponseList{
		Items:      branches,
		TotalCount: int64(len(branches)),
	})
	w.Write(data)
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
