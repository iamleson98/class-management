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
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (a *LMSAPI) InitWeeklyReviews() {
	a.routes.Method(http.MethodGet, "/weekly-reviews", a.api.APISessionRequired(getWeeklyReviews))
	a.routes.Method(http.MethodPost, "/weekly-reviews", a.api.APISessionRequired(createWeeklyReview))
	a.routes.Method(http.MethodGet, "/weekly-reviews/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getWeeklyReview))
	a.routes.Method(http.MethodPut, "/weekly-reviews/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updateWeeklyReview))
	a.routes.Method(http.MethodDelete, "/weekly-reviews/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deleteWeeklyReview))
}

func getWeeklyReviews(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageWeeklyReviews) {
		c.SetPermissionError(model.PermissionLmsManageWeeklyReviews)
		return
	}

	q := r.URL.Query()
	opts := modelhelper.WeeklyReviewFilterOpts{
		StudentID: q.Get("student_id"),
		ClassID:   q.Get("class_id"),
	}
	if v := q.Get("page"); v != "" {
		opts.Page, _ = strconv.Atoi(v)
	}
	if v := q.Get("per_page"); v != "" {
		opts.PerPage, _ = strconv.Atoi(v)
	}
	if q.Get("count_total") == "true" {
		opts.CountTotal = true
	}

	reviews, err := c.App.LMS().GetWeeklyReviews(opts)
	if err != nil {
		c.Err = err
		return
	}

	if reviews == nil {
		reviews = []*lms_models.WeeklyReview{}
	}

	res := utils.ResponseList{Items: reviews}
	data, _ := json.Marshal(res)
	w.Write(data)
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
	data, _ := json.Marshal(LMSResponse{Data: created})
	w.Write(data)
}

func getWeeklyReview(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageWeeklyReviews) {
		c.SetPermissionError(model.PermissionLmsManageWeeklyReviews)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	review, err := c.App.LMS().GetWeeklyReview(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(LMSResponse{Data: review})
	w.Write(data)
}

func updateWeeklyReview(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageWeeklyReviews) {
		c.SetPermissionError(model.PermissionLmsManageWeeklyReviews)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

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

	data, _ := json.Marshal(LMSResponse{Data: updated})
	w.Write(data)
}

func deleteWeeklyReview(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManageWeeklyReviews) {
		c.SetPermissionError(model.PermissionLmsManageWeeklyReviews)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	if err := c.App.LMS().DeleteWeeklyReview(id); err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(`{"data":true}`))
}
