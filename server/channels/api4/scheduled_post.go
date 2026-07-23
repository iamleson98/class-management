package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/v8/channels/app"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitScheduledPost() {
	api.BaseRoutes.Posts.Method(http.MethodPost, "/schedule", api.APISessionRequired(createSchedulePost))
	api.BaseRoutes.Posts.Method(http.MethodPut, "/schedule/{scheduled_post_id:[A-Za-z0-9]+}", api.APISessionRequired(updateScheduledPost))
	api.BaseRoutes.Posts.Method(http.MethodDelete, "/schedule/{scheduled_post_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteScheduledPost))
	api.BaseRoutes.Posts.Method(http.MethodGet, "/scheduled/team/{team_id:[A-Za-z0-9]+}", api.APISessionRequired(getTeamScheduledPosts))
}

func scheduledPostChecks(where string, c *Context, scheduledPost *model.ScheduledPost) {
	// ***************************************************************
	// NOTE - if you make any change here, please make sure to apply the
	//	      same change for scheduled posts job as well in the `canPostScheduledPost()` function
	//	      in app layer.
	// ***************************************************************

	userCreatePostPermissionCheckWithContext(c, scheduledPost.ChannelId)
	if c.Err != nil {
		return
	}

	postHardenedModeCheckWithContext(where, c, scheduledPost.GetProps())
	if c.Err != nil {
		return
	}

	postPriorityCheckWithContext(where, c, scheduledPost.GetPriority(), scheduledPost.RootId)
}

func requireScheduledPostsEnabled(c *Context) {
	if !*c.App.Srv().Config().ServiceSettings.ScheduledPosts {
		c.Err = model.NewAppError("", "api.scheduled_posts.feature_disabled", nil, "", http.StatusBadRequest)
		return
	}
}

func createSchedulePost(c *Context, w http.ResponseWriter, r *http.Request) {
	requireScheduledPostsEnabled(c)
	if c.Err != nil {
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	var scheduledPost model.ScheduledPost
	if err := json.NewDecoder(r.Body).Decode(&scheduledPost); err != nil {
		c.SetInvalidParamWithErr("schedule_post", err)
		return
	}
	scheduledPost.UserId = c.AppContext.Session().UserId
	scheduledPost.SanitizeInput()

	auditRec := c.MakeAuditRecord(model.AuditEventCreateSchedulePost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterAuditableToAuditRec(auditRec, "scheduledPost", &scheduledPost)

	if len(scheduledPost.FileIds) > 0 {
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), scheduledPost.ChannelId, model.PermissionUploadFile); !ok {
			c.SetPermissionError(model.PermissionUploadFile)
			return
		}
	}

	scheduledPostChecks("Api4.createSchedulePost", c, &scheduledPost)
	if c.Err != nil {
		return
	}

	createdScheduledPost, appErr := c.App.SaveScheduledPost(c.AppContext, &scheduledPost, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(createdScheduledPost)
	auditRec.AddEventObjectType("scheduledPost")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(createdScheduledPost); err != nil {
		mlog.Error("failed to encode scheduled post to return API response", mlog.Err(err))
		return
	}
}

func getTeamScheduledPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	requireScheduledPostsEnabled(c)
	if c.Err != nil {
		return
	}

	teamId := c.RequireParam("team_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	teamIdStr := teamId.(string)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamIdStr, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	userId := c.AppContext.Session().UserId

	scheduledPosts, appErr := c.App.GetUserTeamScheduledPosts(c.AppContext, userId, teamIdStr)
	if appErr != nil {
		c.Err = appErr
		return
	}

	response := map[string][]*model.ScheduledPost{}
	response[teamIdStr] = scheduledPosts

	if r.URL.Query().Get("includeDirectChannels") == "true" {
		directChannelScheduledPosts, appErr := c.App.GetUserTeamScheduledPosts(c.AppContext, userId, "")
		if appErr != nil {
			c.Err = appErr
			return
		}

		response["directChannels"] = directChannelScheduledPosts
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		mlog.Error("failed to encode scheduled posts to return API response", mlog.Err(err))
		return
	}
}

func updateScheduledPost(c *Context, w http.ResponseWriter, r *http.Request) {
	requireScheduledPostsEnabled(c)
	if c.Err != nil {
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	scheduledPostId := c.RequireParam("scheduled_post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	scheduledPostIdStr := scheduledPostId.(string)

	var scheduledPost model.ScheduledPost
	if err := json.NewDecoder(r.Body).Decode(&scheduledPost); err != nil {
		c.SetInvalidParamWithErr("schedule_post", err)
		return
	}

	if scheduledPost.Id != scheduledPostIdStr {
		c.SetInvalidURLParam("scheduled_post_id")
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateScheduledPost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterAuditableToAuditRec(auditRec, "scheduledPost", &scheduledPost)

	userId := c.AppContext.Session().UserId
	existingScheduledPost, err := c.App.Srv().Store().ScheduledPost().Get(scheduledPost.Id)
	if err != nil {
		c.Err = model.NewAppError("updateScheduledPost", "app.update_scheduled_post.get_scheduled_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if existingScheduledPost == nil {
		c.Err = model.NewAppError("updateScheduledPost", "app.update_scheduled_post.existing_scheduled_post.not_exist", nil, "", http.StatusNotFound)
		return
	}
	if existingScheduledPost.UserId != userId {
		c.Err = model.NewAppError("updateScheduledPost", "app.update_scheduled_post.update_permission.error", nil, "", http.StatusForbidden)
		return
	}

	if len(scheduledPost.FileIds) > 0 {
		originalPost, err := existingScheduledPost.ToPost()
		if err != nil {
			c.Err = model.NewAppError("updateScheduledPost", "app.update_scheduled_post.convert_to_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}
		checkUploadFilePermissionForNewFiles(c, scheduledPost.FileIds, originalPost)
		if c.Err != nil {
			return
		}
	}

	scheduledPostChecks("Api4.updateScheduledPost", c, &scheduledPost)
	if c.Err != nil {
		return
	}

	updatedScheduledPost, appErr := c.App.UpdateScheduledPost(c.AppContext, userId, &scheduledPost, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedScheduledPost)
	auditRec.AddEventObjectType("scheduledPost")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(updatedScheduledPost); err != nil {
		mlog.Error("failed to encode scheduled post to return API response", mlog.Err(err))
		return
	}
}

func deleteScheduledPost(c *Context, w http.ResponseWriter, r *http.Request) {
	requireScheduledPostsEnabled(c)
	if c.Err != nil {
		return
	}

	scheduledPostId := c.RequireParam("scheduled_post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	scheduledPostIdStr := scheduledPostId.(string)

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteScheduledPost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "scheduledPostId", scheduledPostIdStr)

	userId := c.AppContext.Session().UserId

	existingScheduledPost, err := c.App.Srv().Store().ScheduledPost().Get(scheduledPostIdStr)
	if err != nil {
		c.Err = model.NewAppError("deleteScheduledPost", "app.delete_scheduled_post.get_scheduled_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if existingScheduledPost == nil {
		c.Err = model.NewAppError("deleteScheduledPost", "app.delete_scheduled_post.existing_scheduled_post.not_exist", nil, "", http.StatusNotFound)
		return
	}
	if existingScheduledPost.UserId != userId {
		c.Err = model.NewAppError("deleteScheduledPost", "app.delete_scheduled_post.delete_permission.error", nil, "", http.StatusForbidden)
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)
	deletedScheduledPost, appErr := c.App.DeleteScheduledPost(c.AppContext, userId, scheduledPostIdStr, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(deletedScheduledPost)
	auditRec.AddEventObjectType("scheduledPost")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(deletedScheduledPost); err != nil {
		mlog.Error("failed to encode scheduled post to return API response", mlog.Err(err))
		return
	}
}
