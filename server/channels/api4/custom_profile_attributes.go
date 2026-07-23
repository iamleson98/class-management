package api4

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitCustomProfileAttributes() {
	if api.srv.Config().FeatureFlags.CustomProfileAttributes {
		api.BaseRoutes.CustomProfileAttributesFields.Method(http.MethodGet, "/", api.APISessionRequired(listCPAFields))
		api.BaseRoutes.CustomProfileAttributesFields.Method(http.MethodPost, "/", api.APISessionRequired(createCPAField))
		api.BaseRoutes.CustomProfileAttributesField.Method(http.MethodPatch, "/", api.APISessionRequired(patchCPAField))
		api.BaseRoutes.CustomProfileAttributesField.Method(http.MethodDelete, "/", api.APISessionRequired(deleteCPAField))
		api.BaseRoutes.User.Method(http.MethodGet, "/custom_profile_attributes", api.APISessionRequired(listCPAValues))
		api.BaseRoutes.CustomProfileAttributesValues.Method(http.MethodPatch, "/", api.APISessionRequired(patchCPAValues))
		api.BaseRoutes.CustomProfileAttributes.Method(http.MethodGet, "/group", api.APISessionRequired(getCPAGroup))
		api.BaseRoutes.User.Method(http.MethodPatch, "/custom_profile_attributes", api.APISessionRequired(patchCPAValuesForUser))
	}
}

func listCPAFields(c *Context, w http.ResponseWriter, r *http.Request) {

	callerUserID := c.AppContext.Session().UserId
	fields, appErr := c.App.ListCPAFields(callerUserID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(fields); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createCPAField(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	var pf *model.CPAField
	err := json.NewDecoder(r.Body).Decode(&pf)
	if err != nil || pf == nil {
		c.SetInvalidParamWithErr("property_field", err)
		return
	}

	pf.Name = strings.TrimSpace(pf.Name)

	auditRec := c.MakeAuditRecord(model.AuditEventCreateCPAField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field", pf)

	callerUserID := c.AppContext.Session().UserId
	createdField, appErr := c.App.CreateCPAField(callerUserID, pf)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(createdField)
	auditRec.AddEventObjectType("property_field")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(createdField); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchCPAField(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	fieldId := c.RequireParam("field_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	fieldIdStr := fieldId.(string)

	var patch *model.PropertyFieldPatch
	err := json.NewDecoder(r.Body).Decode(&patch)
	if err != nil || patch == nil {
		c.SetInvalidParamWithErr("property_field_patch", err)
		return
	}

	if patch.Name != nil {
		*patch.Name = strings.TrimSpace(*patch.Name)
	}
	if err := patch.IsValid(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			c.Err = appErr
		} else {
			c.Err = model.NewAppError("createCPAField", "api.custom_profile_attributes.invalid_field_patch", nil, "", http.StatusBadRequest)
		}
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchCPAField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field_patch", patch)

	callerUserID := c.AppContext.Session().UserId
	originalField, appErr := c.App.GetCPAField(callerUserID, fieldIdStr)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventPriorState(originalField)

	patchedField, appErr := c.App.PatchCPAField(callerUserID, fieldIdStr, patch)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(patchedField)
	auditRec.AddEventObjectType("property_field")

	if err := json.NewEncoder(w).Encode(patchedField); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteCPAField(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	fieldId := c.RequireParam("field_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	fieldIdStr := fieldId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteCPAField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "field_id", fieldIdStr)

	callerUserID := c.AppContext.Session().UserId
	field, appErr := c.App.GetCPAField(callerUserID, fieldIdStr)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddEventPriorState(field)

	if appErr := c.App.DeleteCPAField(callerUserID, fieldIdStr); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(field)
	auditRec.AddEventObjectType("property_field")

	ReturnStatusOK(w)
}

func getCPAGroup(c *Context, w http.ResponseWriter, r *http.Request) {

	groupID, err := c.App.CpaGroupID()
	if err != nil {
		c.Err = model.NewAppError("Api4.getCPAGroup", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]string{"id": groupID}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchCPAValues(c *Context, w http.ResponseWriter, r *http.Request) {

	userID := c.AppContext.Session().UserId
	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userID) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	var updates map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		c.SetInvalidParamWithErr("value", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchCPAValues, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "user_id", userID)

	// if the user is not an admin, we need to check that there are no
	// admin-managed fields
	session := *c.AppContext.Session()
	if !c.App.SessionHasPermissionTo(session, model.PermissionManageSystem) {
		fields, appErr := c.App.ListCPAFields(session.UserId)
		if appErr != nil {
			c.Err = appErr
			return
		}

		// Check if any of the fields being updated are admin-managed
		for _, field := range fields {
			if _, isBeingUpdated := updates[field.ID]; isBeingUpdated {
				if field.IsAdminManaged() {
					c.Err = model.NewAppError("Api4.patchCPAValues", "app.custom_profile_attributes.property_field_is_managed.app_error", nil, "", http.StatusForbidden)
					return
				}
			}
		}
	}

	callerUserID := c.AppContext.Session().UserId
	results := make(map[string]json.RawMessage, len(updates))
	for fieldID, rawValue := range updates {
		patchedValue, appErr := c.App.PatchCPAValue(callerUserID, userID, fieldID, rawValue, false)
		if appErr != nil {
			c.Err = appErr
			return
		}
		results[fieldID] = patchedValue.Value
	}

	auditRec.Success()
	auditRec.AddEventObjectType("patchCPAValues")

	if err := json.NewEncoder(w).Encode(results); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func listCPAValues(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	callerUserID := c.AppContext.Session().UserId

	// we check unrestricted sessions to allow local mode requests to go through
	if !c.AppContext.Session().IsUnrestricted() {
		canSee, err := c.App.UserCanSeeOtherUser(c.AppContext, callerUserID, userIdStr)
		if err != nil || !canSee {
			c.SetPermissionError(model.PermissionViewMembers)
			return
		}
	}

	values, appErr := c.App.ListCPAValues(callerUserID, userIdStr)
	if appErr != nil {
		c.Err = appErr
		return
	}

	returnValue := make(map[string]json.RawMessage)
	for _, value := range values {
		returnValue[value.FieldID] = value.Value
	}
	if err := json.NewEncoder(w).Encode(returnValue); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchCPAValuesForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	var updates map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		c.SetInvalidParamWithErr("value", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchCPAValues, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "user_id", userIdStr)

	// Check for admin-managed fields
	session := *c.AppContext.Session()
	isAdmin := c.App.SessionHasPermissionTo(session, model.PermissionManageSystem)
	if !isAdmin {
		fields, appErr := c.App.ListCPAFields(session.UserId)
		if appErr != nil {
			c.Err = appErr
			return
		}

		for _, field := range fields {
			if _, isBeingUpdated := updates[field.ID]; !isBeingUpdated {
				continue
			}
			// Check for admin-managed fields
			if field.IsAdminManaged() {
				c.Err = model.NewAppError("Api4.patchCPAValuesForUser",
					"app.custom_profile_attributes.property_field_is_managed.app_error",
					nil, "",
					http.StatusForbidden)
				return
			}
		}
	}

	callerUserID := c.AppContext.Session().UserId
	results := make(map[string]json.RawMessage, len(updates))
	for fieldID, rawValue := range updates {
		patchedValue, appErr := c.App.PatchCPAValue(callerUserID, userIdStr, fieldID, rawValue, false)
		if appErr != nil {
			c.Err = appErr
			return
		}
		results[fieldID] = patchedValue.Value
	}

	auditRec.Success()
	auditRec.AddEventObjectType("patchCPAValues")

	if err := json.NewEncoder(w).Encode(results); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
