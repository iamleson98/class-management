package lmsapi

import (
	"encoding/json"
	"net/http"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
)

func (a *LMSAPI) InitPublic() {
	a.routes.Method(http.MethodGet, "/public/courses", a.api.APIHandler(getPublicCourses))
	a.routes.Method(http.MethodGet, "/public/posts", a.api.APIHandler(getPublicPosts))
	a.routes.Method(http.MethodPost, "/public/register", a.api.APIHandler(publicRegister))
	a.routes.Method(http.MethodPost, "/public/contact", a.api.APIHandler(publicContact))
	a.routes.Method(http.MethodPost, "/public/forgot-password", a.api.APIHandler(forgotPassword))
	a.routes.Method(http.MethodPost, "/public/reset-password", a.api.APIHandler(resetPassword))
	a.routes.Method(http.MethodGet, "/public/verify-token", a.api.APIHandler(verifyResetToken))
}

func getPublicCourses(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	courses, err := c.App.LMS().GetPublicCourses()
	if err != nil {
		c.Err = err
		return
	}

	if courses == nil {
		courses = []*lms_models.Course{}
	}

	data, _ := json.Marshal(utils.ResponseList{Items: courses})
	w.Write(data)
}

func getPublicPosts(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	posts, err := c.App.LMS().GetPublicPosts()
	if err != nil {
		c.Err = err
		return
	}
	if posts == nil {
		posts = []*lms_models.BlogPost{}
	}

	data, _ := json.Marshal(utils.ResponseList{Items: posts})
	w.Write(data)
}

func publicRegister(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	var lead lms_models.Lead
	if err := json.NewDecoder(r.Body).Decode(&lead); err != nil {
		c.Err = model.NewAppError("publicRegister", "api.lms.public.register.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().PublicRegister(&lead)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// Contact form handler
func publicContact(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Phone   string `json:"phone"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.Err = model.NewAppError("publicContact", "api.lms.public.contact.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	if body.Name == "" || body.Message == "" {
		c.Err = model.NewAppError("publicContact", "api.lms.public.contact.missing_fields.app_error", nil, "", http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().SubmitContact(body.Name, body.Email, body.Phone, body.Message)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(created)
	w.Write(data)
}

// Forgot password — sends reset token (in production this would also send an email)
func forgotPassword(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.Err = model.NewAppError("forgotPassword", "api.lms.public.forgot_password.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	if body.Email == "" {
		c.Err = model.NewAppError("forgotPassword", "api.lms.public.forgot_password.missing_email.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// Always returns success to avoid revealing whether email exists
	_, err := c.App.LMS().SendPasswordReset(body.Email)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(map[string]any{
		"success": true,
		"message": "Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu",
	})
	w.Write(data)
}

// Reset password — sets new password using reset token
func resetPassword(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.Err = model.NewAppError("resetPassword", "api.lms.public.reset_password.bad_body.app_error", map[string]any{"error": err.Error()}, "", http.StatusBadRequest)
		return
	}

	if err := c.App.LMS().ResetPassword(body.Token, body.Password); err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(map[string]any{
		"success": true,
		"message": "Đặt lại mật khẩu thành công",
	})
	w.Write(data)
}

// Verify reset token — checks if token is valid and not expired
func verifyResetToken(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")

	valid, err := c.App.LMS().VerifyResetToken(token)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(map[string]any{
		"valid": valid,
	})
	w.Write(data)
}
