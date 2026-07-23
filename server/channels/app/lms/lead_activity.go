package lms

import (
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
)

func (a *LMSApp) GetLeadActivities(leadID string) ([]*lms_models.LeadActivity, *model.AppError) {
	activities, err := a.store.LeadActivity().GetByLead(leadID)
	if err != nil {
		return nil, model.NewAppError("GetLeadActivities", "app.lms.lead_activity.get_by_lead.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return activities, nil
}

func (a *LMSApp) CreateLeadActivity(leadID string, activity *lms_models.LeadActivity) (*lms_models.LeadActivity, *model.AppError) {
	activity.LeadID = leadID
	saved, err := a.store.LeadActivity().Save(activity)
	if err != nil {
		return nil, model.NewAppError("CreateLeadActivity", "app.lms.lead_activity.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}
