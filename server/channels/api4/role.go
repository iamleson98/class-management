package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

const GetRolesByNamesMax = 100

var notAllowedPermissions = []string{
	model.PermissionSysconsoleWriteUserManagementSystemRoles.Id,
	model.PermissionSysconsoleReadUserManagementSystemRoles.Id,
	model.PermissionManageRoles.Id,
	model.PermissionManageSystem.Id,
}

func (api *API) InitRole() {
	api.BaseRoutes.Roles.Method(http.MethodGet, "/", api.APISessionRequired(getAllRoles))
	api.BaseRoutes.Roles.Method(http.MethodGet, "/{role_id:[A-Za-z0-9]+}", api.APISessionRequiredTrustRequester(getRole))
	api.BaseRoutes.Roles.Method(http.MethodGet, "/name/{role_name:[a-z0-9_]+}", api.APISessionRequiredTrustRequester(getRoleByName))
	api.BaseRoutes.Roles.Method(http.MethodPost, "/names", api.APISessionRequiredTrustRequester(getRolesByNames))
	api.BaseRoutes.Roles.Method(http.MethodPut, "/{role_id:[A-Za-z0-9]+}/patch", api.APISessionRequired(patchRole))
}

func getAllRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	roles, appErr := c.App.GetAllRoles()
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(roles)
	if err != nil {
		c.Err = model.NewAppError("getAllRoles", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
		return
	}
}

func getRole(c *Context, w http.ResponseWriter, r *http.Request) {
	roleId := c.RequireParam("role_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	roleIdStr := roleId.(string)

	role, err := c.App.GetRole(roleIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(role); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getRoleByName(c *Context, w http.ResponseWriter, r *http.Request) {
	roleName := c.RequireParam("role_name", web.RequireString)
	if c.Err != nil {
		return
	}
	roleNameStr := roleName.(string)

	role, err := c.App.GetRoleByName(c.AppContext, roleNameStr)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(role); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getRolesByNames(c *Context, w http.ResponseWriter, r *http.Request) {
	rolenames, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getRolesByNames", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(rolenames) == 0 {
		c.SetInvalidParam("rolenames")
		return
	}

	if len(rolenames) > GetRolesByNamesMax {
		c.Err = model.NewAppError("getRolesByNames", "api.roles.get_multiple_by_name_too_many.request_error", map[string]any{
			"MaxNames": GetRolesByNamesMax,
		}, "", http.StatusBadRequest)
		return
	}

	cleanedRoleNames, valid := model.CleanRoleNames(rolenames)
	if !valid {
		c.SetInvalidParam("rolename")
		return
	}

	roles, appErr := c.App.GetRolesByNames(cleanedRoleNames)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(roles)
	if err != nil {
		c.Err = model.NewAppError("getRolesByNames", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
		return
	}
}

func patchRole(c *Context, w http.ResponseWriter, r *http.Request) {
	roleId := c.RequireParam("role_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	roleIdStr := roleId.(string)

	var patch model.RolePatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		c.SetInvalidParamWithErr("role", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchRole, model.AuditStatusFail)
	model.AddEventParameterAuditableToAuditRec(auditRec, "role_patch", &patch)
	defer c.LogAuditRec(auditRec)

	oldRole, appErr := c.App.GetRole(roleIdStr)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddEventPriorState(oldRole)
	auditRec.AddEventObjectType("role")

	// manage_system permission is required to patch system_admin
	requiredPermission := model.PermissionSysconsoleWriteUserManagementPermissions
	specialProtectedSystemRoles := append(model.NewSystemRoleIDs, model.SystemAdminRoleId)
	for _, roleID := range specialProtectedSystemRoles {
		if oldRole.Name == roleID {
			requiredPermission = model.PermissionManageSystem
		}
	}
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), requiredPermission) {
		c.SetPermissionError(requiredPermission)
		return
	}

	isGuest := oldRole.Name == model.SystemGuestRoleId || oldRole.Name == model.TeamGuestRoleId || oldRole.Name == model.ChannelGuestRoleId
	if patch.Permissions != nil {
		if isGuest {
			c.Err = model.NewAppError("Api4.PatchRoles", "api.roles.patch_roles.license.error", nil, "", http.StatusNotImplemented)
			return
		}
	}

	// Licensed instances can not change permissions in the blacklist set.
	if patch.Permissions != nil {
		deltaPermissions := model.PermissionsChangedByPatch(oldRole, &patch)

		for _, permission := range deltaPermissions {
			notAllowed := false
			for _, notAllowedPermission := range notAllowedPermissions {
				if permission == notAllowedPermission {
					notAllowed = true
				}
			}

			if notAllowed {
				c.Err = model.NewAppError("Api4.PatchRoles", "api.roles.patch_roles.not_allowed_permission.error", nil, "Cannot add or remove permission: "+permission, http.StatusNotImplemented)
				return
			}
		}

		*patch.Permissions = model.RemoveDuplicateStrings(*patch.Permissions)
	}

	if isGuest {
		c.Err = model.NewAppError("Api4.PatchRoles", "api.roles.patch_roles.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if oldRole.Name == model.TeamAdminRoleId ||
		oldRole.Name == model.ChannelAdminRoleId ||
		oldRole.Name == model.SystemUserRoleId ||
		oldRole.Name == model.TeamUserRoleId ||
		oldRole.Name == model.ChannelUserRoleId ||
		oldRole.Name == model.SystemGuestRoleId ||
		oldRole.Name == model.TeamGuestRoleId ||
		oldRole.Name == model.ChannelGuestRoleId ||
		oldRole.Name == model.PlaybookAdminRoleId ||
		oldRole.Name == model.PlaybookMemberRoleId ||
		oldRole.Name == model.RunAdminRoleId ||
		oldRole.Name == model.RunMemberRoleId {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementPermissions) {
			c.SetPermissionError(model.PermissionSysconsoleWriteUserManagementPermissions)
			return
		}
	} else {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementSystemRoles) {
			c.SetPermissionError(model.PermissionSysconsoleWriteUserManagementSystemRoles)
			return
		}
	}

	role, appErr := c.App.PatchRole(oldRole, &patch)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(role)
	auditRec.Success()
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(role); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
