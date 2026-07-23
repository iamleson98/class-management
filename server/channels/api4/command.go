package api4

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitCommand() {
	api.BaseRoutes.Commands.Method(http.MethodPost, "/", api.APISessionRequired(createCommand))
	api.BaseRoutes.Commands.Method(http.MethodGet, "/", api.APISessionRequired(listCommands))
	api.BaseRoutes.Commands.Method(http.MethodPost, "/execute", api.APISessionRequired(executeCommand))
	api.BaseRoutes.Command.Method(http.MethodGet, "/", api.APISessionRequired(getCommand))
	api.BaseRoutes.Command.Method(http.MethodPut, "/", api.APISessionRequired(updateCommand))
	api.BaseRoutes.Command.Method(http.MethodPut, "/move", api.APISessionRequired(moveCommand))
	api.BaseRoutes.Command.Method(http.MethodDelete, "/", api.APISessionRequired(deleteCommand))
	api.BaseRoutes.Team.Method(http.MethodGet, "/commands/autocomplete", api.APISessionRequired(listAutocompleteCommands))
	api.BaseRoutes.Team.Method(http.MethodGet, "/commands/autocomplete_suggestions", api.APISessionRequired(listCommandAutocompleteSuggestions))
	api.BaseRoutes.Command.Method(http.MethodPut, "/regen_token", api.APISessionRequired(regenCommandToken))
}

func createCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	var cmd model.Command
	if jsonErr := json.NewDecoder(r.Body).Decode(&cmd); jsonErr != nil {
		c.SetInvalidParamWithErr("command", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateCommand, model.AuditStatusFail)
	model.AddEventParameterAuditableToAuditRec(auditRec, "command", &cmd)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), cmd.TeamId, model.PermissionManageOwnSlashCommands) {
		c.SetPermissionError(model.PermissionManageOwnSlashCommands)
		return
	}

	userId := c.AppContext.Session().UserId
	if cmd.CreatorId != "" && cmd.CreatorId != userId {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), cmd.TeamId, model.PermissionManageOthersSlashCommands) {
			c.LogAudit("fail - inappropriate permissions")
			c.SetPermissionError(model.PermissionManageOthersSlashCommands)
			return
		}

		if _, err := c.App.GetUser(cmd.CreatorId); err != nil {
			c.Err = err
			return
		}

		userId = cmd.CreatorId
	}

	cmd.CreatorId = userId

	rcmd, err := c.App.CreateCommand(&cmd)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")
	auditRec.AddEventResultState(rcmd)
	auditRec.AddEventObjectType("command")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rcmd); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	commandId := c.RequireParam("command_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	commandIdStr := commandId.(string)

	var cmd model.Command
	if jsonErr := json.NewDecoder(r.Body).Decode(&cmd); jsonErr != nil || cmd.Id != commandIdStr {
		c.SetInvalidParamWithErr("command", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateCommand, model.AuditStatusFail)
	model.AddEventParameterAuditableToAuditRec(auditRec, "command", &cmd)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	oldCmd, err := c.App.GetCommand(commandIdStr)
	if err != nil {
		model.AddEventParameterToAuditRec(auditRec, "command_id", commandIdStr)
		c.SetCommandNotFoundError()
		return
	}
	auditRec.AddEventPriorState(oldCmd)

	if cmd.TeamId != oldCmd.TeamId {
		c.Err = model.NewAppError("updateCommand", "api.command.team_mismatch.app_error", nil, "user_id="+c.AppContext.Session().UserId, http.StatusBadRequest)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), oldCmd.TeamId, model.PermissionManageOwnSlashCommands) {
		c.LogAudit("fail - inappropriate permissions")
		// here we return Not_found instead of a permissions error so we don't leak the existence of
		// a command to someone without permissions for the team it belongs to.
		c.SetCommandNotFoundError()
		return
	}

	if c.AppContext.Session().UserId != oldCmd.CreatorId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), oldCmd.TeamId, model.PermissionManageOthersSlashCommands) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersSlashCommands)
		return
	}

	rcmd, err := c.App.UpdateCommand(oldCmd, &cmd)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(rcmd)
	auditRec.AddEventObjectType("command")
	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(rcmd); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func moveCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	commandId := c.RequireParam("command_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	commandIdStr := commandId.(string)

	var cmr model.CommandMoveRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&cmr); jsonErr != nil {
		c.SetInvalidParamWithErr("team_id", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventMoveCommand, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "command_move_request", cmr.TeamId)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	newTeam, appErr := c.App.GetTeam(cmr.TeamId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	model.AddEventParameterAuditableToAuditRec(auditRec, "team", newTeam)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), newTeam.Id, model.PermissionManageOwnSlashCommands) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOwnSlashCommands)
		return
	}

	cmd, appErr := c.App.GetCommand(commandIdStr)
	if appErr != nil {
		c.SetCommandNotFoundError()
		return
	}
	auditRec.AddEventPriorState(cmd)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), cmd.TeamId, model.PermissionManageOwnSlashCommands) {
		c.LogAudit("fail - inappropriate permissions")
		// here we return Not_found instead of a permissions error so we don't leak the existence of
		// a command to someone without permissions for the team it belongs to.
		c.SetCommandNotFoundError()
		return
	}

	if c.AppContext.Session().UserId != cmd.CreatorId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), cmd.TeamId, model.PermissionManageOthersSlashCommands) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersSlashCommands)
		return
	}

	// Verify that the command creator has permission to the new team
	// This prevents moving a command to a team where its creator doesn't have access
	if !c.App.HasPermissionToTeam(c.AppContext, cmd.CreatorId, newTeam.Id, model.PermissionManageOwnSlashCommands) {
		c.LogAudit("fail - command creator does not have permission to new team")
		c.Err = model.NewAppError("moveCommand", "api.command.move_command.creator_no_permission.app_error", nil, "creator_id="+cmd.CreatorId+" team_id="+newTeam.Id, http.StatusBadRequest)
		return
	}

	if appErr = c.App.MoveCommand(newTeam, cmd); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(cmd)
	auditRec.AddEventObjectType("command")
	auditRec.Success()
	c.LogAudit("success")

	ReturnStatusOK(w)
}

func deleteCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	commandId := c.RequireParam("command_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	commandIdStr := commandId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteCommand, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "command_id", commandIdStr)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	cmd, err := c.App.GetCommand(commandIdStr)
	if err != nil {
		c.SetCommandNotFoundError()
		return
	}
	auditRec.AddEventPriorState(cmd)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), cmd.TeamId, model.PermissionManageOwnSlashCommands) {
		c.LogAudit("fail - inappropriate permissions")
		// here we return Not_found instead of a permissions error so we don't leak the existence of
		// a command to someone without permissions for the team it belongs to.
		c.SetCommandNotFoundError()
		return
	}

	if c.AppContext.Session().UserId != cmd.CreatorId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), cmd.TeamId, model.PermissionManageOthersSlashCommands) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersSlashCommands)
		return
	}

	err = c.App.DeleteCommand(cmd.Id)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventObjectType("command")
	auditRec.Success()
	c.LogAudit("success")

	ReturnStatusOK(w)
}

func listCommands(c *Context, w http.ResponseWriter, r *http.Request) {
	customOnly := c.RequireParam("custom_only", web.RequireBool)
	teamId := c.RequireParam("team_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	customOnlyBool := customOnly.(bool)
	teamIdStr := teamId.(string)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamIdStr, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	var commands []*model.Command
	var err *model.AppError
	if customOnlyBool {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamIdStr, model.PermissionManageOwnSlashCommands) {
			c.SetPermissionError(model.PermissionManageOwnSlashCommands)
			return
		}

		// Filter to only commands the user can manage
		userIdFilter := c.AppContext.Session().UserId
		if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamIdStr, model.PermissionManageOthersSlashCommands) {
			userIdFilter = "" // Empty means return all commands
		}

		commands, err = c.App.ListTeamCommandsByUser(teamIdStr, userIdFilter)
		if err != nil {
			c.Err = err
			return
		}
	} else {
		//User with no permission should see only system commands
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamIdStr, model.PermissionManageOwnSlashCommands) {
			commands, err = c.App.ListAutocompleteCommands(teamIdStr, c.AppContext.T)
			if err != nil {
				c.Err = err
				return
			}
		} else {
			// Filter custom commands to only those the user can manage
			userIdFilter := c.AppContext.Session().UserId
			if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamIdStr, model.PermissionManageOthersSlashCommands) {
				userIdFilter = "" // Empty means return all commands
			}

			commands, err = c.App.ListAllCommandsByUser(teamIdStr, userIdFilter, c.AppContext.T)
			if err != nil {
				c.Err = err
				return
			}
		}
	}

	if err := json.NewEncoder(w).Encode(commands); err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func getCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	commandId := c.RequireParam("command_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	commandIdStr := commandId.(string)

	cmd, err := c.App.GetCommand(commandIdStr)
	if err != nil {
		c.SetCommandNotFoundError()
		return
	}

	// check for permissions to view this command; must have perms to view team and
	// PERMISSION_MANAGE_SLASH_COMMANDS for the team the command belongs to.

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), cmd.TeamId, model.PermissionViewTeam) {
		// here we return Not_found instead of a permissions error so we don't leak the existence of
		// a command to someone without permissions for the team it belongs to.
		c.SetCommandNotFoundError()
		return
	}
	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), cmd.TeamId, model.PermissionManageOwnSlashCommands) {
		// again, return not_found to ensure id existence does not leak.
		c.SetCommandNotFoundError()
		return
	}

	if c.AppContext.Session().UserId != cmd.CreatorId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), cmd.TeamId, model.PermissionManageOthersSlashCommands) {
		c.SetCommandNotFoundError()
		return
	}
	if err := json.NewEncoder(w).Encode(cmd); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func executeCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	var commandArgs model.CommandArgs
	if jsonErr := json.NewDecoder(r.Body).Decode(&commandArgs); jsonErr != nil {
		c.SetInvalidParamWithErr("command_args", jsonErr)
		return
	}

	if len(commandArgs.Command) <= 1 || strings.Index(commandArgs.Command, "/") != 0 || !model.IsValidId(commandArgs.ChannelId) {
		c.Err = model.NewAppError("executeCommand", "api.command.execute_command.start.app_error", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventExecuteCommand, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "command_args", &commandArgs)

	// Checks that user is a member of the specified channel, and that they have permission to create a post in it.
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), commandArgs.ChannelId, model.PermissionCreatePost); !ok {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, commandArgs.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("createPost", "api.command.execute_command.deleted.error", nil, "", http.StatusBadRequest)
		return
	}

	if channel.Type != model.ChannelTypeDirect && channel.Type != model.ChannelTypeGroup {
		// if this isn't a DM or GM, the team id is implicitly taken from the channel so that slash commands created on
		// some other team can't be run against this one
		commandArgs.TeamId = channel.TeamId
	} else {
		restrictDM, appErr := c.App.CheckIfChannelIsRestrictedDM(c.AppContext, channel)
		if appErr != nil {
			c.Err = err
			return
		}

		if restrictDM {
			c.Err = model.NewAppError("createPost", "api.command.execute_command.restricted_dm.error", nil, "", http.StatusBadRequest)
			return
		}

		// if the slash command was used in a DM or GM, ensure that the user is a member of the specified team, so that
		// they can't just execute slash commands against arbitrary teams
		if c.AppContext.Session().GetTeamByTeamId(commandArgs.TeamId) == nil {
			if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreatePost) {
				c.SetPermissionError(model.PermissionCreatePost)
				return
			}
		}
	}

	commandArgs.UserId = c.AppContext.Session().UserId
	commandArgs.T = c.AppContext.T
	commandArgs.SiteURL = c.GetSiteURLHeader()

	response, err := c.App.ExecuteCommand(c.AppContext, &commandArgs)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func listAutocompleteCommands(c *Context, w http.ResponseWriter, r *http.Request) {
	teamId := c.RequireParam("team_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	teamIdStr := teamId.(string)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamIdStr, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	commands, err := c.App.ListAutocompleteCommands(teamIdStr, c.AppContext.T)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(commands); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func listCommandAutocompleteSuggestions(c *Context, w http.ResponseWriter, r *http.Request) {
	teamId := c.RequireParam("team_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	teamIdStr := teamId.(string)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamIdStr, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	roleId := model.SystemUserRoleId
	if c.IsSystemAdmin() {
		roleId = model.SystemAdminRoleId
	}

	query := r.URL.Query()
	userInput := query.Get("user_input")
	if userInput == "" {
		c.SetInvalidParam("userInput")
		return
	}
	userInput = strings.TrimPrefix(userInput, "/")

	commands, appErr := c.App.ListAutocompleteCommands(teamIdStr, c.AppContext.T)
	if appErr != nil {
		c.Err = appErr
		return
	}

	commandArgs := &model.CommandArgs{
		ChannelId: query.Get("channel_id"),
		TeamId:    teamIdStr,
		RootId:    query.Get("root_id"),
		UserId:    c.AppContext.Session().UserId,
		T:         c.AppContext.T,
		SiteURL:   c.GetSiteURLHeader(),
		Command:   userInput,
	}

	suggestions := c.App.GetSuggestions(c.AppContext, commandArgs, commands, roleId)

	js, err := json.Marshal(suggestions)
	if err != nil {
		c.Err = model.NewAppError("listCommandAutocompleteSuggestions", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func regenCommandToken(c *Context, w http.ResponseWriter, r *http.Request) {
	commandId := c.RequireParam("command_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	commandIdStr := commandId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventRegenCommandToken, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	cmd, err := c.App.GetCommand(commandIdStr)
	if err != nil {
		model.AddEventParameterToAuditRec(auditRec, "command_id", commandIdStr)
		c.SetCommandNotFoundError()
		return
	}
	auditRec.AddEventPriorState(cmd)
	model.AddEventParameterToAuditRec(auditRec, "command_id", commandIdStr)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), cmd.TeamId, model.PermissionManageOwnSlashCommands) {
		c.LogAudit("fail - inappropriate permissions")
		// here we return Not_found instead of a permissions error so we don't leak the existence of
		// a command to someone without permissions for the team it belongs to.
		c.SetCommandNotFoundError()
		return
	}

	if c.AppContext.Session().UserId != cmd.CreatorId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), cmd.TeamId, model.PermissionManageOthersSlashCommands) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersSlashCommands)
		return
	}

	rcmd, err := c.App.RegenCommandToken(cmd)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventResultState(rcmd)
	auditRec.Success()
	c.LogAudit("success")

	resp := make(map[string]string)
	resp["token"] = rcmd.Token

	if _, err := w.Write([]byte(model.MapToJSON(resp))); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
