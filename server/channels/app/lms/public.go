package lms

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/aarondl/null/v8"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

func (a *LMSApp) GetPublicCourses() ([]*lms_models.Course, *model.AppError) {
	courses, err := a.store.Course().GetAll()
	if err != nil {
		return nil, model.NewAppError("GetPublicCourses", "app.lms.public.get_courses.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return courses, nil
}

func (a *LMSApp) GetPublicPosts() ([]*lms_models.BlogPost, *model.AppError) {
	posts, err := a.store.BlogPost().GetPublished()
	if err != nil {
		return nil, model.NewAppError("GetPublicPosts", "app.lms.public.get_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return posts, nil
}

func (a *LMSApp) PublicRegister(lead *lms_models.Lead) (*lms_models.Lead, *model.AppError) {
	lead.Status = "NEW"

	result, err := a.store.Lead().Save(lead)
	if err != nil {
		return nil, model.NewAppError("PublicRegister", "app.lms.public.register.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}

// ─── Password Reset ────────────────────────────────────────────────

// SendPasswordReset generates a reset token, stores it in user Props, and returns the token.
// In production, this would also send an email. For now it returns the token so the caller
// can construct the reset URL.
func (a *LMSApp) SendPasswordReset(email string) (token string, appErr *model.AppError) {
	user, err := a.store.User().GetByEmail(email)
	if err != nil {
		if store.IsErrNotFound(err) {
			// Don't reveal whether email exists — return success with empty token
			return "", nil
		}
		return "", model.NewAppError("SendPasswordReset", "app.lms.public.send_password_reset.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Generate 32-byte random token
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", model.NewAppError("SendPasswordReset", "app.lms.public.generate_token.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	token = hex.EncodeToString(b)
	expiry := time.Now().Add(1 * time.Hour).Unix()

	// Store token and expiry in user Props
	if user.Props == nil {
		user.Props = make(model.StringMap)
	}
	user.Props["reset_token"] = token
	user.Props["reset_token_expiry"] = time.Unix(expiry, 0).Format(time.RFC3339)

	// Use Update to save props changes (pass nil for request.CTX — see existing pattern)
	_, updateErr := a.store.User().Update(nil, user, false)
	if updateErr != nil {
		return "", model.NewAppError("SendPasswordReset", "app.lms.public.update_user.app_error", nil, "", http.StatusInternalServerError).Wrap(updateErr)
	}

	// TODO: Send email with reset link. For now the caller constructs the URL.
	return token, nil
}

// VerifyResetToken checks if a reset token is valid and not expired.
func (a *LMSApp) VerifyResetToken(token string) (valid bool, appErr *model.AppError) {
	if token == "" {
		return false, nil
	}

	// We need to find the user by reset_token in Props.
	// Since there's no direct index on Props, we iterate.
	users, err := a.store.User().GetAll()
	if err != nil {
		return false, model.NewAppError("VerifyResetToken", "app.lms.public.get_users.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, u := range users {
		storedToken := u.Props["reset_token"]
		storedExpiry := u.Props["reset_token_expiry"]
		if storedToken == token && storedExpiry != "" {
			expiry, parseErr := time.Parse(time.RFC3339, storedExpiry)
			if parseErr != nil {
				return false, nil
			}
			if time.Now().Before(expiry) {
				return true, nil
			}
			return false, nil // expired
		}
	}
	return false, nil // token not found
}

// ResetPassword sets a new password if the reset token is valid.
func (a *LMSApp) ResetPassword(token, newPassword string) *model.AppError {
	if token == "" || newPassword == "" {
		return model.NewAppError("ResetPassword", "app.lms.public.reset_password.missing.app_error", nil, "", http.StatusBadRequest)
	}

	users, err := a.store.User().GetAll()
	if err != nil {
		return model.NewAppError("ResetPassword", "app.lms.public.get_users.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, u := range users {
		storedToken := u.Props["reset_token"]
		storedExpiry := u.Props["reset_token_expiry"]
		if storedToken == token && storedExpiry != "" {
			expiry, parseErr := time.Parse(time.RFC3339, storedExpiry)
			if parseErr != nil || time.Now().After(expiry) {
				return model.NewAppError("ResetPassword", "app.lms.public.reset_password.expired.app_error", nil, "Token không hợp lệ hoặc đã hết hạn", http.StatusBadRequest)
			}

			// Update password and clear reset token
			if u.Props == nil {
				u.Props = make(model.StringMap)
			}
			delete(u.Props, "reset_token")
			delete(u.Props, "reset_token_expiry")

			// Update password via Update
			u.Password = newPassword
			_, updateErr := a.store.User().Update(nil, u, false)
			if updateErr != nil {
				return model.NewAppError("ResetPassword", "app.lms.public.update_password.app_error", nil, "", http.StatusInternalServerError).Wrap(updateErr)
			}
			return nil
		}
	}

	return model.NewAppError("ResetPassword", "app.lms.public.reset_password.invalid_token.app_error", nil, "Token không hợp lệ hoặc đã hết hạn", http.StatusBadRequest)
}

// ─── Contact Form ─────────────────────────────────────────────────

// SubmitContact creates a lead from the contact form data.
func (a *LMSApp) SubmitContact(name, email, phone, message string) (*lms_models.Lead, *model.AppError) {
	lead := &lms_models.Lead{
		Name:   name,
		Email:  null.StringFrom(email),
		Phone:  null.StringFrom(phone),
		Source: null.StringFrom("WEBSITE"),
		Status: "NEW",
		Notes:  null.StringFrom(message),
	}

	result, err := a.store.Lead().Save(lead)
	if err != nil {
		return nil, model.NewAppError("SubmitContact", "app.lms.public.contact.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}
