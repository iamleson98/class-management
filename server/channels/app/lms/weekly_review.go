package lms

import (
	"net/http"

	"github.com/iamleson98/sitename/server/v8/channels/store"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
)

func (a *LMSApp) GetWeeklyReview(id string) (*lms_models.WeeklyReview, *model.AppError) {
	review, err := a.store.WeeklyReview().Get(id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("GetWeeklyReview", "app.lms.weekly_review.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("GetWeeklyReview", "app.lms.weekly_review.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return review, nil
}

func (a *LMSApp) GetWeeklyReviews(opts modelhelper.WeeklyReviewFilterOpts) ([]*lms_models.WeeklyReview, *model.AppError) {
	reviews, err := a.store.WeeklyReview().GetAll(opts)
	if err != nil {
		return nil, model.NewAppError("GetWeeklyReviews", "app.lms.weekly_review.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return reviews, nil
}

func (a *LMSApp) CreateWeeklyReview(wr *lms_models.WeeklyReview) (*lms_models.WeeklyReview, *model.AppError) {
	result, err := a.store.WeeklyReview().Save(wr)
	if err != nil {
		return nil, model.NewAppError("CreateWeeklyReview", "app.lms.weekly_review.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}

func (a *LMSApp) UpdateWeeklyReview(id string, wr *lms_models.WeeklyReview) (*lms_models.WeeklyReview, *model.AppError) {
	wr.ID = id
	result, err := a.store.WeeklyReview().Update(wr)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("UpdateWeeklyReview", "app.lms.weekly_review.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("UpdateWeeklyReview", "app.lms.weekly_review.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}

func (a *LMSApp) DeleteWeeklyReview(id string) *model.AppError {
	_, err := a.store.WeeklyReview().Get(id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return model.NewAppError("DeleteWeeklyReview", "app.lms.weekly_review.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return model.NewAppError("DeleteWeeklyReview", "app.lms.weekly_review.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.store.WeeklyReview().Delete(id); err != nil {
		return model.NewAppError("DeleteWeeklyReview", "app.lms.weekly_review.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
