package lms

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

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

	// maxUsernameAttempts caps username de-duplication retries
	// (base, base1, base2, ...) when the derived username is taken.
	maxUsernameAttempts = 20
)

// deriveUsernameFromEmail builds a Mattermost-valid username candidate from
// the local part of an email address: lower-cased, with any character outside
// [a-z0-9._-] replaced by '-'. Mirrors the employee flow (lms_api/user.go
// createUser) which derives the username from the email prefix, but adds
// sanitization so prefixes like "Nguyen.An+01" still produce a usable name
// ("nguyen.an-01").
func deriveUsernameFromEmail(email string) string {
	local, _, _ := strings.Cut(email, "@")
	local = strings.ToLower(local)
	var b strings.Builder
	for _, r := range local {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '.', r == '-', r == '_':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}
	return b.String()
}

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
	if user == nil {
		return nil, model.NewAppError("CreateStudent", "api.lms.create_student.bad_body.app_error", nil, "", http.StatusBadRequest)
	}
	if user.Email == "" {
		return nil, model.NewAppError("CreateStudent", "app.lms.student.email.app_error", nil, "", http.StatusBadRequest)
	}

	// The admin UI does not collect a username: derive one from the email
	// local-part (same convention as employee creation). PreSave() would
	// otherwise mint a random 26-char username, which is useless for the
	// username+password login students get (default Student@123).
	if user.Username == "" {
		candidate := deriveUsernameFromEmail(user.Email)
		if model.IsValidUsername(candidate) {
			user.Username = candidate
		}
		// An unusable candidate (e.g. 1-char local part) falls through with an
		// empty username and User.PreSave() mints a random valid one below.
	}

	// Set role to lms_student. Use the canonical lowercase role ID (not the
	// legacy uppercase "STUDENT" string) so the user matches the store's
	// `users.roles LIKE '%lms_student%'` filter used by SearchStudentUsers.
	user.Roles = model.RoleLmsStudentRoleId

	// Admin-created accounts are verified by definition (no email flow).
	user.EmailVerified = true

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

	saved, err := a.saveStudentWithUniqueUsername(user)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr) && invErr.Entity == "User" && invErr.Field == "email":
			return nil, model.NewAppError("CreateStudent", "app.lms.student.email_exists.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &invErr) && invErr.Entity == "User" && invErr.Field == "username":
			return nil, model.NewAppError("CreateStudent", "app.user.save.username_exists.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("CreateStudent", "app.lms.student.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	if m := a.app.Metrics(); m != nil {
		m.IncrementLMSStudentCreated()
	}
	return saved, nil
}

// saveStudentWithUniqueUsername saves the user, retrying with numeric
// username suffixes (base, base1, base2, ...) when the derived username is
// already taken — the same conflict resolution Mattermost applies for
// SSO/LDAP provisioned users. Other errors are returned untouched.
func (a *LMSApp) saveStudentWithUniqueUsername(user *model.User) (*model.User, error) {
	base := user.Username
	saved, err := a.store.User().Save(nil, user)
	for attempt := 1; ; attempt++ {
		if err == nil {
			return saved, nil
		}
		var invErr *store.ErrInvalidInput
		if !errors.As(err, &invErr) || invErr.Entity != "User" || invErr.Field != "username" || base == "" || attempt >= maxUsernameAttempts {
			return nil, err
		}
		// Save() rejected a preset non-remote Id earlier or PreSave() set one;
		// reset so the retry inserts a fresh row.
		user.Id = ""
		user.Username = fmt.Sprintf("%s%d", base, attempt)
		saved, err = a.store.User().Save(nil, user)
	}
}

func (a *LMSApp) UpdateStudent(user *model.User, props map[string]any) (*model.User, *model.AppError) {
	if user == nil {
		return nil, model.NewAppError("UpdateStudent", "api.lms.update_student.bad_body.app_error", nil, "", http.StatusBadRequest)
	}
	// Retrieve existing user
	existing, err := a.store.User().Get(context.Background(), user.Id)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("UpdateStudent", "app.lms.student.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("UpdateStudent", "app.lms.student.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// The admin UI sends a partial user (name/email/phone/parent/branch only —
	// no username, roles or locale), so merge the incoming non-zero fields onto
	// the stored record instead of clobbering them. Without this merge the
	// store's User.IsValid() rejects the update (empty username) and the edit
	// fails with a 500.
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
	if user.ParentId != nil && *user.ParentId != "" {
		existing.ParentId = user.ParentId
	}
	if user.Roles != "" {
		existing.Roles = user.Roles
	}
	existing.UpdateAt = model.GetMillis()

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
		if existing.Props == nil {
			existing.Props = make(model.StringMap)
		}
		existing.Props[studentPropsKey] = string(propsJSON)
	}

	updated, err := a.store.User().Update(nil, existing, true)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("UpdateStudent", "app.lms.student.not_found.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("UpdateStudent", "app.lms.student.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if updated != nil && updated.New != nil {
		return updated.New, nil
	}
	return existing, nil
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
