package lms

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/lms_models"
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

func (a *LMSApp) GetStudents(opts modelhelper.StudentFilterOpts) (lms_models.UserSlice, int64, *model.AppError) {
	users, totalCount, err := a.store.StudentClass().SearchStudentUsers(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetStudents", "app.lms.student.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, totalCount, nil
}

func (a *LMSApp) CreateStudent(user *model.User, props map[string]any) (*model.User, *model.AppError) {
	if user.Email == "" {
		return nil, model.NewAppError("CreateStudent", "app.lms.student.email.app_error", nil, "", http.StatusBadRequest)
	}
	if user.Username == "" {
		return nil, model.NewAppError("CreateStudent", "app.lms.student.username.app_error", nil, "", http.StatusBadRequest)
	}

	// Set role to lms_student. Use the canonical lowercase role ID (not the
	// legacy uppercase "STUDENT" string) so the user matches the store's
	// `users.roles LIKE '%lms_student%'` filter used by SearchStudentUsers.
	user.Roles = model.RoleLmsStudentRoleId

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

// GetConvertibleUsers returns users that are NOT currently students and are not
// deactivated, i.e. the set of users a counselor can convert into students.
func (a *LMSApp) GetConvertibleUsers() ([]*model.User, *model.AppError) {
	users, err := a.store.User().GetAll()
	if err != nil {
		return nil, model.NewAppError("GetConvertibleUsers", "app.lms.student.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	convertible := make([]*model.User, 0, len(users))
	for _, u := range users {
		// Skip deactivated users.
		if u.DeleteAt != 0 {
			continue
		}
		// Skip existing students.
		if u.IsInRole(model.RoleLmsStudentRoleId) {
			continue
		}
		convertible = append(convertible, u)
	}
	return convertible, nil
}

// ConvertUserToStudent promotes an existing user to a student by setting the
// lms_student role. The user's existing password and props are preserved
// (unlike CreateStudent, which creates a brand-new row with a default password).
func (a *LMSApp) ConvertUserToStudent(userID string) (*model.User, *model.AppError) {
	user, err := a.store.User().Get(context.Background(), userID)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("ConvertUserToStudent", "app.lms.student.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("ConvertUserToStudent", "app.lms.student.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Keep the base system_user role and swap any staff roles for the student role.
	user.Roles = model.SystemUserRoleId + " " + model.RoleLmsStudentRoleId

	_, err = a.store.User().Update(nil, user, true) // TODO: pass proper request.CTX
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("ConvertUserToStudent", "app.lms.student.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("ConvertUserToStudent", "app.lms.student.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return user, nil
}

// RevertStudentToUser demotes a student back to a regular user by removing the
// lms_student role and clearing the student-specific props key.
func (a *LMSApp) RevertStudentToUser(studentID string) (*model.User, *model.AppError) {
	user, err := a.store.User().Get(context.Background(), studentID)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("RevertStudentToUser", "app.lms.student.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("RevertStudentToUser", "app.lms.student.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	user.Roles = model.SystemUserRoleId

	// Clear the student-specific props key if present.
	if user.Props != nil {
		if _, ok := user.Props[studentPropsKey]; ok {
			delete(user.Props, studentPropsKey)
		}
	}

	_, err = a.store.User().Update(nil, user, true) // TODO: pass proper request.CTX
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("RevertStudentToUser", "app.lms.student.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("RevertStudentToUser", "app.lms.student.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return user, nil
}
