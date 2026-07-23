package api4

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/app"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitGroup() {
	// GET /api/v4/groups
	api.BaseRoutes.Groups.Method(http.MethodGet, "/", api.APISessionRequired(getGroups))

	// POST /api/v4/groups
	api.BaseRoutes.Groups.Method(http.MethodPost, "/", api.APISessionRequired(createGroup))

	// GET /api/v4/groups/:group_id
	api.BaseRoutes.Groups.Method(http.MethodGet, "/{group_id:[A-Za-z0-9]+}", api.APISessionRequired(getGroup))

	// PUT /api/v4/groups/:group_id/patch
	api.BaseRoutes.Groups.Method(http.MethodPut, "/{group_id:[A-Za-z0-9]+}/patch", api.APISessionRequired(patchGroup))

	// POST /api/v4/groups/:group_id/teams/:team_id/link
	// POST /api/v4/groups/:group_id/channels/:channel_id/link
	api.BaseRoutes.Groups.Method(http.MethodPost, "/{group_id:[A-Za-z0-9]+}/{syncable_type:(teams|channels)}/{syncable_id:[A-Za-z0-9]+}/link", api.APISessionRequired(linkGroupSyncable))

	// DELETE /api/v4/groups/:group_id/teams/:team_id/link
	// DELETE /api/v4/groups/:group_id/channels/:channel_id/link
	api.BaseRoutes.Groups.Method(http.MethodDelete, "/{group_id:[A-Za-z0-9]+}/{syncable_type:(teams|channels)}/{syncable_id:[A-Za-z0-9]+}/link", api.APISessionRequired(unlinkGroupSyncable))

	// GET /api/v4/groups/:group_id/teams/:team_id
	// GET /api/v4/groups/:group_id/channels/:channel_id
	api.BaseRoutes.Groups.Method(http.MethodGet, "/{group_id:[A-Za-z0-9]+}/{syncable_type:(teams|channels)}/{syncable_id:[A-Za-z0-9]+}", api.APISessionRequired(getGroupSyncable))

	// GET /api/v4/groups/:group_id/teams
	// GET /api/v4/groups/:group_id/channels
	api.BaseRoutes.Groups.Method(http.MethodGet, "/{group_id:[A-Za-z0-9]+}/{syncable_type:(teams|channels)}", api.APISessionRequired(getGroupSyncables))

	// PUT /api/v4/groups/:group_id/teams/:team_id/patch
	// PUT /api/v4/groups/:group_id/channels/:channel_id/patch
	api.BaseRoutes.Groups.Method(http.MethodPut, "/{group_id:[A-Za-z0-9]+}/{syncable_type:(teams|channels)}/{syncable_id:[A-Za-z0-9]+}/patch", api.APISessionRequired(patchGroupSyncable))

	// GET /api/v4/groups/:group_id/stats
	api.BaseRoutes.Groups.Method(http.MethodGet, "/{group_id:[A-Za-z0-9]+}/stats", api.APISessionRequired(getGroupStats))

	// GET /api/v4/groups/:group_id/members
	api.BaseRoutes.Groups.Method(http.MethodGet, "/{group_id:[A-Za-z0-9]+}/members", api.APISessionRequired(getGroupMembers))

	// GET /api/v4/users/:user_id/groups
	api.BaseRoutes.Users.Method(http.MethodGet, "/{user_id:[A-Za-z0-9]+}/groups", api.APISessionRequired(getGroupsByUserId))

	// GET /api/v4/channels/:channel_id/groups
	api.BaseRoutes.Channels.Method(http.MethodGet, "/{channel_id:[A-Za-z0-9]+}/groups", api.APISessionRequired(getGroupsByChannel))

	// POST
	api.BaseRoutes.Groups.Method(http.MethodPost, "/names", api.APISessionRequired(getGroupsByNames))

	// GET /api/v4/teams/:team_id/groups
	api.BaseRoutes.Teams.Method(http.MethodGet, "/{team_id:[A-Za-z0-9]+}/groups", api.APISessionRequired(getGroupsByTeam))

	// GET /api/v4/teams/:team_id/groups_by_channels
	api.BaseRoutes.Teams.Method(http.MethodGet, "/{team_id:[A-Za-z0-9]+}/groups_by_channels", api.APISessionRequired(getGroupsAssociatedToChannelsByTeam))

	// DELETE /api/v4/groups/:group_id
	api.BaseRoutes.Groups.Method(http.MethodDelete, "/{group_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteGroup))

	// POST /api/v4/groups/:group_id
	api.BaseRoutes.Groups.Method(http.MethodPost, "/{group_id:[A-Za-z0-9]+}/restore", api.APISessionRequired(restoreGroup))

	// POST /api/v4/groups/:group_id/members
	api.BaseRoutes.Groups.Method(http.MethodPost, "/{group_id:[A-Za-z0-9]+}/members", api.APISessionRequired(addGroupMembers))

	// DELETE /api/v4/groups/:group_id/members
	api.BaseRoutes.Groups.Method(http.MethodDelete, "/{group_id:[A-Za-z0-9]+}/members", api.APISessionRequired(deleteGroupMembers))
}

func getGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	group, appErr := c.App.GetGroup(groupIdStr, &model.GetGroupOpts{
		IncludeMemberCount: c.Params["include_member_count"].(bool),
		IncludeMemberIDs:   c.Params["include_member_ids"].(bool),
	}, restrictions)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !group.AllowReference {
		if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), groupIdStr, model.PermissionSysconsoleReadUserManagementGroups) {
			c.SetPermissionError(model.PermissionSysconsoleReadUserManagementGroups)
			return
		}
	}

	if appErr := licensedAndConfiguredForGroupBySource(c.App, group.Source); appErr != nil {
		appErr.Where = "Api4.getGroup"
		c.Err = appErr
		return
	}

	b, err := json.Marshal(group)
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createGroup(c *Context, w http.ResponseWriter, r *http.Request) {

	var group *model.GroupWithUserIds
	if err := json.NewDecoder(r.Body).Decode(&group); err != nil || group == nil {
		c.SetInvalidParamWithErr("group", err)
		return
	}

	if group.Source != model.GroupSourceCustom {
		c.Err = model.NewAppError("createGroup", "app.group.crud_permission", nil, "", http.StatusBadRequest)
		return
	}

	if appErr := licensedAndConfiguredForGroupBySource(c.App, group.Source); appErr != nil {
		appErr.Where = "Api4.createGroup"
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateCustomGroup) {
		c.SetPermissionError(model.PermissionCreateCustomGroup)
		return
	}

	if !group.AllowReference {
		c.Err = model.NewAppError("createGroup", "api.custom_groups.must_be_referenceable", nil, "", http.StatusBadRequest)
		return
	}

	if group.GetRemoteId() != "" {
		c.Err = model.NewAppError("createGroup", "api.custom_groups.no_remote_id", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateGroup, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "group", group)

	newGroup, appErr := c.App.CreateGroupWithUserIds(group)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(newGroup)
	auditRec.AddEventObjectType("group")
	js, err := json.Marshal(newGroup)
	if err != nil {
		c.Err = model.NewAppError("createGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	w.WriteHeader(http.StatusCreated)
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)

	group, appErr := c.App.GetGroup(groupIdStr, nil, nil)
	if appErr != nil {
		c.Err = appErr
		return
	}

	appErr = licensedAndConfiguredForGroupBySource(c.App, group.Source)
	if appErr != nil {
		appErr.Where = "Api4.patchGroup"
		c.Err = appErr
		return
	}

	var requiredPermission *model.Permission
	if group.Source == model.GroupSourceCustom {
		requiredPermission = model.PermissionEditCustomGroup
	} else {
		requiredPermission = model.PermissionSysconsoleWriteUserManagementGroups
	}
	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), groupIdStr, requiredPermission) {
		c.SetPermissionError(requiredPermission)
		return
	}

	var groupPatch model.GroupPatch
	if err := json.NewDecoder(r.Body).Decode(&groupPatch); err != nil {
		c.SetInvalidParamWithErr("group", err)
		return
	}

	if group.Source == model.GroupSourceCustom && groupPatch.AllowReference != nil && !*groupPatch.AllowReference {
		c.Err = model.NewAppError("Api4.patchGroup", "api.custom_groups.must_be_referenceable", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchGroup, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "group", group)

	if groupPatch.AllowReference != nil && *groupPatch.AllowReference {
		if groupPatch.Name == nil {
			tmp := strings.ReplaceAll(strings.ToLower(group.DisplayName), " ", "-")
			groupPatch.Name = &tmp
		} else {
			if *groupPatch.Name == model.UserNotifyAll || *groupPatch.Name == model.ChannelMentionsNotifyProp || *groupPatch.Name == model.UserNotifyHere {
				c.Err = model.NewAppError("Api4.patchGroup", "api.ldap_groups.existing_reserved_name_error", nil, "", http.StatusBadRequest)
				return
			}
			// check if a user already has this group name
			user, _ := c.App.GetUserByUsername(*groupPatch.Name)
			if user != nil {
				c.Err = model.NewAppError("Api4.patchGroup", "api.ldap_groups.existing_user_name_error", nil, "", http.StatusBadRequest)
				return
			}
			// check if a mentionable group already has this name
			searchOpts := model.GroupSearchOpts{
				FilterAllowReference: true,
			}
			existingGroup, _ := c.App.GetGroupByName(*groupPatch.Name, searchOpts)
			if existingGroup != nil {
				c.Err = model.NewAppError("Api4.patchGroup", "api.ldap_groups.existing_group_name_error", nil, "", http.StatusBadRequest)
				return
			}
		}
	}

	group.Patch(&groupPatch)

	group, appErr = c.App.UpdateGroup(group)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddEventResultState(group)
	auditRec.AddEventObjectType("group")

	b, err := json.Marshal(group)
	if err != nil {
		c.Err = model.NewAppError("Api4.patchGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func linkGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	syncableId := c.RequireParam("syncable_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)
	syncableIdStr := syncableId.(string)

	syncableType := c.RequireParam("syncable_type", web.RequireString)
	if c.Err != nil {
		return
	}
	syncableTypeStr := syncableType.(string)

	body, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.createGroupSyncable", "api.io_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLinkGroupSyncable, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_id", groupIdStr)
	model.AddEventParameterToAuditRec(auditRec, "syncable_id", syncableIdStr)
	model.AddEventParameterToAuditRec(auditRec, "syncable_type", syncableTypeStr)

	var patch *model.GroupSyncablePatch
	err = json.Unmarshal(body, &patch)
	if err != nil || patch == nil {
		c.SetInvalidParamWithErr(fmt.Sprintf("Group%s", syncableTypeStr), err)
		return
	}

	model.AddEventParameterAuditableToAuditRec(auditRec, "patch", patch)

	appErr := verifyLinkUnlinkPermission(c, model.GroupSyncableType(syncableTypeStr), syncableIdStr)
	if appErr != nil {
		appErr.Where = "Api4.linkGroupSyncable"
		c.Err = appErr
		return
	}

	groupSyncable := &model.GroupSyncable{
		GroupId:    groupIdStr,
		SyncableId: syncableIdStr,
		Type:       model.GroupSyncableType(syncableTypeStr),
	}
	groupSyncable.Patch(patch)
	groupSyncable, appErr = c.App.UpsertGroupSyncable(groupSyncable)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(groupSyncable)
	auditRec.AddEventObjectType("group_syncable")

	c.App.Srv().Go(func() {
		c.App.SyncRolesAndMembership(c.AppContext, syncableIdStr, model.GroupSyncableType(syncableTypeStr), groupIdStr)
	})

	w.WriteHeader(http.StatusCreated)

	b, err := json.Marshal(groupSyncable)
	if err != nil {
		c.Err = model.NewAppError("Api4.createGroupSyncable", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	syncableId := c.RequireParam("syncable_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)
	syncableIdStr := syncableId.(string)

	syncableType := c.RequireParam("syncable_type", web.RequireString)
	if c.Err != nil {
		return
	}
	syncableTypeStr := syncableType.(string)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	groupSyncable, appErr := c.App.GetGroupSyncable(groupIdStr, syncableIdStr, model.GroupSyncableType(syncableTypeStr))
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(groupSyncable)
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupSyncable", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupSyncables(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)

	syncableType := c.RequireParam("syncable_type", web.RequireString)
	if c.Err != nil {
		return
	}
	syncableTypeStr := syncableType.(string)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementGroups)
		return
	}

	groupSyncables, appErr := c.App.GetGroupSyncables(groupIdStr, model.GroupSyncableType(syncableTypeStr))
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(groupSyncables)
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupSyncables", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)

	syncableId := c.RequireParam("syncable_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	syncableIdStr := syncableId.(string)

	syncableType := c.RequireParam("syncable_type", web.RequireString)
	if c.Err != nil {
		return
	}
	syncableTypeStr := syncableType.(string)

	body, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.io_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchGroupSyncable, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_id", groupIdStr)
	model.AddEventParameterToAuditRec(auditRec, "old_syncable_id", syncableIdStr)
	model.AddEventParameterToAuditRec(auditRec, "old_syncable_type", syncableTypeStr)

	var patch *model.GroupSyncablePatch
	err = json.Unmarshal(body, &patch)
	if err != nil || patch == nil {
		c.SetInvalidParamWithErr(fmt.Sprintf("Group[%s]Patch", syncableTypeStr), err)
		return
	}

	model.AddEventParameterAuditableToAuditRec(auditRec, "patch", patch)

	appErr := verifyLinkUnlinkPermission(c, model.GroupSyncableType(syncableTypeStr), syncableIdStr)
	if appErr != nil {
		appErr.Where = "Api4.patchGroupSyncable"
		c.Err = appErr
		return
	}

	groupSyncable, appErr := c.App.GetGroupSyncable(groupIdStr, syncableIdStr, model.GroupSyncableType(syncableTypeStr))
	if appErr != nil {
		c.Err = appErr
		return
	}

	groupSyncable.Patch(patch)

	groupSyncable, appErr = c.App.UpdateGroupSyncable(groupSyncable)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(groupSyncable)
	auditRec.AddEventObjectType("group_syncable")

	c.App.Srv().Go(func() {
		c.App.SyncRolesAndMembership(c.AppContext, syncableIdStr, model.GroupSyncableType(syncableTypeStr), groupIdStr)
	})

	b, err := json.Marshal(groupSyncable)
	if err != nil {
		c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func unlinkGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)

	syncableId := c.RequireParam("syncable_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	syncableIdStr := syncableId.(string)

	syncableType := c.RequireParam("syncable_type", web.RequireString)
	if c.Err != nil {
		return
	}
	syncableTypeStr := syncableType.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventUnlinkGroupSyncable, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_id", groupIdStr)
	model.AddEventParameterToAuditRec(auditRec, "syncable_id", syncableIdStr)
	model.AddEventParameterToAuditRec(auditRec, "syncable_type", syncableTypeStr)

	appErr := verifyLinkUnlinkPermission(c, model.GroupSyncableType(syncableTypeStr), syncableIdStr)
	if appErr != nil {
		appErr.Where = "Api4.unlinkGroupSyncable"
		c.Err = appErr
		return
	}

	_, appErr = c.App.DeleteGroupSyncable(groupIdStr, syncableIdStr, model.GroupSyncableType(syncableTypeStr))
	if appErr != nil {
		c.Err = appErr
		return
	}

	c.App.Srv().Go(func() {
		c.App.RemoveMembershipsFromUnlinkedSyncable(c.AppContext, syncableIdStr, model.GroupSyncableType(syncableTypeStr))
	})

	auditRec.Success()

	ReturnStatusOK(w)
}

func verifyLinkUnlinkPermission(c *Context, syncableType model.GroupSyncableType, syncableID string) *model.AppError {
	group, appErr := c.App.GetGroup(c.Params["group_id"].(string), nil, nil)
	if appErr != nil {
		return appErr
	}

	if !group.IsSyncable() {
		return model.NewAppError("Api4.linkGroupSyncable", "app.group.crud_permission", nil, "", http.StatusBadRequest)
	}

	// If AllowReference is disabled, limit who can link the group.
	// This voids leaking the list of group members.
	// See https://mattermost.atlassian.net/browse/MM-55314 for more details.
	if !group.AllowReference {
		if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), c.Params["group_id"].(string), model.PermissionSysconsoleReadUserManagementGroups) {
			return model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionSysconsoleReadUserManagementGroups})
		}
	}

	switch syncableType {
	case model.GroupSyncableTypeTeam:
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), syncableID, model.PermissionInviteUser) &&
			!c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementGroups) {
			return model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionInviteUser})
		}
	case model.GroupSyncableTypeChannel:
		channel, appErr := c.App.GetChannel(c.AppContext, syncableID)
		if appErr != nil {
			return appErr
		}

		// If it's the first time that the syncable gets linked to the team (i.e. no current sync to the team or to a team's channel),
		// check that the user has the permission to manage the team.
		_, appErr = c.App.GetGroupSyncable(c.Params["group_id"].(string), channel.TeamId, model.GroupSyncableTypeTeam)
		if appErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(appErr, &nfErr):
				if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), syncableID, model.PermissionInviteUser) &&
					!c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementGroups) {
					return model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionInviteUser})
				}
			default:
				return appErr
			}
		}

		var permission *model.Permission
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelMembers
		} else {
			permission = model.PermissionManagePublicChannelMembers
		}

		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), syncableID, permission); !ok {
			return model.MakePermissionError(c.AppContext.Session(), []*model.Permission{permission})
		}
	}

	return nil
}

func getGroupMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)

	appErr := hasPermissionToReadGroupMembers(c, groupIdStr)
	if appErr != nil {
		appErr.Where = "Api4.getGroupMembers"
		c.Err = appErr
		return
	}

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	members, count, appErr := c.App.GetGroupMemberUsersPage(groupIdStr, c.Params["page"].(int), c.Params["per_page"].(int), restrictions)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(model.GroupMemberList{
		Members: members,
		Count:   count,
	})
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupStats(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementGroups)
		return
	}

	groupID := groupIdStr
	count, appErr := c.App.GetGroupMemberCount(groupID, nil)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(model.GroupStats{
		GroupID:          groupID,
		TotalMemberCount: count,
	})
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupStats", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupsByUserId(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if c.AppContext.Session().UserId != userIdStr && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	filterAllowReference := !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups)

	opts := model.GroupSearchOpts{
		FilterAllowReference: filterAllowReference,
	}

	groups, appErr := c.App.GetGroupsByUserId(userIdStr, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(groups)
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupsByUserId", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupsByChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	b, appErr := getGroupsByChannelCommon(c, r)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupsByNames(c *Context, w http.ResponseWriter, r *http.Request) {
	groupNames, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getGroupsByNames", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(groupNames) == 0 {
		if _, err = w.Write([]byte("[]")); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	groups, appErr := c.App.GetGroupsByNames(groupNames, restrictions)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(groups)
	if err != nil {
		c.Err = model.NewAppError("getGroupsByNames", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupsByTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireParam("team_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	b, appError := getGroupsByTeamCommon(c, r)
	if appError != nil {
		c.Err = appError
		return
	}
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupsByTeamCommon(c *Context, r *http.Request) ([]byte, *model.AppError) {
	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params["team_id"].(string), model.PermissionListTeamChannels) {
		return nil, model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionListTeamChannels})
	}

	filterAllowReference := c.Params["filter_allow_reference"].(bool) || !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups)

	opts := model.GroupSearchOpts{
		Q:                    c.Params["q"].(string),
		IncludeMemberCount:   c.Params["include_member_count"].(bool),
		FilterAllowReference: filterAllowReference,
	}
	if c.Params["paginate"].(*bool) == nil || *c.Params["paginate"].(*bool) {
		opts.PageOpts = &model.PageOpts{Page: c.Params["page"].(int), PerPage: c.Params["per_page"].(int)}
	}

	groups, totalCount, appErr := c.App.GetGroupsByTeam(c.Params["team_id"].(string), opts)
	if appErr != nil {
		return nil, appErr
	}

	b, err := json.Marshal(struct {
		Groups []*model.GroupWithSchemeAdmin `json:"groups"`
		Count  int                           `json:"total_group_count"`
	}{
		Groups: groups,
		Count:  totalCount,
	})
	if err != nil {
		return nil, model.NewAppError("Api4.getGroupsByTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return b, nil
}

func getGroupsByChannelCommon(c *Context, r *http.Request) ([]byte, *model.AppError) {
	channel, appErr := c.App.GetChannel(c.AppContext, c.Params["channel_id"].(string))
	if appErr != nil {
		return nil, appErr
	}

	var permission *model.Permission
	if channel.Type == model.ChannelTypePrivate {
		permission = model.PermissionReadPrivateChannelGroups
	} else {
		permission = model.PermissionReadPublicChannelGroups
	}
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params["channel_id"].(string), permission); !ok {
		return nil, model.MakePermissionError(c.AppContext.Session(), []*model.Permission{permission})
	}

	filterAllowReference := c.Params["filter_allow_reference"].(bool) || !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups)

	opts := model.GroupSearchOpts{
		Q:                    c.Params["q"].(string),
		IncludeMemberCount:   c.Params["include_member_count"].(bool),
		FilterAllowReference: filterAllowReference,
	}
	if c.Params["paginate"].(*bool) == nil || *c.Params["paginate"].(*bool) {
		opts.PageOpts = &model.PageOpts{Page: c.Params["page"].(int), PerPage: c.Params["per_page"].(int)}
	}

	groups, totalCount, appErr := c.App.GetGroupsByChannel(c.Params["channel_id"].(string), opts)
	if appErr != nil {
		return nil, appErr
	}

	b, err := json.Marshal(struct {
		Groups []*model.GroupWithSchemeAdmin `json:"groups"`
		Count  int                           `json:"total_group_count"`
	}{
		Groups: groups,
		Count:  totalCount,
	})
	if err != nil {
		return nil, model.NewAppError("Api4.getGroupsByChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return b, nil
}

func getGroupsAssociatedToChannelsByTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	teamId := c.RequireParam("team_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	teamIdStr := teamId.(string)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamIdStr, model.PermissionListTeamChannels) {
		c.Err = model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionListTeamChannels})
		return
	}

	filterAllowReference := c.Params["filter_allow_reference"].(bool) || !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups)

	opts := model.GroupSearchOpts{
		Q:                    c.Params["q"].(string),
		IncludeMemberCount:   c.Params["include_member_count"].(bool),
		FilterAllowReference: filterAllowReference,
	}
	if c.Params["paginate"].(*bool) == nil || *c.Params["paginate"].(*bool) {
		opts.PageOpts = &model.PageOpts{Page: c.Params["page"].(int), PerPage: c.Params["per_page"].(int)}
	}

	groupsAssociatedByChannelID, appErr := c.App.GetGroupsAssociatedToChannelsByTeam(teamIdStr, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(struct {
		GroupsAssociatedToChannels map[string][]*model.GroupWithSchemeAdmin `json:"groups"`
	}{
		GroupsAssociatedToChannels: groupsAssociatedByChannelID,
	})
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupsAssociatedToChannelsByTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroups(c *Context, w http.ResponseWriter, r *http.Request) {
	var teamID, NotAssociatedToChannelID, ChannelIDForMemberCount string

	source := model.GroupSource(c.Params["group_source"].(string))

	onlySyncableSources := r.URL.Query().Get("only_syncable_sources") == "true"

	if id := c.Params["not_associated_to_team"].(string); model.IsValidId(id) {
		teamID = id
	}

	if id := c.Params["not_associated_to_channel"].(string); model.IsValidId(id) {
		NotAssociatedToChannelID = id
	}

	if id := c.Params["include_channel_member_count"].(string); model.IsValidId(id) {
		ChannelIDForMemberCount = id
	}

	// If they specify the group_source as custom when the feature is disabled, throw an error
	if appErr := licensedAndConfiguredForGroupBySource(c.App, source); appErr != nil {
		appErr.Where = "Api4.getGroups"
		c.Err = appErr
		return
	}

	// If they don't specify a source and custom groups are disabled, ensure they only get the other sources
	if !*c.App.Config().ServiceSettings.EnableCustomGroups {
		onlySyncableSources = true
	}

	includeTimezones := r.URL.Query().Get("include_timezones") == "true"

	// Include archived groups
	includeArchived := r.URL.Query().Get("include_archived") == "true"

	filterAllowReference := c.Params["filter_allow_reference"].(bool) || !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups)

	opts := model.GroupSearchOpts{
		Q:                         c.Params["q"].(string),
		IncludeMemberCount:        c.Params["include_member_count"].(bool),
		FilterAllowReference:      filterAllowReference,
		FilterArchived:            c.Params["filter_archived"].(bool),
		FilterParentTeamPermitted: c.Params["filter_parent_team_permitted"].(bool),
		Source:                    source,
		FilterHasMember:           c.Params["filter_has_member"].(string),
		IncludeTimezones:          includeTimezones,
		IncludeMemberIDs:          c.Params["include_member_ids"].(bool),
		IncludeArchived:           includeArchived,
		OnlySyncableSources:       onlySyncableSources,
	}

	if teamID != "" {
		_, appErr := c.App.GetTeam(teamID)
		if appErr != nil {
			c.Err = appErr
			return
		}

		opts.NotAssociatedToTeam = teamID
	}

	if NotAssociatedToChannelID != "" {
		channel, appErr := c.App.GetChannel(c.AppContext, NotAssociatedToChannelID)
		if appErr != nil {
			c.Err = appErr
			return
		}
		var permission *model.Permission
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelMembers
		} else {
			permission = model.PermissionManagePublicChannelMembers
		}
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), NotAssociatedToChannelID, permission); !ok {
			c.SetPermissionError(permission)
			return
		}
		opts.NotAssociatedToChannel = NotAssociatedToChannelID
	}

	if ChannelIDForMemberCount != "" {
		channel, appErr := c.App.GetChannel(c.AppContext, ChannelIDForMemberCount)
		if appErr != nil {
			c.Err = appErr
			return
		}
		var permission *model.Permission
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelMembers
		} else {
			permission = model.PermissionManagePublicChannelMembers
		}
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), ChannelIDForMemberCount, permission); !ok {
			c.SetPermissionError(permission)
			return
		}
		opts.IncludeChannelMemberCount = ChannelIDForMemberCount
	}

	sinceString := r.URL.Query().Get("since")
	if sinceString != "" {
		since, err := strconv.ParseInt(sinceString, 10, 64)
		if err != nil {
			c.SetInvalidParamWithErr("since", err)
			return
		}
		opts.Since = since
	}

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	var (
		groups = []*model.Group{}
		canSee = true
	)

	if opts.FilterHasMember != "" {
		canSee, appErr = c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, opts.FilterHasMember)
		if appErr != nil {
			c.Err = appErr
			return
		}
	}

	if canSee {
		groups, appErr = c.App.GetGroups(c.Params["page"].(int), c.Params["per_page"].(int), opts, restrictions)
		if appErr != nil {
			c.Err = appErr
			return
		}
	}

	var (
		b   []byte
		err error
	)
	if c.Params["include_total_count"].(bool) {
		totalCount, cerr := c.App.Srv().Store().Group().GroupCount()
		if cerr != nil {
			c.Err = model.NewAppError("Api4.getGroups", "api.custom_groups.count_err", nil, "", http.StatusInternalServerError).Wrap(cerr)
			return
		}
		gwc := &model.GroupsWithCount{
			Groups:     groups,
			TotalCount: totalCount,
		}
		b, err = json.Marshal(gwc)
	} else {
		b, err = json.Marshal(groups)
	}

	if err != nil {
		c.Err = model.NewAppError("Api4.getGroups", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)

	group, err := c.App.GetGroup(groupIdStr, nil, nil)
	if err != nil {
		c.Err = err
		return
	}

	if group.Source != model.GroupSourceCustom {
		c.Err = model.NewAppError("Api4.deleteGroup", "app.group.crud_permission", nil, "", http.StatusBadRequest)
		return
	}

	if lcErr := licensedAndConfiguredForGroupBySource(c.App, model.GroupSourceCustom); lcErr != nil {
		lcErr.Where = "Api4.deleteGroup"
		c.Err = lcErr
		return
	}

	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), groupIdStr, model.PermissionDeleteCustomGroup) {
		c.SetPermissionError(model.PermissionDeleteCustomGroup)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteGroup, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_id", groupIdStr)

	group, err = c.App.DeleteGroup(groupIdStr)
	if err != nil {
		c.Err = err
		return
	}

	b, jsonErr := json.Marshal(group)
	if jsonErr != nil {
		c.Err = model.NewAppError("Api4.deleteGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		return
	}
	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func restoreGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)

	group, err := c.App.GetGroup(groupIdStr, nil, nil)
	if err != nil {
		c.Err = err
		return
	}

	if group.Source != model.GroupSourceCustom {
		c.Err = model.NewAppError("Api4.restoreGroup", "app.group.crud_permission", nil, "", http.StatusNotImplemented)
		return
	}

	if lcErr := licensedAndConfiguredForGroupBySource(c.App, model.GroupSourceCustom); lcErr != nil {
		lcErr.Where = "Api4.restoreGroup"
		c.Err = lcErr
		return
	}

	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), groupIdStr, model.PermissionRestoreCustomGroup) {
		c.SetPermissionError(model.PermissionRestoreCustomGroup)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventRestoreGroup, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_id", groupIdStr)

	restoredGroup, err := c.App.RestoreGroup(groupIdStr)
	if err != nil {
		c.Err = err
		return
	}

	b, jsonErr := json.Marshal(restoredGroup)
	if jsonErr != nil {
		c.Err = model.NewAppError("Api4.restoreGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		return
	}

	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func addGroupMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)

	group, appErr := c.App.GetGroup(groupIdStr, nil, nil)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if group.Source != model.GroupSourceCustom {
		c.Err = model.NewAppError("Api4.addGroupMembers", "app.group.crud_permission", nil, "", http.StatusBadRequest)
		return
	}

	appErr = licensedAndConfiguredForGroupBySource(c.App, model.GroupSourceCustom)
	if appErr != nil {
		appErr.Where = "Api4.addGroupMembers"
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), groupIdStr, model.PermissionManageCustomGroupMembers) {
		c.SetPermissionError(model.PermissionManageCustomGroupMembers)
		return
	}

	var newMembers *model.GroupModifyMembers
	if err := json.NewDecoder(r.Body).Decode(&newMembers); err != nil || newMembers == nil {
		c.SetInvalidParamWithErr("addGroupMembers", err)
		return
	}

	for _, userID := range newMembers.UserIds {
		if !model.IsValidId(userID) {
			c.SetInvalidParamWithDetails("user_id", fmt.Sprintf("UserID %s is invalid", userID))
			return
		}
	}

	auditRec := c.MakeAuditRecord(model.AuditEventAddGroupMembers, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "addGroupMembers_userids", newMembers.UserIds)

	members, appErr := c.App.UpsertGroupMembers(groupIdStr, newMembers.UserIds)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(members)
	if err != nil {
		c.Err = model.NewAppError("Api4.addGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteGroupMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	groupId := c.RequireParam("group_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	groupIdStr := groupId.(string)

	group, appErr := c.App.GetGroup(groupIdStr, nil, nil)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if group.Source != model.GroupSourceCustom {
		c.Err = model.NewAppError("Api4.deleteGroupMembers", "app.group.crud_permission", nil, "", http.StatusBadRequest)
		return
	}

	appErr = licensedAndConfiguredForGroupBySource(c.App, model.GroupSourceCustom)
	if appErr != nil {
		appErr.Where = "Api4.deleteGroupMembers"
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), groupIdStr, model.PermissionManageCustomGroupMembers) {
		c.SetPermissionError(model.PermissionManageCustomGroupMembers)
		return
	}

	var deleteBody *model.GroupModifyMembers
	if err := json.NewDecoder(r.Body).Decode(&deleteBody); err != nil || deleteBody == nil {
		c.SetInvalidParamWithErr("deleteGroupMembers", err)
		return
	}

	for _, userID := range deleteBody.UserIds {
		if !model.IsValidId(userID) {
			c.SetInvalidParamWithDetails("user_id", fmt.Sprintf("UserID %s is invalid", userID))
			return
		}
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteGroupMembers, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "deleteGroupMembers_userids", deleteBody.UserIds)

	members, appErr := c.App.DeleteGroupMembers(groupIdStr, deleteBody.UserIds)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(members)
	if err != nil {
		c.Err = model.NewAppError("Api4.addGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// hasPermissionToReadGroupMembers check if a user has the permission to read the list of members of a given team.
func hasPermissionToReadGroupMembers(c *web.Context, groupID string) *model.AppError {
	group, err := c.App.GetGroup(groupID, nil, nil)
	if err != nil {
		return err
	}

	if lcErr := licensedAndConfiguredForGroupBySource(c.App, group.Source); lcErr != nil {
		return lcErr
	}

	if group.IsSyncable() && !group.AllowReference {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups) {
			return model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionSysconsoleReadUserManagementGroups})
		}
	}

	return nil
}

// licensedAndConfiguredForGroupBySource returns an app error if not properly license or configured for the given group type. The returned app error
// will have a blank 'Where' field, which should be subsequently set by the caller, for example:
//
//	err := licensedAndConfiguredForGroupBySource(c.App, group.Source)
//	err.Where = "Api4.getGroup"
func licensedAndConfiguredForGroupBySource(app *app.App, source model.GroupSource) *model.AppError {
	if source == model.GroupSourceLdap {
		return model.NewAppError("", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
	}

	if strings.HasPrefix(string(source), string(model.GroupSourcePluginPrefix)) {
		return model.NewAppError("", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
	}

	if source == model.GroupSourceCustom {
		return model.NewAppError("", "api.custom_groups.license_error", nil, "", http.StatusBadRequest)
	}

	if source == model.GroupSourceCustom && !*app.Config().ServiceSettings.EnableCustomGroups {
		return model.NewAppError("", "api.custom_groups.feature_disabled", nil, "", http.StatusBadRequest)
	}

	return nil
}
