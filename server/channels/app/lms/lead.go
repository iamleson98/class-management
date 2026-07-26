package lms

import (
	"errors"
	"net/http"

	"github.com/aarondl/null/v8"
	"github.com/iamleson98/sitename/server/v8/channels/app/password/hashers"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

func (a *LMSApp) GetLead(id string) (*lms_models.Lead, *model.AppError) {
	lead, err := a.store.Lead().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetLead", "app.lms.lead.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetLead", "app.lms.lead.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return lead, nil
}

func (a *LMSApp) GetLeads(opts modelhelper.LeadFilterOpts) ([]*lms_models.Lead, int64, *model.AppError) {
	leads, totalCount, err := a.store.Lead().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetLeads", "app.lms.lead.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return leads, totalCount, nil
}

func (a *LMSApp) CreateLead(lead *lms_models.Lead) (*lms_models.Lead, *model.AppError) {
	saved, err := a.store.Lead().Save(lead)
	if err != nil {
		return nil, model.NewAppError("CreateLead", "app.lms.lead.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) UpdateLead(id string, lead *lms_models.Lead) (*lms_models.Lead, *model.AppError) {
	lead.ID = id
	updated, err := a.store.Lead().Update(lead)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateLead", "app.lms.lead.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateLead", "app.lms.lead.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return updated, nil
}

func (a *LMSApp) DeleteLead(id string) *model.AppError {
	err := a.store.Lead().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteLead", "app.lms.lead.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteLead", "app.lms.lead.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return nil
}

// ConvertLeadToStudent converts a lead into a student by creating a user with STUDENT role,
// updating the lead status to ENROLLED and setting the student_id.
func (a *LMSApp) ConvertLeadToStudent(leadID string) (*model.User, *lms_models.Lead, *model.AppError) {
	lead, appErr := a.GetLead(leadID)
	if appErr != nil {
		return nil, nil, appErr
	}

	// Hash the default password.
	hasher := hashers.NewBCrypt()
	hashed, err := hasher.Hash("Student@123")
	if err != nil {
		return nil, nil, model.NewAppError("ConvertLeadToStudent", "app.lms.lead.hash_password.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Create a user with lms_student role from the lead information. Use the
	// canonical lowercase role ID so the user matches the store's
	// `users.roles LIKE '%lms_student%'` filter used by SearchStudentUsers.
	user := &model.User{
		Username: lead.Email.String,
		Password: hashed,
		Email:    lead.Email.String,
		Roles:    model.RoleLmsStudentRoleId,
	}
		if lead.Phone.Valid {
			phoneStr := lead.Phone.String
			user.Phone = &phoneStr
		}
		if lead.Name != "" {
			user.FirstName = lead.Name
		}

	// TODO: Pass proper request.CTX when available.
	savedUser, err := a.store.User().Save(nil, user)
	if err != nil {
		return nil, nil, model.NewAppError("ConvertLeadToStudent", "app.lms.lead.create_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Update lead status to ENROLLED and set student_id.
		lead.Status = "ENROLLED"
		lead.StudentID = null.StringFrom(savedUser.Id)

	updatedLead, err := a.store.Lead().Update(lead)
	if err != nil {
		return nil, nil, model.NewAppError("ConvertLeadToStudent", "app.lms.lead.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return savedUser, updatedLead, nil
}
