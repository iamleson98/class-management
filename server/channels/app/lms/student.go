package lms

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/app/password/hashers"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

// StudentFilterOpts defines filter options for querying students.

const (
	studentPropsKey        = "student"
	defaultStudentPassword = "Student@123"
)

func (a *LMSApp) GetStudent(id string) (*model.User, *model.AppError) {
	user, err := a.store.User().Get(context.Background(), id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("GetStudent", "app.lms.student.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("GetStudent", "app.lms.student.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return user, nil
}

func (a *LMSApp) GetStudents(opts modelhelper.StudentFilterOpts) ([]*model.User, *model.AppError) {
	// TODO: Implement student filtering via the store layer.
	// For now, retrieve all profiles and filter in-memory or use a dedicated store query.
	users, err := a.store.User().Search()
	if err != nil {
		return nil, model.NewAppError("GetStudents", "app.lms.student.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var students []*model.User
	for _, u := range users {
		roles := u.GetRoles()
		for _, r := range roles {
			if r == model.SystemUserRoleId || r == "STUDENT" {
				students = append(students, u)
				break
			}
		}
	}
	return students, nil
}

func (a *LMSApp) CreateStudent(user *model.User, props map[string]any) (*model.User, *model.AppError) {
	if user.Email == "" {
		return nil, model.NewAppError("CreateStudent", "app.lms.student.email.app_error", nil, "", http.StatusBadRequest)
	}
	if user.Username == "" {
		return nil, model.NewAppError("CreateStudent", "app.lms.student.username.app_error", nil, "", http.StatusBadRequest)
	}

	// Set role to STUDENT
	user.Roles = "STUDENT"

	// Hash the default password
	hasher := hashers.NewBCrypt()
	hashed, err := hasher.Hash(defaultStudentPassword)
	if err != nil {
		return nil, model.NewAppError("CreateStudent", "app.lms.student.hash_password.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	user.Password = hashed

	// Store student-specific props as JSON string under "student" key
	if props != nil {
		propsJSON, err := json.Marshal(props)
		if err != nil {
			return nil, model.NewAppError("CreateStudent", "app.lms.student.props_marshal.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		if user.Props == nil {
			user.Props = make(model.StringMap)
		}
		user.Props[studentPropsKey] = string(propsJSON)
	}

	// TODO: Call a.store.User().Save() — requires request.CTX which is not available in LMSApp.
	// This will need a thin wrapper or the LMSApp to carry a request context.
	saved, err := a.store.User().Save(nil, user) // TODO: pass proper request.CTX
	if err != nil {
		return nil, model.NewAppError("CreateStudent", "app.lms.student.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) UpdateStudent(user *model.User, props map[string]any) (*model.User, *model.AppError) {
	// Retrieve existing user
	existing, err := a.store.User().Get(context.Background(), user.Id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("UpdateStudent", "app.lms.student.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("UpdateStudent", "app.lms.student.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Update base user fields
	// TODO: Call a.store.User().Update() — requires request.CTX

	// Merge student props
	if props != nil {
		var existingProps map[string]any
		if existing.Props != nil {
			if raw, ok := existing.Props[studentPropsKey]; ok && raw != "" {
				if err := json.Unmarshal([]byte(raw), &existingProps); err != nil {
					existingProps = make(map[string]any)
				}
			}
		}
		if existingProps == nil {
			existingProps = make(map[string]any)
		}
		for k, v := range props {
			existingProps[k] = v
		}
		propsJSON, err := json.Marshal(existingProps)
		if err != nil {
			return nil, model.NewAppError("UpdateStudent", "app.lms.student.props_marshal.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		if user.Props == nil {
			user.Props = make(model.StringMap)
		}
		user.Props[studentPropsKey] = string(propsJSON)
	}

	// TODO: Call a.store.User().Update(nil, user, true) — requires request.CTX
	_, err = a.store.User().Update(nil, user, true) // TODO: pass proper request.CTX
	if err != nil {
		return nil, model.NewAppError("UpdateStudent", "app.lms.student.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return user, nil
}

func (a *LMSApp) DeleteStudent(id string) *model.AppError {
	// Check student exists
	_, err := a.store.User().Get(context.Background(), id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return model.NewAppError("DeleteStudent", "app.lms.student.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return model.NewAppError("DeleteStudent", "app.lms.student.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Cascade delete: student enrollments, attendance records, submissions
	studentClasses, err := a.store.StudentClass().GetByStudent(id)
	if err != nil {
		return model.NewAppError("DeleteStudent", "app.lms.student.get_enrollments.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for _, sc := range studentClasses {
		if err := a.store.StudentClass().Delete(sc.ID); err != nil {
			return model.NewAppError("DeleteStudent", "app.lms.student.delete_enrollment.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// TODO: Delete attendance records — requires an Attendance store method that deletes by student ID.
	// This will be added when the Attendance store supports DeleteByStudent.

	// TODO: Delete submissions — requires a Submission store method that deletes by student ID.
	// This will be added when the Submission store supports DeleteByStudent.

	// TODO: Delete user via a.store.User().PermanentDelete() — requires request.CTX
	if err := a.store.User().PermanentDelete(nil, id); err != nil {
		return model.NewAppError("DeleteStudent", "app.lms.student.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
