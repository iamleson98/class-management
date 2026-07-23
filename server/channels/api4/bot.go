package api4

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitBot() {
	api.BaseRoutes.Bots.Method(http.MethodPost, "/", api.APISessionRequired(createBot))
	api.BaseRoutes.Bot.Method(http.MethodPut, "/", api.APISessionRequired(patchBot))
	api.BaseRoutes.Bot.Method(http.MethodGet, "/", api.APISessionRequired(getBot))
	api.BaseRoutes.Bots.Method(http.MethodGet, "/", api.APISessionRequired(getBots))
	api.BaseRoutes.Bot.Method(http.MethodPost, "/disable", api.APISessionRequired(disableBot))
	api.BaseRoutes.Bot.Method(http.MethodPost, "/enable", api.APISessionRequired(enableBot))
	api.BaseRoutes.Bot.Method(http.MethodPost, "/convert_to_user", api.APISessionRequired(convertBotToUser))
	api.BaseRoutes.Bot.Method(http.MethodPost, "/assign/{user_id:[A-Za-z0-9]+}", api.APISessionRequired(assignBot))
}

func createBot(c *Context, w http.ResponseWriter, r *http.Request) {
	var botPatch *model.BotPatch
	err := json.NewDecoder(r.Body).Decode(&botPatch)
	if err != nil || botPatch == nil {
		c.SetInvalidParamWithErr("bot", err)
		return
	}

	bot := &model.Bot{
		OwnerId: c.AppContext.Session().UserId,
	}
	bot.Patch(botPatch)

	auditRec := c.MakeAuditRecord(model.AuditEventCreateBot, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "bot", bot)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateBot) {
		c.SetPermissionError(model.PermissionCreateBot)
		return
	}

	if user, err := c.App.GetUser(c.AppContext.Session().UserId); err == nil {
		if user.IsBot {
			c.SetPermissionError(model.PermissionCreateBot)
			return
		}
	}

	if !*c.App.Config().ServiceSettings.EnableBotAccountCreation {
		c.Err = model.NewAppError("createBot", "api.bot.create_disabled", nil, "", http.StatusForbidden)
		return
	}

	createdBot, appErr := c.App.CreateBot(c.AppContext, bot)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("bot")
	auditRec.AddEventResultState(createdBot) // overwrite meta

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(createdBot); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchBot(c *Context, w http.ResponseWriter, r *http.Request) {
	botUserId := c.RequireParam("bot_user_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	botUserIdStr := botUserId.(string)

	var botPatch *model.BotPatch
	err := json.NewDecoder(r.Body).Decode(&botPatch)
	if err != nil || botPatch == nil {
		c.SetInvalidParamWithErr("bot", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchBot, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", botUserIdStr)
	model.AddEventParameterAuditableToAuditRec(auditRec, "bot", botPatch)

	if err := c.App.SessionHasPermissionToManageBot(c.AppContext, *c.AppContext.Session(), botUserIdStr); err != nil {
		c.Err = err
		return
	}

	updatedBot, appErr := c.App.PatchBot(c.AppContext, botUserIdStr, botPatch)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedBot)
	auditRec.AddEventObjectType("bot")

	if err := json.NewEncoder(w).Encode(updatedBot); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getBot(c *Context, w http.ResponseWriter, r *http.Request) {
	botUserId := c.RequireParam("bot_user_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	botUserIdStr := botUserId.(string)

	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))

	bot, appErr := c.App.GetBot(c.AppContext, botUserIdStr, includeDeleted)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadOthersBots) {
		// Allow access to any bot.
	} else if bot.OwnerId == c.AppContext.Session().UserId {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadBots) {
			// Pretend like the bot doesn't exist at all to avoid revealing that the
			// user is a bot. It's kind of silly in this case, sine we created the bot,
			// but we don't have read bot permissions.
			c.Err = model.MakeBotNotFoundError("permissions", botUserIdStr)
			return
		}
	} else {
		// Pretend like the bot doesn't exist at all, to avoid revealing that the
		// user is a bot.
		c.Err = model.MakeBotNotFoundError("permissions", botUserIdStr)
		return
	}

	if c.HandleEtag(bot.Etag(), "Get Bot", w, r) {
		return
	}

	if err := json.NewEncoder(w).Encode(bot); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getBots(c *Context, w http.ResponseWriter, r *http.Request) {
	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))
	onlyOrphaned, _ := strconv.ParseBool(r.URL.Query().Get("only_orphaned"))

	page := c.RequireParam("page", web.RequireInt)
	perPage := c.RequireParam("per_page", web.RequireInt)
	if c.Err != nil {
		return
	}

	var OwnerId string
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadOthersBots) {
		// Get bots created by any user.
		OwnerId = ""
	} else if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadBots) {
		// Only get bots created by this user.
		OwnerId = c.AppContext.Session().UserId
	} else {
		c.SetPermissionError(model.PermissionReadBots)
		return
	}

	bots, appErr := c.App.GetBots(c.AppContext, &model.BotGetOptions{
		Page:           page.(int),
		PerPage:        perPage.(int),
		OwnerId:        OwnerId,
		IncludeDeleted: includeDeleted,
		OnlyOrphaned:   onlyOrphaned,
	})
	if appErr != nil {
		c.Err = appErr
		return
	}

	if c.HandleEtag(bots.Etag(), "Get Bots", w, r) {
		return
	}

	if err := json.NewEncoder(w).Encode(bots); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func disableBot(c *Context, w http.ResponseWriter, _ *http.Request) {
	updateBotActive(c, w, false)
}

func enableBot(c *Context, w http.ResponseWriter, _ *http.Request) {
	updateBotActive(c, w, true)
}

func updateBotActive(c *Context, w http.ResponseWriter, active bool) {
	botUserId := c.RequireParam("bot_user_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	botUserIdStr := botUserId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateBotActive, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", botUserIdStr)
	model.AddEventParameterToAuditRec(auditRec, "enable", active)

	if err := c.App.SessionHasPermissionToManageBot(c.AppContext, *c.AppContext.Session(), botUserIdStr); err != nil {
		c.Err = err
		return
	}

	bot, err := c.App.UpdateBotActive(c.AppContext, botUserIdStr, active)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(bot)
	auditRec.AddEventObjectType("bot")

	if err := json.NewEncoder(w).Encode(bot); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func assignBot(c *Context, w http.ResponseWriter, _ *http.Request) {
	botUserId := c.RequireParam("bot_user_id", web.RequireValidId)
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	botUserIdStr := botUserId.(string)
	userIdStr := c.Params["user_id"].(string)

	auditRec := c.MakeAuditRecord(model.AuditEventAssignBot, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", botUserIdStr)
	model.AddEventParameterToAuditRec(auditRec, "user_id", userIdStr)

	if err := c.App.SessionHasPermissionToManageBot(c.AppContext, *c.AppContext.Session(), botUserIdStr); err != nil {
		c.Err = err
		return
	}

	if user, err := c.App.GetUser(userIdStr); err == nil {
		if user.IsBot {
			c.SetPermissionError(model.PermissionAssignBot)
			return
		}
	}

	bot, err := c.App.UpdateBotOwner(c.AppContext, botUserIdStr, userIdStr)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(bot)
	auditRec.AddEventObjectType("bot")

	if err := json.NewEncoder(w).Encode(bot); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func convertBotToUser(c *Context, w http.ResponseWriter, r *http.Request) {
	botUserId := c.RequireParam("bot_user_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	botUserIdStr := botUserId.(string)

	bot, err := c.App.GetBot(c.AppContext, botUserIdStr, false)
	if err != nil {
		c.Err = err
		return
	}

	var userPatch model.UserPatch
	jsonErr := json.NewDecoder(r.Body).Decode(&userPatch)
	if jsonErr != nil || userPatch.Password == nil || *userPatch.Password == "" {
		c.SetInvalidParamWithErr("userPatch", jsonErr)
		return
	}

	systemAdmin, _ := strconv.ParseBool(r.URL.Query().Get("set_system_admin"))

	auditRec := c.MakeAuditRecord(model.AuditEventConvertBotToUser, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "bot", bot)
	model.AddEventParameterAuditableToAuditRec(auditRec, "user_patch", &userPatch)
	model.AddEventParameterToAuditRec(auditRec, "set_system_admin", systemAdmin)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	user, err := c.App.ConvertBotToUser(c.AppContext, bot, &userPatch, systemAdmin)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(user)
	auditRec.AddEventObjectType("user")

	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
