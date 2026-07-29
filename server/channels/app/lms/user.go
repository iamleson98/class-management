package lms

import (
	"context"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

func (a *LMSApp) UpdateUser(user *model.User) (*model.User, *model.AppError) {
	// Load the existing user so partial updates (e.g. a role-only assignment)
	// merge onto the stored record instead of clobbering required fields like
	// Email/Username/Locale, which User.IsValid() rejects when empty.
	existing, gerr := a.store.User().Get(context.Background(), user.Id)
	if gerr != nil {
		if store.IsErrNotFound(gerr) {
			return nil, model.NewAppError("UpdateUser", "app.lms.user.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("UpdateUser", "app.lms.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(gerr)
	}

	// Merge only non-zero incoming fields onto the existing record.
	if user.Roles != "" {
		existing.Roles = user.Roles
	}
	if user.FirstName != "" {
		existing.FirstName = user.FirstName
	}
	if user.LastName != "" {
		existing.LastName = user.LastName
	}
	if user.Nickname != "" {
		existing.Nickname = user.Nickname
	}
	if user.Position != "" {
		existing.Position = user.Position
	}
	if user.Phone != nil && *user.Phone != "" {
		existing.Phone = user.Phone
	}
	if user.Email != "" {
		existing.Email = user.Email
	}
	if user.Username != "" {
		existing.Username = user.Username
	}

	// TODO: Call a.store.User().Update() — requires request.CTX which is not available in LMSApp.
	_, err := a.store.User().Update(nil, existing, true) // TODO: pass proper request.CTX
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("UpdateUser", "app.lms.user.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("UpdateUser", "app.lms.user.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return existing, nil
}

func (a *LMSApp) DeleteUser(id string) *model.AppError {
	// Check user exists
	_, err := a.store.User().Get(context.Background(), id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return model.NewAppError("DeleteUser", "app.lms.user.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return model.NewAppError("DeleteUser", "app.lms.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// TODO: Call a.store.User().PermanentDelete() — requires request.CTX which is not available in LMSApp.
	if err := a.store.User().PermanentDelete(nil, id); err != nil {
		return model.NewAppError("DeleteUser", "app.lms.user.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// DeactivateUser soft-deletes a user (sets DeleteAt to the current time) so the
// account can no longer log in, while preserving the record for reactivation.
// This mirrors Mattermost core's App.UpdateActive(user, false).
func (a *LMSApp) DeactivateUser(id string) (*model.User, *model.AppError) {
	user, err := a.store.User().Get(context.Background(), id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("DeactivateUser", "app.lms.user.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("DeactivateUser", "app.lms.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	now := model.GetMillis()
	user.UpdateAt = now
	user.DeleteAt = now

	updated, err := a.store.User().Update(nil, user, true) // TODO: pass proper request.CTX
	if err != nil {
		return nil, model.NewAppError("DeactivateUser", "app.lms.user.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if updated != nil && updated.New != nil {
		return updated.New, nil
	}
	return user, nil
}

// ReactivateUser clears the soft-delete (sets DeleteAt back to 0) so the user
// can log in again. Mirrors Mattermost core's App.UpdateActive(user, true).
func (a *LMSApp) ReactivateUser(id string) (*model.User, *model.AppError) {
	user, err := a.store.User().Get(context.Background(), id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("ReactivateUser", "app.lms.user.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("ReactivateUser", "app.lms.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	user.UpdateAt = model.GetMillis()
	user.DeleteAt = 0

	updated, err := a.store.User().Update(nil, user, true) // TODO: pass proper request.CTX
	if err != nil {
		return nil, model.NewAppError("ReactivateUser", "app.lms.user.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if updated != nil && updated.New != nil {
		return updated.New, nil
	}
	return user, nil
}
