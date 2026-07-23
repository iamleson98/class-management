package lms

import (
	"context"
	"net/http"

	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/iamleson98/sitename/server/public/model"
)

// UserFilterOpts defines filter options for querying users.
type UserFilterOpts struct {
	Role       string
	Page       int
	PerPage    int
	CountTotal bool
}

func (a *LMSApp) GetUser(id string) (*model.User, *model.AppError) {
	user, err := a.store.User().Get(context.Background(), id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("GetUser", "app.lms.user.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("GetUser", "app.lms.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return user, nil
}

func (a *LMSApp) GetUsers(opts UserFilterOpts) ([]*model.User, *model.AppError) {
	// TODO: Use model.UserGetOptions with Role filter once the store supports it.
	// For now, retrieve all profiles and filter by role in-memory.
	users, err := a.store.User().GetAll()
	if err != nil {
		return nil, model.NewAppError("GetUsers", "app.lms.user.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if opts.Role == "" {
		return users, nil
	}

	var filtered []*model.User
	for _, u := range users {
		roles := u.GetRoles()
		for _, r := range roles {
			if r == opts.Role {
				filtered = append(filtered, u)
				break
			}
		}
	}
	return filtered, nil
}

func (a *LMSApp) CreateUser(user *model.User) (*model.User, *model.AppError) {
	if user.Email == "" {
		return nil, model.NewAppError("CreateUser", "app.lms.user.email.app_error", nil, "", http.StatusBadRequest)
	}
	if user.Username == "" {
		return nil, model.NewAppError("CreateUser", "app.lms.user.username.app_error", nil, "", http.StatusBadRequest)
	}

	// TODO: Call a.store.User().Save() — requires request.CTX which is not available in LMSApp.
	saved, err := a.store.User().Save(nil, user) // TODO: pass proper request.CTX
	if err != nil {
		return nil, model.NewAppError("CreateUser", "app.lms.user.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) UpdateUser(user *model.User) (*model.User, *model.AppError) {
	// TODO: Call a.store.User().Update() — requires request.CTX which is not available in LMSApp.
	_, err := a.store.User().Update(nil, user, true) // TODO: pass proper request.CTX
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("UpdateUser", "app.lms.user.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("UpdateUser", "app.lms.user.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return user, nil
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
