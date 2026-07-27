package api4

import (
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"

	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/iamleson98/sitename/server/v8/channels/utils"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitUserLocal() {
	api.BaseRoutes.Users.Method(http.MethodGet, "/", api.APILocal(localGetUsers))
	api.BaseRoutes.Users.Method(http.MethodDelete, "/", api.APILocal(localPermanentDeleteAllUsers))
	api.BaseRoutes.Users.Method(http.MethodPost, "/", api.APILocal(createUser))
	api.BaseRoutes.Users.Method(http.MethodPost, "/password/reset/send", api.APILocal(sendPasswordReset))
	api.BaseRoutes.Users.Method(http.MethodPost, "/ids", api.APILocal(localGetUsersByIds))

	api.BaseRoutes.User.Method(http.MethodGet, "/", api.APILocal(localGetUser))
	api.BaseRoutes.User.Method(http.MethodPut, "/", api.APILocal(updateUser))
	api.BaseRoutes.User.Method(http.MethodDelete, "/", api.APILocal(localDeleteUser))
	api.BaseRoutes.User.Method(http.MethodPut, "/roles", api.APILocal(updateUserRoles))
	api.BaseRoutes.User.Method(http.MethodPut, "/mfa", api.APILocal(updateUserMfa))
	api.BaseRoutes.User.Method(http.MethodPut, "/active", api.APILocal(updateUserActive))
	api.BaseRoutes.User.Method(http.MethodPut, "/password", api.APILocal(updatePassword))
	api.BaseRoutes.User.Method(http.MethodPost, "/convert_to_bot", api.APILocal(convertUserToBot))
	api.BaseRoutes.User.Method(http.MethodPost, "/email/verify/member", api.APILocal(verifyUserEmailWithoutToken))
	api.BaseRoutes.User.Method(http.MethodPost, "/promote", api.APILocal(promoteGuestToUser))
	api.BaseRoutes.User.Method(http.MethodPost, "/demote", api.APILocal(demoteUserToGuest))

	api.BaseRoutes.User.Method(http.MethodPut, "/auth", api.APILocal(updateUserAuth))

	api.BaseRoutes.UserByUsername.Method(http.MethodGet, "/", api.APILocal(localGetUserByUsername))
	api.BaseRoutes.UserByEmail.Method(http.MethodGet, "/", api.APILocal(localGetUserByEmail))

	api.BaseRoutes.Users.Method(http.MethodPost, "/tokens/revoke", api.APILocal(revokeUserAccessToken))
	api.BaseRoutes.User.Method(http.MethodGet, "/tokens", api.APILocal(getUserAccessTokensForUser))
	api.BaseRoutes.User.Method(http.MethodPost, "/tokens", api.APILocal(createUserAccessToken))

	api.BaseRoutes.Users.Method(http.MethodPost, "/migrate_auth/ldap", api.APILocal(migrateAuthToLDAP))
	api.BaseRoutes.Users.Method(http.MethodPost, "/migrate_auth/saml", api.APILocal(migrateAuthToSaml))

	api.BaseRoutes.User.Method(http.MethodGet, "/uploads", api.APILocal(localGetUploadsForUser))
}

func localGetUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	inTeamId := r.URL.Query().Get("in_team")
	notInTeamId := r.URL.Query().Get("not_in_team")
	inChannelId := r.URL.Query().Get("in_channel")
	notInChannelId := r.URL.Query().Get("not_in_channel")
	groupConstrained := r.URL.Query().Get("group_constrained")
	withoutTeam := r.URL.Query().Get("without_team")
	active := r.URL.Query().Get("active")
	inactive := r.URL.Query().Get("inactive")
	role := r.URL.Query().Get("role")
	rolesString := r.URL.Query().Get("roles")
	channelRolesString := r.URL.Query().Get("channel_roles")
	teamRolesString := r.URL.Query().Get("team_roles")
	sort := r.URL.Query().Get("sort")
	roleNamesAll := []string{}
	// MM-47378: validate 'role' related parameters
	if role != "" || rolesString != "" || channelRolesString != "" || teamRolesString != "" {
		// fetch all role names
		rolesAll, err := c.App.GetAllRoles()
		if err != nil {
			c.Err = model.NewAppError("Api4.getUsers", "api.user.get_users.validation.app_error", nil, "Error fetching roles during validation.", http.StatusBadRequest)
			return
		}
		for _, role := range rolesAll {
			roleNamesAll = append(roleNamesAll, role.Name)
		}
	}

	var roles []string
	var rolesValid bool

	if role != "" {
		_, rolesValid = model.CleanRoleNames([]string{role})
		if !rolesValid {
			c.SetInvalidParam("role")
			return
		}
		roleValid := slices.Contains(roleNamesAll, role)
		if !roleValid {
			c.SetInvalidParam("role")
			return
		}
	}

	if rolesString != "" {
		roles, rolesValid = model.CleanRoleNames(strings.Split(rolesString, ","))
		if !rolesValid {
			c.SetInvalidParam("roles")
			return
		}
		validRoleNames := utils.StringArrayIntersection(roleNamesAll, roles)
		if len(validRoleNames) != len(roles) {
			c.SetInvalidParam("roles")
			return
		}
	}
	var channelRoles []string
	if channelRolesString != "" && inChannelId != "" {
		channelRoles, rolesValid = model.CleanRoleNames(strings.Split(channelRolesString, ","))
		if !rolesValid {
			c.SetInvalidParam("channelRoles")
			return
		}
		validRoleNames := utils.StringArrayIntersection(roleNamesAll, channelRoles)
		if len(validRoleNames) != len(channelRoles) {
			c.SetInvalidParam("channelRoles")
			return
		}
	}
	var teamRoles []string
	if teamRolesString != "" && inTeamId != "" {
		teamRoles, rolesValid = model.CleanRoleNames(strings.Split(teamRolesString, ","))
		if !rolesValid {
			c.SetInvalidParam("teamRoles")
			return
		}
		validRoleNames := utils.StringArrayIntersection(roleNamesAll, teamRoles)
		if len(validRoleNames) != len(teamRoles) {
			c.SetInvalidParam("teamRoles")
			return
		}
	}

	if notInChannelId != "" && inTeamId == "" {
		c.SetInvalidURLParam("team_id")
		return
	}

	if sort != "" && sort != "last_activity_at" && sort != "create_at" && sort != "status" {
		c.SetInvalidURLParam("sort")
		return
	}

	// Currently only supports sorting on a team
	// or sort="status" on inChannelId
	if (sort == "last_activity_at" || sort == "create_at") && (inTeamId == "" || notInTeamId != "" || inChannelId != "" || notInChannelId != "" || withoutTeam != "") {
		c.SetInvalidURLParam("sort")
		return
	}
	if sort == "status" && inChannelId == "" {
		c.SetInvalidURLParam("sort")
		return
	}

	withoutTeamBool, _ := strconv.ParseBool(withoutTeam)
	groupConstrainedBool, _ := strconv.ParseBool(groupConstrained)
	activeBool, _ := strconv.ParseBool(active)
	inactiveBool, _ := strconv.ParseBool(inactive)

	userGetOptions := &model.UserGetOptions{
		InTeamId:         inTeamId,
		InChannelId:      inChannelId,
		NotInTeamId:      notInTeamId,
		NotInChannelId:   notInChannelId,
		GroupConstrained: groupConstrainedBool,
		WithoutTeam:      withoutTeamBool,
		Active:           activeBool,
		Inactive:         inactiveBool,
		Role:             role,
		Sort:             sort,
		Page:             c.Params["page"].(int),
		PerPage:          c.Params["per_page"].(int),
		ViewRestrictions: nil,
	}

	var (
		appErr   *model.AppError
		profiles []*model.User
		etag     string
	)

	if withoutTeamBool, _ := strconv.ParseBool(withoutTeam); withoutTeamBool {
		profiles, appErr = c.App.GetUsersWithoutTeamPage(userGetOptions, c.IsSystemAdmin())
	} else if notInChannelId != "" {
		profiles, appErr = c.App.GetUsersNotInChannelPage(inTeamId, notInChannelId, groupConstrainedBool, c.Params["page"].(int), c.Params["per_page"].(int), c.IsSystemAdmin(), nil)
	} else if notInTeamId != "" {
		etag = c.App.GetUsersNotInTeamEtag(inTeamId, "")
		if c.HandleEtag(etag, "Get Users Not in Team", w, r) {
			return
		}

		profiles, appErr = c.App.GetUsersNotInTeamPage(notInTeamId, groupConstrainedBool, c.Params["page"].(int), c.Params["per_page"].(int), c.IsSystemAdmin(), nil)
	} else if inTeamId != "" {
		if sort == "last_activity_at" {
			profiles, appErr = c.App.GetRecentlyActiveUsersForTeamPage(c.AppContext, c.Params["team_id"].(string), c.Params["page"].(int), c.Params["per_page"].(int), c.IsSystemAdmin(), nil)
		} else if sort == "create_at" {
			profiles, appErr = c.App.GetNewUsersForTeamPage(c.AppContext, c.Params["team_id"].(string), c.Params["page"].(int), c.Params["per_page"].(int), c.IsSystemAdmin(), nil)
		} else {
			etag = c.App.GetUsersInTeamEtag(inTeamId, "")
			if c.HandleEtag(etag, "Get Users in Team", w, r) {
				return
			}
			profiles, appErr = c.App.GetUsersInTeamPage(userGetOptions, c.IsSystemAdmin())
		}
	} else if inChannelId != "" {
		if sort == "status" {
			profiles, appErr = c.App.GetUsersInChannelPageByStatus(userGetOptions, c.IsSystemAdmin())
		} else {
			profiles, appErr = c.App.GetUsersInChannelPage(userGetOptions, c.IsSystemAdmin())
		}
	} else {
		profiles, appErr = c.App.GetUsersPage(userGetOptions, c.IsSystemAdmin())
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	if etag != "" {
		w.Header().Set(model.HeaderEtagServer, etag)
	}

	js, err := json.Marshal(profiles)
	if err != nil {
		c.Err = model.NewAppError("localGetUsers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localGetUsersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	userIDs, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("localGetUsersByIds", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(userIDs) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	sinceString := r.URL.Query().Get("since")

	options := &store.UserGetByIdsOpts{
		IsAdmin: c.IsSystemAdmin(),
	}

	if sinceString != "" {
		since, parseErr := strconv.ParseInt(sinceString, 10, 64)
		if parseErr != nil {
			c.SetInvalidParamWithErr("since", parseErr)
			return
		}
		options.Since = since
	}

	users, appErr := c.App.GetUsersByIds(c.AppContext, userIDs, options)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(users)
	if err != nil {
		c.Err = model.NewAppError("localGetUsersByIds", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localGetUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	user, err := c.App.GetUser(userIdStr)
	if err != nil {
		c.Err = err
		return
	}

	userTermsOfService, err := c.App.GetUserTermsOfService(user.Id)
	if err != nil && err.StatusCode != http.StatusNotFound {
		c.Err = err
		return
	}

	if userTermsOfService != nil {
		user.TermsOfServiceId = userTermsOfService.TermsOfServiceId
		user.TermsOfServiceCreateAt = userTermsOfService.CreateAt
	}

	etag := user.Etag(*c.App.Config().PrivacySettings.ShowFullName, *c.App.Config().PrivacySettings.ShowEmailAddress)

	if c.HandleEtag(etag, "Get User", w, r) {
		return
	}

	c.App.SanitizeProfile(user, c.IsSystemAdmin())
	w.Header().Set(model.HeaderEtagServer, etag)
	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localDeleteUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	auditRec := c.MakeAuditRecord(model.AuditEventLocalDeleteUser, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	user, err := c.App.GetUser(userIdStr)
	if err != nil {
		c.Err = err
		return
	}
	model.AddEventParameterToAuditRec(auditRec, "user_id", userIdStr)
	auditRec.AddEventPriorState(user)
	auditRec.AddEventObjectType("user")

	if c.Params["permanent"].(bool) {
		err = c.App.PermanentDeleteUser(c.AppContext, user)
	} else {
		_, err = c.App.UpdateActive(c.AppContext, user, false)
	}
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func localPermanentDeleteAllUsers(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord(model.AuditEventLocalPermanentDeleteAllUsers, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	if err := c.App.PermanentDeleteAllUsers(c.AppContext); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func localGetUserByUsername(c *Context, w http.ResponseWriter, r *http.Request) {
	username := c.RequireParam("username", web.RequireValidUsername)
	if c.Err != nil {
		return
	}

	user, err := c.App.GetUserByUsername(username)
	if err != nil {
		c.Err = err
		return
	}

	userTermsOfService, err := c.App.GetUserTermsOfService(user.Id)
	if err != nil && err.StatusCode != http.StatusNotFound {
		c.Err = err
		return
	}

	if userTermsOfService != nil {
		user.TermsOfServiceId = userTermsOfService.TermsOfServiceId
		user.TermsOfServiceCreateAt = userTermsOfService.CreateAt
	}

	etag := user.Etag(*c.App.Config().PrivacySettings.ShowFullName, *c.App.Config().PrivacySettings.ShowEmailAddress)

	if c.HandleEtag(etag, "Get User", w, r) {
		return
	}

	c.App.SanitizeProfile(user, c.IsSystemAdmin())
	w.Header().Set(model.HeaderEtagServer, etag)
	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localGetUserByEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	c.SanitizeEmail()
	if c.Err != nil {
		return
	}

	sanitizeOptions := c.App.GetSanitizeOptions(c.IsSystemAdmin())
	if !sanitizeOptions["email"] {
		c.Err = model.NewAppError("getUserByEmail", "api.user.get_user_by_email.permissions.app_error", nil, "userId="+c.AppContext.Session().UserId, http.StatusForbidden)
		return
	}

	user, err := c.App.GetUserByEmail(c.Params["email"].(string))
	if err != nil {
		c.Err = err
		return
	}

	etag := user.Etag(*c.App.Config().PrivacySettings.ShowFullName, *c.App.Config().PrivacySettings.ShowEmailAddress)

	if c.HandleEtag(etag, "Get User", w, r) {
		return
	}

	c.App.SanitizeProfile(user, c.IsSystemAdmin())
	w.Header().Set(model.HeaderEtagServer, etag)
	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localGetUploadsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	uss, appErr := c.App.GetUploadSessionsForUser(c.Params["user_id"].(string))
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(uss)
	if err != nil {
		c.Err = model.NewAppError("localGetUploadsForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
