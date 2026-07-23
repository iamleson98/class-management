package api4

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	http_web "github.com/iamleson98/sitename/server/v8/channels/web"
	"github.com/iamleson98/sitename/server/v8/platform/shared/web"
)

func (api *API) InitCloud() {
	api.BaseRoutes.Cloud.Method(http.MethodGet, "/products", api.APISessionRequired(getCloudProducts))
	api.BaseRoutes.Cloud.Method(http.MethodGet, "/limits", api.APISessionRequired(getCloudLimits))
	api.BaseRoutes.Cloud.Method(http.MethodGet, "/customer", api.APISessionRequired(getCloudCustomer))
	api.BaseRoutes.Cloud.Method(http.MethodPut, "/customer", api.APISessionRequired(updateCloudCustomer))
	api.BaseRoutes.Cloud.Method(http.MethodPut, "/customer/address", api.APISessionRequired(updateCloudCustomerAddress))
	api.BaseRoutes.Cloud.Method(http.MethodGet, "/subscription", api.APISessionRequired(getSubscription))
	api.BaseRoutes.Cloud.Method(http.MethodGet, "/subscription/invoices", api.APISessionRequired(getInvoicesForSubscription))
	api.BaseRoutes.Cloud.Method(http.MethodGet, "/subscription/invoices/{invoice_id:[_A-Za-z0-9]+}/pdf", api.APISessionRequired(getSubscriptionInvoicePDF))
	api.BaseRoutes.Cloud.Method(http.MethodPost, "/validate-business-email", api.APISessionRequired(validateBusinessEmail))
	api.BaseRoutes.Cloud.Method(http.MethodPost, "/validate-workspace-business-email", api.APISessionRequired(validateWorkspaceBusinessEmail))
	api.BaseRoutes.Cloud.Method(http.MethodPost, "/webhook", api.CloudAPIKeyRequired(handleCWSWebhook))
	api.BaseRoutes.Cloud.Method(http.MethodGet, "/installation", api.APISessionRequired(getInstallation))
	api.BaseRoutes.Cloud.Method(http.MethodGet, "/check-cws-connection", api.APIHandler(handleCheckCWSConnection))
	api.BaseRoutes.Cloud.Method(http.MethodGet, "/preview/modal_data", api.APISessionRequired(getPreviewModalData))
}

func ensureCloudInterface(c *Context, where string) bool {
	cloud := c.App.Cloud()
	disabled := c.App.Config().CloudSettings.Disable != nil && *c.App.Config().CloudSettings.Disable
	if cloud == nil {
		c.Err = model.NewAppError(where, "api.server.cws.needs_enterprise_edition", nil, "", http.StatusBadRequest)
		return false
	}
	if disabled {
		c.Err = model.NewAppError(where, "api.server.cws.disabled", nil, "", http.StatusUnprocessableEntity)
		return false
	}
	return true
}

// func getPreviewSubscription(c *Context, w http.ResponseWriter, r *http.Request) {
// 	subscription := &model.Subscription{
// 		ID: "cloud-preview",

// 		IsFreeTrial:    "true",
// 		IsCloudPreview: true,
// 	}

// 	json, err := json.Marshal(subscription)
// 	if err != nil {
// 		c.Err = model.NewAppError("Api4.getSubscription", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(err)
// 		return
// 	}

// 	if _, err := w.Write(json); err != nil {
// 		c.Logger.Warn("Error while writing response", mlog.Err(err))
// 	}
// }

func getSubscription(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.getSubscription")
	if !ensured {
		return
	}

	subscription, err := c.App.Cloud().GetSubscription(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = model.NewAppError("Api4.getSubscription", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// if it is an end user, return basic subscription data without sensitive information
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadBilling) {
		subscription = &model.Subscription{
			ID:              subscription.ID,
			ProductID:       subscription.ProductID,
			IsFreeTrial:     subscription.IsFreeTrial,
			TrialEndAt:      subscription.TrialEndAt,
			EndAt:           subscription.EndAt,
			CancelAt:        subscription.CancelAt,
			DelinquentSince: subscription.DelinquentSince,
			CustomerID:      "",
			AddOns:          []string{},
			StartAt:         0,
			CreateAt:        0,
			Seats:           0,
			Status:          "",
			DNS:             "",
			LastInvoice:     &model.Invoice{},
			BillingType:     "",
		}
	}

	if model.GetServiceEnvironment() != model.ServiceEnvironmentTest {
		subscription.SimulatedCurrentTimeMs = nil
	}

	if !c.App.Config().FeatureFlags.CloudAnnualRenewals {
		subscription.WillRenew = ""
		subscription.CancelAt = nil
	}

	json, err := json.Marshal(subscription)
	if err != nil {
		c.Err = model.NewAppError("Api4.getSubscription", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(json); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func validateBusinessEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.validateBusinessEmail")
	if !ensured {
		return
	}

	user, appErr := c.App.GetUser(c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.validateBusinessEmail", "api.cloud.request_error", nil, "", http.StatusForbidden).Wrap(appErr)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.requestCloudTrial", "api.cloud.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	var emailToValidate *model.ValidateBusinessEmailRequest
	err = json.Unmarshal(bodyBytes, &emailToValidate)
	if err != nil || emailToValidate == nil {
		c.Err = model.NewAppError("Api4.requestCloudTrial", "api.cloud.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	err = c.App.Cloud().ValidateBusinessEmail(user.Id, emailToValidate.Email)
	if err != nil {
		c.Err = model.NewAppError("Api4.validateBusinessEmail", "api.cloud.request_error", nil, "", http.StatusForbidden).Wrap(err)
		emailResp := model.ValidateBusinessEmailResponse{IsValid: false}
		if err := json.NewEncoder(w).Encode(emailResp); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}
	emailResp := model.ValidateBusinessEmailResponse{IsValid: true}
	if err := json.NewEncoder(w).Encode(emailResp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func validateWorkspaceBusinessEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.validateWorkspaceBusinessEmail")
	if !ensured {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteBilling) {
		c.SetPermissionError(model.PermissionSysconsoleWriteBilling)
		return
	}

	user, userErr := c.App.GetUser(c.AppContext.Session().UserId)
	if userErr != nil {
		c.Err = userErr
		return
	}

	// get the cloud customer email to validate if is a valid business email
	cloudCustomer, err := c.App.Cloud().GetCloudCustomer(user.Id)
	if err != nil {
		c.Err = model.NewAppError("Api4.validateWorkspaceBusinessEmail", "api.cloud.request_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	emailErr := c.App.Cloud().ValidateBusinessEmail(user.Id, cloudCustomer.Email)

	// if the current workspace email is not a valid business email
	if emailErr != nil {
		// grab the current admin email and validate it
		errValidatingAdminEmail := c.App.Cloud().ValidateBusinessEmail(user.Id, user.Email)
		if errValidatingAdminEmail != nil {
			c.Err = model.NewAppError("Api4.validateWorkspaceBusinessEmail", "api.cloud.request_error", nil, "", http.StatusForbidden).Wrap(errValidatingAdminEmail)
			emailResp := model.ValidateBusinessEmailResponse{IsValid: false}
			if err := json.NewEncoder(w).Encode(emailResp); err != nil {
				c.Logger.Warn("Error while writing response", mlog.Err(err))
			}
			return
		}
	}

	// if any of the emails is valid, return ok
	emailResp := model.ValidateBusinessEmailResponse{IsValid: true}
	if err := json.NewEncoder(w).Encode(emailResp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getCloudProducts(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.getCloudProducts")
	if !ensured {
		return
	}

	includeLegacyProducts := r.URL.Query().Get("include_legacy") == "true"

	products, err := c.App.Cloud().GetCloudProducts(c.AppContext.Session().UserId, includeLegacyProducts)
	if err != nil {
		c.Err = model.NewAppError("Api4.getCloudProducts", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	byteProductsData, err := json.Marshal(products)
	if err != nil {
		c.Err = model.NewAppError("Api4.getCloudProducts", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadBilling) {
		sanitizedProducts := []model.UserFacingProduct{}
		err = json.Unmarshal(byteProductsData, &sanitizedProducts)
		if err != nil {
			c.Err = model.NewAppError("Api4.getCloudProducts", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}

		byteSanitizedProductsData, err := json.Marshal(sanitizedProducts)
		if err != nil {
			c.Err = model.NewAppError("Api4.getCloudProducts", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}

		if _, err := w.Write(byteSanitizedProductsData); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	if _, err := w.Write(byteProductsData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getCloudLimits(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.getCloudLimits")
	if !ensured {
		return
	}

	limits, err := c.App.Cloud().GetCloudLimits(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = model.NewAppError("Api4.getCloudLimits", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	json, err := json.Marshal(limits)
	if err != nil {
		c.Err = model.NewAppError("Api4.getCloudLimits", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(json); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getCloudCustomer(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.getCloudCustomer")
	if !ensured {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadBilling) {
		c.SetPermissionError(model.PermissionSysconsoleReadBilling)
		return
	}

	customer, err := c.App.Cloud().GetCloudCustomer(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = model.NewAppError("Api4.getCloudCustomer", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	json, err := json.Marshal(customer)
	if err != nil {
		c.Err = model.NewAppError("Api4.getCloudCustomer", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(json); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getInstallation(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.getInstallation")
	if !ensured {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadIPFilters) {
		c.SetPermissionError(model.PermissionSysconsoleReadIPFilters)
		return
	}

	installation, err := c.App.Cloud().GetInstallation(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = model.NewAppError("Api4.getInstallation", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if err := json.NewEncoder(w).Encode(installation); err != nil {
		c.Err = model.NewAppError("Api4.getInstallation", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
}

func updateCloudCustomer(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.updateCloudCustomer")
	if !ensured {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteBilling) {
		c.SetPermissionError(model.PermissionSysconsoleWriteBilling)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomer", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	var customerInfo *model.CloudCustomerInfo
	if err = json.Unmarshal(bodyBytes, &customerInfo); err != nil || customerInfo == nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomer", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	customer, appErr := c.App.Cloud().UpdateCloudCustomer(c.AppContext.Session().UserId, customerInfo)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomer", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	json, err := json.Marshal(customer)
	if err != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomer", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(json); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateCloudCustomerAddress(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.updateCloudCustomerAddress")
	if !ensured {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteBilling) {
		c.SetPermissionError(model.PermissionSysconsoleWriteBilling)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomerAddress", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	var address *model.Address
	if err = json.Unmarshal(bodyBytes, &address); err != nil || address == nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomerAddress", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	customer, appErr := c.App.Cloud().UpdateCloudCustomerAddress(c.AppContext.Session().UserId, address)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomerAddress", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	json, err := json.Marshal(customer)
	if err != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomerAddress", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(json); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getInvoicesForSubscription(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.getInvoicesForSubscription")
	if !ensured {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadBilling) {
		c.SetPermissionError(model.PermissionSysconsoleReadBilling)
		return
	}

	invoices, appErr := c.App.Cloud().GetInvoicesForSubscription(c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getInvoicesForSubscription", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	json, err := json.Marshal(invoices)
	if err != nil {
		c.Err = model.NewAppError("Api4.getInvoicesForSubscription", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(json); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getSubscriptionInvoicePDF(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.getSubscriptionInvoicePDF")
	if !ensured {
		return
	}

	invoiceId := c.RequireParam("invoice_id", http_web.RequireValidId)
	if c.Err != nil {
		return
	}
	invoiceIdStr := invoiceId.(string)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadBilling) {
		c.SetPermissionError(model.PermissionSysconsoleReadBilling)
		return
	}

	pdfData, filename, appErr := c.App.Cloud().GetInvoicePDF(c.AppContext.Session().UserId, invoiceIdStr)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getSubscriptionInvoicePDF", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	web.WriteFileResponse(
		filename,
		"application/pdf",
		int64(binary.Size(pdfData)),
		time.Now(),
		*c.App.Config().ServiceSettings.WebserverMode,
		bytes.NewReader(pdfData),
		false,
		w,
		r,
	)
}

func handleCWSWebhook(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.handleCWSWebhook")
	if !ensured {
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.handleCWSWebhook", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	defer r.Body.Close()

	var event *model.CWSWebhookPayload
	if err = json.Unmarshal(bodyBytes, &event); err != nil || event == nil {
		c.Err = model.NewAppError("Api4.handleCWSWebhook", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	switch event.Event {
	case model.EventTypeSendAdminWelcomeEmail:
		user, appErr := c.App.GetUserByUsername(event.CloudWorkspaceOwner.UserName)
		if appErr != nil {
			c.Err = model.NewAppError("Api4.handleCWSWebhook", appErr.Id, nil, "", appErr.StatusCode).Wrap(appErr)
			return
		}

		teams, appErr := c.App.GetAllTeams()
		if appErr != nil {
			c.Err = model.NewAppError("Api4.handleCWSWebhook", appErr.Id, nil, "", appErr.StatusCode).Wrap(appErr)
			return
		}

		team := teams[0]

		subscription, err := c.App.Cloud().GetSubscription(user.Id)
		if err != nil {
			c.Err = model.NewAppError("Api4.handleCWSWebhook", "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}

		if err := c.App.Srv().EmailService.SendCloudWelcomeEmail(user.Email, user.Locale, team.InviteId, subscription.GetWorkSpaceNameFromDNS(), subscription.DNS, *c.App.Config().ServiceSettings.SiteURL); err != nil {
			c.Err = model.NewAppError("SendCloudWelcomeEmail", "api.user.send_cloud_welcome_email.error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}
	default:
		c.Err = model.NewAppError("Api4.handleCWSWebhook", "api.cloud.cws_webhook_event_missing_error", nil, "", http.StatusNotFound)
		return
	}

	ReturnStatusOK(w)
}

func handleCheckCWSConnection(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureCloudInterface(c, "Api4.handleCheckCWSConnection")
	if !ensured {
		return
	}

	status := "available"
	if err := c.App.Cloud().CheckCWSConnection(c.AppContext.Session().UserId); err != nil {
		status = "unavailable"
	}

	response := map[string]string{"status": status}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Err = model.NewAppError("Api4.handleCheckCWSConnection", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
}

func getPreviewModalData(c *Context, w http.ResponseWriter, r *http.Request) {
	modalData, err := c.App.GetPreviewModalData()
	if err != nil {
		c.Err = err
		return
	}

	responseData, jsonErr := json.Marshal(modalData)
	if jsonErr != nil {
		c.Err = model.NewAppError("Api4.getPreviewModalData", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		return
	}

	if _, writeErr := w.Write(responseData); writeErr != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(writeErr))
	}
}
