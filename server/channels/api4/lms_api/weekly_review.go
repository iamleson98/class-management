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
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (a *LMSAPI) InitWeeklyReviews() {
	a.routes.Method(http.MethodPost, "/weekly-reviews", a.api.APISessionRequired(getWeeklyReviews))
	a.routes.Method(http.MethodPost, "/weekly-reviews/create", a.api.APISessionRequired(createWeeklyReview))
	a.routes.Method(http.MethodGet, "/weekly-reviews/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getWeeklyReview))
	a.routes.Method(http.MethodPut, "/weekly-reviews/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateWeeklyReview))
	a.routes.Method(http.MethodDelete, "/weekly-reviews/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteWeeklyReview))
}

func getWeeklyReviews(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageWeeklyReviews) {
		c.SetPermissionError(model.PermissionLmsManageWeeklyReviews)
		return
	}

	var opts modelhelper.WeeklyReviewFilterOpts
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.Err = model.NewAppError("getWeeklyReviews", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	items, totalCount, err := c.App.LMS().GetWeeklyReviews(opts)
	if err != nil {
		c.Err = err
		return
	}

	res := utils.ResponseList{
		Items:      items,
		TotalCount: totalCount,
	}

	if err := json.NewEncoder(w).Encode(res); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createWeeklyReview(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageWeeklyReviews) {
		c.SetPermissionError(model.PermissionLmsManageWeeklyReviews)
		return
	}

	var review *lms_models.WeeklyReview
	if err := json.NewDecoder(r.Body).Decode(&review); err != nil {
		c.Err = model.NewAppError("createWeeklyReview", "api.lms.create_weekly_review.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreateWeeklyReview(review)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(LMSResponse{Data: created}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getWeeklyReview(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageWeeklyReviews) {
		c.SetPermissionError(model.PermissionLmsManageWeeklyReviews)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	review, err := c.App.LMS().GetWeeklyReview(id)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(LMSResponse{Data: review}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateWeeklyReview(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageWeeklyReviews) {
		c.SetPermissionError(model.PermissionLmsManageWeeklyReviews)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var review *lms_models.WeeklyReview
	if err := json.NewDecoder(r.Body).Decode(&review); err != nil {
		c.Err = model.NewAppError("updateWeeklyReview", "api.lms.update_weekly_review.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	updated, err := c.App.LMS().UpdateWeeklyReview(id, review)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(LMSResponse{Data: updated}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteWeeklyReview(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageWeeklyReviews) {
		c.SetPermissionError(model.PermissionLmsManageWeeklyReviews)
		return
	}

	id := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if err := c.App.LMS().DeleteWeeklyReview(id); err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]bool{"data": true}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
