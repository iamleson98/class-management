package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitChannelLocal() {
	api.BaseRoutes.Channels.Method(http.MethodGet, "/", api.APILocal(getAllChannels))
	api.BaseRoutes.Channels.Method(http.MethodPost, "/", api.APILocal(localCreateChannel))
	api.BaseRoutes.Channel.Method(http.MethodGet, "/", api.APILocal(getChannel))
	api.BaseRoutes.ChannelByName.Method(http.MethodGet, "/", api.APILocal(getChannelByName))
	api.BaseRoutes.Channel.Method(http.MethodDelete, "/", api.APILocal(localDeleteChannel))
	api.BaseRoutes.Channel.Method(http.MethodPut, "/patch", api.APILocal(localPatchChannel))
	api.BaseRoutes.Channel.Method(http.MethodPost, "/move", api.APILocal(localMoveChannel))
	api.BaseRoutes.Channel.Method(http.MethodPut, "/privacy", api.APILocal(localUpdateChannelPrivacy))
	api.BaseRoutes.Channel.Method(http.MethodPost, "/restore", api.APILocal(localRestoreChannel))

	api.BaseRoutes.ChannelMember.Method(http.MethodDelete, "/", api.APILocal(localRemoveChannelMember))
	api.BaseRoutes.ChannelMember.Method(http.MethodGet, "/", api.APILocal(getChannelMember))
	api.BaseRoutes.ChannelMembers.Method(http.MethodPost, "/", api.APILocal(localAddChannelMember))
	api.BaseRoutes.ChannelMembers.Method(http.MethodGet, "/", api.APILocal(getChannelMembers))

	api.BaseRoutes.ChannelsForTeam.Method(http.MethodGet, "/", api.APILocal(getPublicChannelsForTeam))
	api.BaseRoutes.ChannelsForTeam.Method(http.MethodGet, "/deleted", api.APILocal(getDeletedChannelsForTeam))
	api.BaseRoutes.ChannelsForTeam.Method(http.MethodGet, "/private", api.APILocal(getPrivateChannelsForTeam))

	api.BaseRoutes.ChannelByName.Method(http.MethodGet, "/", api.APILocal(getChannelByName))
	api.BaseRoutes.ChannelByNameForTeamName.Method(http.MethodGet, "/", api.APILocal(getChannelByNameForTeamName))
}

func localCreateChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	var channel *model.Channel
	err := json.NewDecoder(r.Body).Decode(&channel)
	if err != nil || channel == nil {
		c.SetInvalidParamWithErr("channel", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLocalCreateChannel, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "channel", channel)

	sc, appErr := c.App.CreateChannel(c.AppContext, channel, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(sc)
	auditRec.AddEventObjectType("channel")
	c.LogAudit("name=" + channel.Name)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(sc); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localUpdateChannelPrivacy(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	props := model.StringInterfaceFromJSON(r.Body)
	privacy, ok := props["privacy"].(string)
	if !ok || (model.ChannelType(privacy) != model.ChannelTypeOpen && model.ChannelType(privacy) != model.ChannelTypePrivate) {
		c.SetInvalidParam("privacy")
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, channelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLocalUpdateChannelPrivacy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "privacy", privacy)

	if channel.Name == model.DefaultChannelName && model.ChannelType(privacy) == model.ChannelTypePrivate {
		c.Err = model.NewAppError("updateChannelPrivacy", "api.channel.update_channel_privacy.default_channel_error", nil, "", http.StatusBadRequest)
		return
	}
	channel.Type = model.ChannelType(privacy)

	updatedChannel, err := c.App.UpdateChannelPrivacy(c.AppContext, channel, nil)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(channel)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()
	c.LogAudit("name=" + updatedChannel.Name)

	if err := json.NewEncoder(w).Encode(updatedChannel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localRestoreChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, channelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLocalRestoreChannel, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", channelId)

	channel, err = c.App.RestoreChannel(c.AppContext, channel, "")
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(channel)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()
	c.LogAudit("name=" + channel.Name)

	if err := json.NewEncoder(w).Encode(channel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localAddChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLocalAddChannelMember, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", channelId)
	defer c.LogAuditRec(auditRec)

	props := model.StringInterfaceFromJSON(r.Body)
	userId, ok := props["user_id"].(string)
	if !ok || !model.IsValidId(userId) {
		c.SetInvalidParam("user_id")
		return
	}

	model.AddEventParameterToAuditRec(auditRec, "user_id", userId)

	member := &model.ChannelMember{
		ChannelId: channelId,
		UserId:    userId,
	}

	postRootId, ok := props["post_root_id"].(string)
	if ok && postRootId != "" && !model.IsValidId(postRootId) {
		c.SetInvalidParam("post_root_id")
		return
	}

	model.AddEventParameterToAuditRec(auditRec, "post_root_id", postRootId)

	if ok && len(postRootId) == 26 {
		rootPost, err := c.App.GetSinglePost(c.AppContext, postRootId, false)
		if err != nil {
			c.Err = err
			return
		}
		if rootPost.ChannelId != member.ChannelId {
			c.SetInvalidParam("post_root_id")
			return
		}
	}

	channel, err := c.App.GetChannel(c.AppContext, member.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	model.AddEventParameterAuditableToAuditRec(auditRec, "channel", channel)

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		c.Err = model.NewAppError("localAddChannelMember", "api.channel.add_user_to_channel.type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if channel.IsGroupConstrained() {
		nonMembers, err := c.App.FilterNonGroupChannelMembers(c.AppContext, []string{member.UserId}, channel)
		if err != nil {
			if v, ok := err.(*model.AppError); ok {
				c.Err = v
			} else {
				c.Err = model.NewAppError("localAddChannelMember", "api.channel.add_members.error", nil, "", http.StatusBadRequest).Wrap(err)
			}
			return
		}
		if len(nonMembers) > 0 {
			c.Err = model.NewAppError("localAddChannelMember", "api.channel.add_members.user_denied", map[string]any{"UserIDs": nonMembers}, "", http.StatusBadRequest)
			return
		}
	}

	cm, err := c.App.AddChannelMember(c.AppContext, member.UserId, channel, model.ChannelMemberOpts{
		PostRootID: postRootId,
	})
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("add_user_id", cm.UserId)
	auditRec.AddEventResultState(cm)
	auditRec.AddEventObjectType("channel_member")
	c.LogAudit("name=" + channel.Name + " user_id=" + cm.UserId)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(cm); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localRemoveChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := c.RequireParam("channel_id", web.RequireValidId)
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	channel, err := c.App.GetChannel(c.AppContext, channelId)
	if err != nil {
		c.Err = err
		return
	}

	user, err := c.App.GetUser(userIdStr)
	if err != nil {
		c.Err = err
		return
	}

	if !(channel.Type == model.ChannelTypeOpen || channel.Type == model.ChannelTypePrivate) {
		c.Err = model.NewAppError("removeChannelMember", "api.channel.remove_channel_member.type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if channel.IsGroupConstrained() && !user.IsBot {
		c.Err = model.NewAppError("removeChannelMember", "api.channel.remove_member.group_constrained.app_error", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLocalRemoveChannelMember, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", channelId)
	model.AddEventParameterToAuditRec(auditRec, "remove_user_id", userIdStr)

	if err = c.App.RemoveUserFromChannel(c.AppContext, userIdStr, "", channel); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("name=" + channel.Name + " user_id=" + userIdStr)

	ReturnStatusOK(w)
}

func localPatchChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var patch *model.ChannelPatch
	err := json.NewDecoder(r.Body).Decode(&patch)
	if err != nil || patch == nil {
		c.SetInvalidParamWithErr("channel", err)
		return
	}

	originalOldChannel, appErr := c.App.GetChannel(c.AppContext, channelId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	channel := originalOldChannel.DeepCopy()

	auditRec := c.MakeAuditRecord(model.AuditEventLocalPatchChannel, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "channel_patch", patch)

	channel.Patch(patch)
	rchannel, appErr := c.App.UpdateChannel(c.AppContext, channel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	appErr = c.App.FillInChannelProps(c.AppContext, rchannel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("")
	auditRec.AddEventResultState(rchannel)
	auditRec.AddEventObjectType("channel")

	if err := json.NewEncoder(w).Encode(rchannel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localMoveChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := c.RequireParam("channel_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, channelId)
	if err != nil {
		c.Err = err
		return
	}

	props := model.StringInterfaceFromJSON(r.Body)
	teamId, ok := props["team_id"].(string)
	if !ok {
		c.SetInvalidParam("team_id")
		return
	}

	force, ok := props["force"].(bool)
	if !ok {
		c.SetInvalidParam("force")
		return
	}

	team, err := c.App.GetTeam(teamId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLocalMoveChannel, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "team_id", teamId)
	model.AddEventParameterToAuditRec(auditRec, "force", force)

	// TODO do we need these?
	auditRec.AddMeta("channel_id", channel.Id)
	auditRec.AddMeta("channel_name", channel.Name)
	auditRec.AddMeta("team_id", team.Id)
	auditRec.AddMeta("team_name", team.Name)

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		c.Err = model.NewAppError("moveChannel", "api.channel.move_channel.type.invalid", nil, "", http.StatusForbidden)
		return
	}

	err = c.App.RemoveAllDeactivatedMembersFromChannel(c.AppContext, channel)
	if err != nil {
		c.Err = err
		return
	}

	if force {
		err = c.App.RemoveUsersFromChannelNotMemberOfTeam(c.AppContext, nil, channel, team)
		if err != nil {
			c.Err = err
			return
		}
	}

	err = c.App.MoveChannel(c.AppContext, team, channel, nil)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(channel)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()
	c.LogAudit("channel=" + channel.Name)
	c.LogAudit("team=" + team.Name)

	if err := json.NewEncoder(w).Encode(channel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localDeleteChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := c.RequireParam("channel_id", web.RequireValidId)
	permanent := c.RequireParam("permanent", web.RequireBool)
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, channelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLocalDeleteChannel, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventPriorState(channel)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", channelId)

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		c.Err = model.NewAppError("localDeleteChannel", "api.channel.delete_channel.type.invalid", nil, "", http.StatusBadRequest)
		return
	}

	if permanent {
		err = c.App.PermanentDeleteChannel(c.AppContext, channel)
	} else {
		err = c.App.DeleteChannel(c.AppContext, channel, "")
	}
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(channel)
	auditRec.AddEventObjectType("channel")
	c.LogAudit("name=" + channel.Name)

	ReturnStatusOK(w)
}
