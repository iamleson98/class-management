package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/app"
	"github.com/iamleson98/sitename/server/v8/channels/store/sqlstore"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitPost() {
	api.BaseRoutes.Posts.Method(http.MethodPost, "/", api.APISessionRequired(createPost))
	api.BaseRoutes.Post.Method(http.MethodGet, "/", api.APISessionRequired(getPost))
	api.BaseRoutes.Post.Method(http.MethodDelete, "/", api.APISessionRequired(deletePost))
	api.BaseRoutes.Posts.Method(http.MethodPost, "/ids", api.APISessionRequired(getPostsByIds))
	api.BaseRoutes.Posts.Method(http.MethodPost, "/ephemeral", api.APISessionRequired(createEphemeralPost))
	api.BaseRoutes.Post.Method(http.MethodGet, "/edit_history", api.APISessionRequired(getEditHistoryForPost))
	api.BaseRoutes.Post.Method(http.MethodGet, "/thread", api.APISessionRequired(getPostThread))
	api.BaseRoutes.Post.Method(http.MethodGet, "/info", api.APISessionRequired(getPostInfo))
	api.BaseRoutes.Post.Method(http.MethodGet, "/files/info", api.APISessionRequired(getFileInfosForPost))
	api.BaseRoutes.PostsForChannel.Method(http.MethodGet, "/", api.APISessionRequired(getPostsForChannel))
	api.BaseRoutes.PostsForUser.Method(http.MethodGet, "/flagged", api.APISessionRequired(getFlaggedPostsForUser))

	api.BaseRoutes.ChannelForUser.Method(http.MethodGet, "/posts/unread", api.APISessionRequired(getPostsForChannelAroundLastUnread))

	api.BaseRoutes.Team.Method(http.MethodPost, "/posts/search", api.APISessionRequiredDisableWhenBusy(searchPostsInTeam))
	api.BaseRoutes.Posts.Method(http.MethodPost, "/search", api.APISessionRequiredDisableWhenBusy(searchPostsInAllTeams))
	api.BaseRoutes.Post.Method(http.MethodPut, "/", api.APISessionRequired(updatePost))
	api.BaseRoutes.Post.Method(http.MethodPut, "/patch", api.APISessionRequired(patchPost))
	api.BaseRoutes.Post.Method(http.MethodPost, "/restore/{restore_version_id:[A-Za-z0-9]+}", api.APISessionRequired(restorePostVersion))
	api.BaseRoutes.PostForUser.Method(http.MethodPost, "/set_unread", api.APISessionRequired(setPostUnread))
	api.BaseRoutes.PostForUser.Method(http.MethodPost, "/reminder", api.APISessionRequired(setPostReminder))

	api.BaseRoutes.Post.Method(http.MethodPost, "/pin", api.APISessionRequired(pinPost))
	api.BaseRoutes.Post.Method(http.MethodPost, "/unpin", api.APISessionRequired(unpinPost))

	api.BaseRoutes.PostForUser.Method(http.MethodPost, "/ack", api.APISessionRequired(acknowledgePost))
	api.BaseRoutes.PostForUser.Method(http.MethodDelete, "/ack", api.APISessionRequired(unacknowledgePost))

	api.BaseRoutes.Post.Method(http.MethodPost, "/move", api.APISessionRequired(moveThread))

	api.BaseRoutes.Post.Method(http.MethodGet, "/reveal", api.APISessionRequired(revealPost))
	api.BaseRoutes.Post.Method(http.MethodDelete, "/burn", api.APISessionRequired(burnPost))
}

func createPostChecks(where string, c *Context, post *model.Post) {
	// ***************************************************************
	// NOTE - if you make any change here, please make sure to apply the
	//	      same change for scheduled posts as well in the `scheduledPostChecks()` function
	//	      in API layer.
	// ***************************************************************

	userCreatePostPermissionCheckWithContext(c, post.ChannelId)
	if c.Err != nil {
		return
	}

	if len(post.FileIds) > 0 {
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionUploadFile); !ok {
			c.SetPermissionError(model.PermissionUploadFile)
			return
		}
	}

	postHardenedModeCheckWithContext(where, c, post.GetProps())
	if c.Err != nil {
		return
	}

	postPriorityCheckWithContext(where, c, post.GetPriority(), post.RootId)
}

func createPost(c *Context, w http.ResponseWriter, r *http.Request) {
	var post model.Post
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	post.SanitizeInput()
	post.UserId = c.AppContext.Session().UserId

	auditRec := c.MakeAuditRecord(model.AuditEventCreatePost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterAuditableToAuditRec(auditRec, "post", &post)

	if post.CreateAt != 0 && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		post.CreateAt = 0
	}

	createPostChecks("Api4.createPost", c, &post)
	if c.Err != nil {
		return
	}

	setOnline := r.URL.Query().Get("set_online")
	setOnlineBool := true // By default, always set online.
	var err2 error
	if setOnline != "" {
		setOnlineBool, err2 = strconv.ParseBool(setOnline)
		if err2 != nil {
			c.Logger.Warn("Failed to parse set_online URL query parameter from createPost request", mlog.Err(err2))
			setOnlineBool = true // Set online nevertheless.
		}
	}

	rp, isMemberForPreviews, err := c.App.CreatePostAsUser(c.AppContext, c.App.PostWithProxyRemovedFromImageURLs(&post), c.AppContext.Session().Id, setOnlineBool)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	auditRec.AddEventResultState(rp)
	auditRec.AddEventObjectType("post")

	if !isMemberForPreviews {
		previewPost := rp.GetPreviewPost()
		if previewPost != nil {
			model.AddEventParameterToAuditRec(auditRec, "preview_post_id", previewPost.Post.Id)
		}
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	if setOnlineBool {
		c.App.SetStatusOnline(c.AppContext.Session().UserId, false)
	}

	c.App.Srv().Platform().UpdateLastActivityAtIfNeeded(*c.AppContext.Session())
	c.ExtendSessionExpiryIfNeeded(w, r)

	w.WriteHeader(http.StatusCreated)

	// Note that rp has already had PreparePostForClient called on it by App.CreatePost
	// For burn-on-read posts, the author should see the revealed content in the API response
	// to avoid relying on websocket events which may fail due to connection issues
	if rp.Type == model.PostTypeBurnOnRead && rp.UserId == c.AppContext.Session().UserId {
		// Force read from master DB to avoid replication delay issues in DB cluster environments.
		// Without this, the replica might not have the post yet, causing "not found" errors.
		masterCtx := sqlstore.RequestContextWithMaster(c.AppContext)
		revealedPost, appErr := c.App.GetSinglePost(masterCtx, rp.Id, false)
		if appErr != nil {
			c.Err = appErr
			return
		}
		// GetSinglePost calls RevealBurnOnReadPostsForUser which reveals the post for the author,
		// then PreparePostForClient adds metadata (reactions, files, embeds).
		rp = c.App.PreparePostForClient(masterCtx, revealedPost, &model.PreparePostForClientOpts{
			IsNewPost: true,
		})

		// Send pending post ID back to client so it can update it in Redux store
		rp.PendingPostId = post.PendingPostId
	}

	if err := rp.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createEphemeralPost(c *Context, w http.ResponseWriter, r *http.Request) {
	ephRequest := model.PostEphemeral{}

	jsonErr := json.NewDecoder(r.Body).Decode(&ephRequest)
	if jsonErr != nil {
		c.SetInvalidParamWithErr("body", jsonErr)
		return
	}

	if ephRequest.UserID == "" {
		c.SetInvalidParam("user_id")
		return
	}

	if ephRequest.Post == nil {
		c.SetInvalidParam("post")
		return
	}

	ephRequest.Post.UserId = c.AppContext.Session().UserId
	ephRequest.Post.CreateAt = model.GetMillis()

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreatePostEphemeral) {
		c.SetPermissionError(model.PermissionCreatePostEphemeral)
		return
	}

	// We prepare again the post here, so we can ignore the isMemberForPreviews return value from SendEphemeralPost
	rp, _ := c.App.SendEphemeralPost(c.AppContext, ephRequest.UserID, c.App.PostWithProxyRemovedFromImageURLs(ephRequest.Post))

	w.WriteHeader(http.StatusCreated)
	rp = model.AddPostActionCookies(rp, c.App.PostActionCookieSecret())
	rp = c.App.PreparePostForClientWithEmbedsAndImages(c.AppContext, rp, &model.PreparePostForClientOpts{IsNewPost: true, IncludePriority: true})
	rp, isMemberForPreviews, err := c.App.SanitizePostMetadataForUser(c.AppContext, rp, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}
	if err := rp.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateEphemeralPost, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "post_id", rp.Id)

	if !isMemberForPreviews {
		previewPost := rp.GetPreviewPost()
		if previewPost != nil {
			model.AddEventParameterToAuditRec(auditRec, "preview_post_id", previewPost.Post.Id)
		}
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}
	auditRec.Success()
}

func getPostsForChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	channelIdStr := c.RequireParam("channel_id", web.RequireValidId)
	pageInt := c.RequireParam("page", web.RequireInt)
	perPageInt := c.RequireParam("per_page", web.RequireInt)
	if c.Err != nil {
		return
	}

	afterPost := r.URL.Query().Get("after")
	if afterPost != "" && !model.IsValidId(afterPost) {
		c.SetInvalidParam("after")
		return
	}

	beforePost := r.URL.Query().Get("before")
	if beforePost != "" && !model.IsValidId(beforePost) {
		c.SetInvalidParam("before")
		return
	}

	sinceString := r.URL.Query().Get("since")
	var since int64
	var parseError error
	if sinceString != "" {
		since, parseError = strconv.ParseInt(sinceString, 10, 64)
		if parseError != nil {
			c.SetInvalidParamWithErr("since", parseError)
			return
		}
	}
	skipFetchThreads, _ := strconv.ParseBool(r.URL.Query().Get("skipFetchThreads"))
	collapsedThreads, _ := strconv.ParseBool(r.URL.Query().Get("collapsedThreads"))
	collapsedThreadsExtended, _ := strconv.ParseBool(r.URL.Query().Get("collapsedThreadsExtended"))
	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))

	if !c.IsSystemAdmin() && includeDeleted {
		c.SetPermissionError(model.PermissionReadDeletedPosts)
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, channelIdStr)
	if err != nil {
		c.Err = err
		return
	}
	hasPermission, isMember := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel)
	if !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	var list *model.PostList
	etag := ""

	if since > 0 {
		list, err = c.App.GetPostsSince(c.AppContext, model.GetPostsSinceOptions{ChannelId: channelIdStr, Time: since, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended, UserId: c.AppContext.Session().UserId})
	} else if afterPost != "" {
		etag = c.App.GetPostsEtag(channelIdStr, collapsedThreads)

		if c.HandleEtag(etag, "Get Posts After", w, r) {
			return
		}

		list, err = c.App.GetPostsAfterPost(c.AppContext, model.GetPostsOptions{ChannelId: channelIdStr, PostId: afterPost, Page: pageInt, PerPage: perPageInt, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, UserId: c.AppContext.Session().UserId, IncludeDeleted: includeDeleted})
	} else if beforePost != "" {
		etag = c.App.GetPostsEtag(channelIdStr, collapsedThreads)

		if c.HandleEtag(etag, "Get Posts Before", w, r) {
			return
		}

		list, err = c.App.GetPostsBeforePost(c.AppContext, model.GetPostsOptions{ChannelId: channelIdStr, PostId: beforePost, Page: pageInt, PerPage: perPageInt, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended, UserId: c.AppContext.Session().UserId, IncludeDeleted: includeDeleted})
	} else {
		etag = c.App.GetPostsEtag(channelIdStr, collapsedThreads)

		if c.HandleEtag(etag, "Get Posts", w, r) {
			return
		}

		list, err = c.App.GetPostsPage(c.AppContext, model.GetPostsOptions{ChannelId: channelIdStr, Page: pageInt, PerPage: perPageInt, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended, UserId: c.AppContext.Session().UserId, IncludeDeleted: includeDeleted})
	}

	if err != nil {
		c.Err = err
		return
	}

	if etag != "" {
		w.Header().Set(model.HeaderEtagServer, etag)
	}

	clientPostList := c.App.PreparePostListForClient(c.AppContext, list)

	// Calculate NextPostId and PrevPostId AFTER filtering (including BoR filtering)
	// to ensure they only reference posts that are actually in the response
	c.App.AddCursorIdsForPostList(clientPostList, afterPost, beforePost, since, pageInt, perPageInt, collapsedThreads)

	clientPostList, isMemberForAllPreviews, err := c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetPostsForChannel, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", channelIdStr)
	if !isMember || !isMemberForAllPreviews {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
		if !isMemberForAllPreviews {
			model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access_on_previews", true)
		}
	}
}

func getPostsForChannelAroundLastUnread(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)
	channelIdStr := c.RequireParam("channel_id", web.RequireValidId)
	limitAfterInt := c.RequireParam("limit_after", web.RequireInt)
	limitBeforeInt := c.RequireParam("limit_before", web.RequireInt)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, channelIdStr)
	if err != nil {
		c.Err = err
		return
	}
	hasPermission, isMember := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel)
	if !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	skipFetchThreads := r.URL.Query().Get("skipFetchThreads") == "true"
	collapsedThreads := r.URL.Query().Get("collapsedThreads") == "true"
	collapsedThreadsExtended := r.URL.Query().Get("collapsedThreadsExtended") == "true"

	postList, err := c.App.GetPostsForChannelAroundLastUnread(c.AppContext, channelIdStr, userIdStr, limitBeforeInt, limitAfterInt, skipFetchThreads, collapsedThreads, collapsedThreadsExtended)
	if err != nil {
		c.Err = err
		return
	}

	etag := ""
	if len(postList.Order) == 0 {
		etag = c.App.GetPostsEtag(channelIdStr, collapsedThreads)

		if c.HandleEtag(etag, "Get Posts", w, r) {
			return
		}

		postList, err = c.App.GetPostsPage(c.AppContext, model.GetPostsOptions{ChannelId: channelIdStr, Page: app.PageDefault, PerPage: limitBeforeInt, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended, UserId: c.AppContext.Session().UserId})
		if err != nil {
			c.Err = err
			return
		}
	}

	clientPostList := c.App.PreparePostListForClient(c.AppContext, postList)

	// Calculate NextPostId and PrevPostId AFTER filtering (including BoR filtering)
	// to ensure they only reference posts that are actually in the response
	clientPostList.NextPostId = c.App.GetNextPostIdFromPostList(clientPostList, collapsedThreads)
	clientPostList.PrevPostId = c.App.GetPrevPostIdFromPostList(clientPostList, collapsedThreads)
	clientPostList, isMemberForAllPreviews, err := c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	if etag != "" {
		w.Header().Set(model.HeaderEtagServer, etag)
	}
	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetPostsForChannelAroundLastUnread, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", channelIdStr)

	if !isMember || !isMemberForAllPreviews {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
		if !isMemberForAllPreviews {
			model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access_on_previews", true)
		}
	}
}

func getFlaggedPostsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	channelId := r.URL.Query().Get("channel_id")
	teamId := r.URL.Query().Get("team_id")

	var posts *model.PostList
	var err *model.AppError

	if channelId != "" {
		posts, err = c.App.GetFlaggedPostsForChannel(c.AppContext, userIdStr, channelId, c.Params["page"].(int), c.Params["per_page"].(int))
	} else if teamId != "" {
		posts, err = c.App.GetFlaggedPostsForTeam(c.AppContext, userIdStr, teamId, c.Params["page"].(int), c.Params["per_page"].(int))
	} else {
		posts, err = c.App.GetFlaggedPosts(c.AppContext, userIdStr, c.Params["page"].(int), c.Params["per_page"].(int))
	}
	if err != nil {
		c.Err = err
		return
	}

	channelMap := make(map[string]*model.Channel)
	channelIds := []string{}
	for _, post := range posts.Posts {
		channelIds = append(channelIds, post.ChannelId)
	}
	channels, err := c.App.GetChannels(c.AppContext, channelIds)
	if err != nil {
		c.Err = err
		return
	}
	for _, channel := range channels {
		channelMap[channel.Id] = channel
	}

	pl := model.NewPostList()
	channelReadPermission := make(map[string]bool)
	isMemberForAllPosts := true

	for _, post := range posts.Posts {
		allowed, ok := channelReadPermission[post.ChannelId]

		if !ok {
			allowed = false

			channel, ok := channelMap[post.ChannelId]
			if !ok {
				continue
			}

			hasPermission, isMember := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel)
			if hasPermission {
				allowed = true
				isMemberForAllPosts = isMemberForAllPosts && isMember
			}

			channelReadPermission[post.ChannelId] = allowed
		}

		if !allowed {
			continue
		}

		pl.AddPost(post)
		pl.AddOrder(post.Id)
	}

	pl.SortByCreateAt()
	clientPostList := c.App.PreparePostListForClient(c.AppContext, pl)
	clientPostList, isMemberForAllPreviews, err := c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetFlaggedPosts, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", channelId)

	if !isMemberForAllPosts || !isMemberForAllPreviews {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
		if !isMemberForAllPreviews {
			model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access_on_previews", true)
		}
	}

	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getPost also sets a header to indicate, if post is inaccessible due to the cloud plan's limit.
func getPost(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))
	if includeDeleted && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	post, err, isMember := c.App.GetPostIfAuthorized(c.AppContext, postIdStr, c.AppContext.Session(), includeDeleted)
	if err != nil {
		c.Err = err

		// Post is inaccessible due to cloud plan's limit.
		if err.Id == "app.post.cloud.get.app_error" {
			w.Header().Set(model.HeaderFirstInaccessiblePostTime, "1")
		}

		return
	}

	post = c.App.PreparePostForClientWithEmbedsAndImages(c.AppContext, post, &model.PreparePostForClientOpts{IncludePriority: true})
	post, previewIsMember, err := c.App.SanitizePostMetadataForUser(c.AppContext, post, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	if c.HandleEtag(post.Etag(), "Get Post", w, r) {
		return
	}

	w.Header().Set(model.HeaderEtagServer, post.Etag())
	if err := post.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetPost, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "post_id", postIdStr)

	if !isMember || !previewIsMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
		if !previewIsMember {
			previewPost := post.GetPreviewPost()
			if previewPost != nil {
				model.AddEventParameterToAuditRec(auditRec, "preview_post_id", previewPost.Post.Id)
			}
		}
	}
}

// getPostsByIds also sets a header to indicate, if posts were truncated as per the cloud plan's limit.
func getPostsByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	postIDs, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getPostsByIds", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(postIDs) == 0 {
		c.SetInvalidParam("post_ids")
		return
	}

	if len(postIDs) > 1000 {
		c.Err = model.NewAppError("getPostsByIds", "api.post.posts_by_ids.invalid_body.request_error", map[string]any{"MaxLength": 1000}, "", http.StatusBadRequest)
		return
	}

	postsList, firstInaccessiblePostTime, appErr := c.App.GetPostsByIds(postIDs)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channelMap := make(map[string]*model.Channel)
	channelIds := []string{}
	for _, post := range postsList {
		channelIds = append(channelIds, post.ChannelId)
	}
	channels, appErr := c.App.GetChannels(c.AppContext, channelIds)
	if appErr != nil {
		c.Err = appErr
		return
	}
	for _, channel := range channels {
		channelMap[channel.Id] = channel
	}

	var posts = []*model.Post{}
	isMemberForAllPosts := true
	for _, post := range postsList {
		channel, ok := channelMap[post.ChannelId]
		if !ok {
			continue
		}

		hasPermission, isMemberForCurrentPost := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel)
		if !hasPermission {
			continue
		}

		isMemberForAllPosts = isMemberForAllPosts && isMemberForCurrentPost

		post = c.App.PreparePostForClient(c.AppContext, post, &model.PreparePostForClientOpts{IncludePriority: true})
		post.StripActionIntegrations()
		posts = append(posts, post)
	}

	w.Header().Set(model.HeaderFirstInaccessiblePostTime, strconv.FormatInt(firstInaccessiblePostTime, 10))

	if err := json.NewEncoder(w).Encode(posts); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetPostsByIds, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "post_ids", postIDs)

	if !isMemberForAllPosts {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}
}

func getEditHistoryForPost(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	originalPost, err := c.App.GetSinglePost(c.AppContext, postIdStr, false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	ok, isMember := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionEditPost)
	if !ok {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	if c.AppContext.Session().UserId != originalPost.UserId {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	postsList, err := c.App.GetEditHistoryForPost(postIdStr)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetEditHistoryForPost, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "post_id", postIdStr)

	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	if err := json.NewEncoder(w).Encode(postsList); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deletePost(c *Context, w http.ResponseWriter, _ *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	permanentBool := c.RequireParam("permanent", web.RequireBool)
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeletePost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "post_id", postIdStr)
	model.AddEventParameterToAuditRec(auditRec, "permanent", permanentBool)

	if permanentBool && !*c.App.Config().ServiceSettings.EnableAPIPostDeletion {
		c.Err = model.NewAppError("deletePost", "api.post.delete_post.not_enabled.app_error", nil, "postId="+postIdStr, http.StatusNotImplemented)
		return
	}

	if permanentBool && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	post, appErr := c.App.GetSinglePost(c.AppContext, postIdStr, permanentBool)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddEventPriorState(post)
	auditRec.AddEventObjectType("post")

	if c.AppContext.Session().UserId == post.UserId {
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionDeletePost); !ok {
			c.SetPermissionError(model.PermissionDeletePost)
			return
		}
	} else {
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionDeleteOthersPosts); !ok {
			c.SetPermissionError(model.PermissionDeleteOthersPosts)
			return
		}
	}

	if permanentBool {
		appErr = c.App.PermanentDeletePost(c.AppContext, postIdStr, c.AppContext.Session().UserId)
	} else {
		_, appErr = c.App.DeletePost(c.AppContext, postIdStr, c.AppContext.Session().UserId)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func getPostThread(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	perPageInt := c.RequireParam("per_page", web.RequireInt)
	if c.Err != nil {
		return
	}

	var fromCreateAt int64
	if fromCreateAtStr := r.URL.Query().Get("fromCreateAt"); fromCreateAtStr != "" {
		var err error
		fromCreateAt, err = strconv.ParseInt(fromCreateAtStr, 10, 64)
		if err != nil {
			c.SetInvalidParamWithErr("fromCreateAt", err)
			return
		}
	}

	fromPost := r.URL.Query().Get("fromPost")
	// Either only fromCreateAt must be set, or both fromPost and fromCreateAt must be set
	if fromPost != "" && fromCreateAt == 0 {
		c.SetInvalidParam("if fromPost is set, then fromCreateAt must also be set")
		return
	}

	var fromUpdateAt int64
	if fromUpdateAtStr := r.URL.Query().Get("fromUpdateAt"); fromUpdateAtStr != "" {
		var err error
		fromUpdateAt, err = strconv.ParseInt(fromUpdateAtStr, 10, 64)
		if err != nil {
			c.SetInvalidParamWithErr("fromUpdateAt", err)
			return
		}
	}

	if fromUpdateAt != 0 && fromCreateAt != 0 {
		c.SetInvalidParamWithDetails("fromUpdateAt", "both fromUpdateAt and fromCreateAt cannot be set")
		return
	}

	updatesOnly := r.URL.Query().Get("updatesOnly") == "true"
	if updatesOnly && fromUpdateAt == 0 {
		c.SetInvalidParamWithDetails("fromUpdateAt", "fromUpdateAt must be set if updatesOnly is set")
		return
	}

	direction := ""
	if dir := r.URL.Query().Get("direction"); dir != "" {
		if dir != "up" && dir != "down" {
			c.SetInvalidParam("direction")
			return
		}
		direction = dir
	}

	if updatesOnly && direction == "up" {
		c.SetInvalidParamWithDetails("updatesOnly", "updatesOnly flag cannot be used with up direction")
		return
	}

	opts := model.GetPostsOptions{
		SkipFetchThreads:         r.URL.Query().Get("skipFetchThreads") == "true",
		CollapsedThreads:         r.URL.Query().Get("collapsedThreads") == "true",
		CollapsedThreadsExtended: r.URL.Query().Get("collapsedThreadsExtended") == "true",
		UpdatesOnly:              updatesOnly,
		PerPage:                  perPageInt,
		Direction:                direction,
		FromPost:                 fromPost,
		FromCreateAt:             fromCreateAt,
		FromUpdateAt:             fromUpdateAt,
	}
	list, err := c.App.GetPostThread(c.AppContext, postIdStr, opts, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}
	if list.FirstInaccessiblePostTime != 0 {
		// e.g. if root post is archived in a cloud plan,
		// we don't want to display the thread,
		// but at the same time the request was not bad,
		// so we return the time of archival and let the client
		// show an error
		if err := (&model.PostList{Order: []string{}, FirstInaccessiblePostTime: list.FirstInaccessiblePostTime}).EncodeJSON(w); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	post, ok := list.Posts[postIdStr]
	if !ok {
		c.SetInvalidURLParam("post_id")
		return
	}

	var isMember bool
	if _, err, isMember = c.App.GetPostIfAuthorized(c.AppContext, post.Id, c.AppContext.Session(), false); err != nil {
		c.Err = err
		return
	}

	if c.HandleEtag(list.Etag(), "Get Post Thread", w, r) {
		return
	}

	clientPostList := c.App.PreparePostListForClient(c.AppContext, list)
	clientPostList, isMemberForAllPreviews, err := c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set(model.HeaderEtagServer, clientPostList.Etag())

	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetPostThread, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "post_id", postIdStr)

	if !isMember || !isMemberForAllPreviews {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
		if !isMemberForAllPreviews {
			model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access_on_previews", true)
		}
	}
}

func searchPostsInTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	teamIdStr := c.RequireParam("team_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamIdStr, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	searchPosts(c, w, r, teamIdStr)
}

func searchPostsInAllTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	searchPosts(c, w, r, "")
}

func searchPosts(c *Context, w http.ResponseWriter, r *http.Request, teamId string) {
	var params model.SearchParameter
	if jsonErr := json.NewDecoder(r.Body).Decode(&params); jsonErr != nil {
		c.Err = model.NewAppError("searchPosts", "api.post.search_posts.invalid_body.app_error", nil, "", http.StatusBadRequest).Wrap(jsonErr)
		return
	}

	if params.Terms == nil || *params.Terms == "" {
		c.SetInvalidParam("terms")
		return
	}
	terms := *params.Terms

	timeZoneOffset := 0
	if params.TimeZoneOffset != nil {
		timeZoneOffset = *params.TimeZoneOffset
	}

	isOrSearch := false
	if params.IsOrSearch != nil {
		isOrSearch = *params.IsOrSearch
	}

	page := 0
	if params.Page != nil {
		page = *params.Page
	}

	perPage := 60
	if params.PerPage != nil {
		perPage = *params.PerPage
	}

	includeDeletedChannels := false
	if params.IncludeDeletedChannels != nil {
		includeDeletedChannels = *params.IncludeDeletedChannels
	}

	auditRec := c.MakeAuditRecord(model.AuditEventSearchPosts, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelAPI)
	model.AddEventParameterAuditableToAuditRec(auditRec, "search_params", params)

	startTime := time.Now()

	results, allPostHaveMembership, err := c.App.SearchPostsForUser(c.AppContext, terms, c.AppContext.Session().UserId, teamId, isOrSearch, includeDeletedChannels, timeZoneOffset, page, perPage)

	elapsedTime := float64(time.Since(startTime)) / float64(time.Second)
	metrics := c.App.Metrics()
	if metrics != nil {
		metrics.IncrementPostsSearchCounter()
		metrics.ObservePostsSearchDuration(elapsedTime)
	}

	if err != nil {
		c.Err = err
		return
	}

	clientPostList := c.App.PreparePostListForClient(c.AppContext, results.PostList)
	clientPostList, isMemberForAllPreviews, err := c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	if !allPostHaveMembership || !isMemberForAllPreviews {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
		if !isMemberForAllPreviews {
			model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access_on_previews", true)
		}
	}

	results = model.MakePostSearchResults(clientPostList, results.Matches)
	model.AddEventParameterAuditableToAuditRec(auditRec, "search_results", results)
	auditRec.Success()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if err := results.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updatePost(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var post model.Post
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	// MM-67055: Strip client-supplied metadata.embeds to prevent spoofing.
	// This matches createPost behavior.
	post.SanitizeInput()

	auditRec := c.MakeAuditRecord(model.AuditEventUpdatePost, model.AuditStatusFail)
	model.AddEventParameterAuditableToAuditRec(auditRec, "post", &post)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	// The post being updated in the payload must be the same one as indicated in the URL.
	if post.Id != postIdStr {
		c.SetInvalidParam("id")
		return
	}

	postHardenedModeCheckWithContext("UpdatePost", c, post.GetProps())
	if c.Err != nil {
		return
	}

	originalPost, err := c.App.GetSinglePost(c.AppContext, postIdStr, false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	ok, isMember := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionEditPost)
	if !ok {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	auditRec.AddEventPriorState(originalPost)
	auditRec.AddEventObjectType("post")

	// passing a nil fileIds should not have any effect on a post's file IDs
	// so, we restore the original file IDs in this case
	if post.FileIds == nil {
		post.FileIds = originalPost.FileIds
	}

	// Check upload_file permission only if update is adding NEW files (not just keeping existing ones)
	checkUploadFilePermissionForNewFiles(c, post.FileIds, originalPost)
	if c.Err != nil {
		return
	}

	if c.AppContext.Session().UserId != originalPost.UserId {
		// We don't need to check the member here, since we already checked it above
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionEditOthersPosts); !ok {
			c.SetPermissionError(model.PermissionEditOthersPosts)
			return
		}
	}

	post.Id = postIdStr

	if *c.App.Config().ServiceSettings.PostEditTimeLimit != -1 && model.GetMillis() > originalPost.CreateAt+int64(*c.App.Config().ServiceSettings.PostEditTimeLimit*1000) && post.Message != originalPost.Message {
		c.Err = model.NewAppError("UpdatePost", "api.post.update_post.permissions_time_limit.app_error", map[string]any{"timeLimit": *c.App.Config().ServiceSettings.PostEditTimeLimit}, "", http.StatusBadRequest)
		return
	}

	rpost, isMemberForPreviews, err := c.App.UpdatePost(c.AppContext, c.App.PostWithProxyRemovedFromImageURLs(&post), &model.UpdatePostOptions{SafeUpdate: false})
	if err != nil {
		c.Err = err
		return
	}

	if !isMember || !isMemberForPreviews {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
		if !isMemberForPreviews {
			previewPost := rpost.GetPreviewPost()
			if previewPost != nil {
				model.AddEventParameterToAuditRec(auditRec, "preview_post_id", previewPost.Post.Id)
			}
		}
	}

	auditRec.Success()
	auditRec.AddEventResultState(rpost)

	if err := rpost.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchPost(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var post model.PostPatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchPost, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "id", postIdStr)
	model.AddEventParameterAuditableToAuditRec(auditRec, "patch", &post)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	if post.Props != nil {
		postHardenedModeCheckWithContext("patchPost", c, *post.Props)
		if c.Err != nil {
			return
		}
	}

	isMember := postPatchChecks(c, auditRec, post.Message)
	if c.Err != nil {
		return
	}

	originalPost, err := c.App.GetSinglePost(c.AppContext, postIdStr, false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	if post.FileIds != nil {
		checkUploadFilePermissionForNewFiles(c, *post.FileIds, originalPost)
		if c.Err != nil {
			return
		}
	}

	patchedPost, isMemberForPReviews, err := c.App.PatchPost(c.AppContext, postIdStr, c.App.PostPatchWithProxyRemovedFromImageURLs(&post), nil)
	if err != nil {
		c.Err = err
		return
	}

	if !isMember || !isMemberForPReviews {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	auditRec.Success()
	auditRec.AddEventResultState(patchedPost)

	if err := patchedPost.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func postPatchChecks(c *Context, auditRec *model.AuditRecord, message *string) bool {
	originalPost, err := c.App.GetSinglePost(c.AppContext, c.Params["post_id"].(string), false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return false
	}
	auditRec.AddEventPriorState(originalPost)
	auditRec.AddEventObjectType("post")

	var permission *model.Permission

	if c.AppContext.Session().UserId == originalPost.UserId {
		permission = model.PermissionEditPost
	} else {
		permission = model.PermissionEditOthersPosts
	}

	ok, isMember := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, permission)
	if !ok {
		c.SetPermissionError(permission)
		return false
	}

	if *c.App.Config().ServiceSettings.PostEditTimeLimit != -1 && model.GetMillis() > originalPost.CreateAt+int64(*c.App.Config().ServiceSettings.PostEditTimeLimit*1000) && message != nil {
		c.Err = model.NewAppError("patchPost", "api.post.update_post.permissions_time_limit.app_error", map[string]any{"timeLimit": *c.App.Config().ServiceSettings.PostEditTimeLimit}, "", http.StatusBadRequest)
		return isMember
	}

	return isMember
}

func setPostUnread(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	props := model.MapBoolFromJSON(r.Body)
	collapsedThreadsSupported := props["collapsed_threads_supported"]

	if c.AppContext.Session().UserId != userIdStr && !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}
	if ok, _ := c.App.SessionHasPermissionToReadPost(c.AppContext, *c.AppContext.Session(), postIdStr); !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	state, err := c.App.MarkChannelAsUnreadFromPost(c.AppContext, postIdStr, userIdStr, collapsedThreadsSupported)
	if err != nil {
		c.Err = err
		return
	}
	if err := json.NewEncoder(w).Encode(state); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func setPostReminder(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if c.AppContext.Session().UserId != userIdStr && !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}
	if ok, _ := c.App.SessionHasPermissionToReadPost(c.AppContext, *c.AppContext.Session(), postIdStr); !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	var reminder model.PostReminder
	if jsonErr := json.NewDecoder(r.Body).Decode(&reminder); jsonErr != nil {
		c.SetInvalidParamWithErr("target_time", jsonErr)
		return
	}

	appErr := c.App.SetPostReminder(c.AppContext, postIdStr, userIdStr, reminder.TargetTime)
	if appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func saveIsPinnedPost(c *Context, w http.ResponseWriter, isPinned bool) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventSaveIsPinnedPost, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "post_id", postIdStr)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	post, err := c.App.GetSinglePost(c.AppContext, postIdStr, false)
	if err != nil {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}
	auditRec.AddEventPriorState(post)
	auditRec.AddEventObjectType("post")

	channel, err := c.App.GetChannel(c.AppContext, post.ChannelId)
	if err != nil {
		c.Err = err
		return
	}
	ok, isMember := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel)
	if !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	patch := &model.PostPatch{}
	patch.IsPinned = model.NewPointer(isPinned)

	patchedPost, isMemberForPreviews, err := c.App.PatchPost(c.AppContext, postIdStr, patch, nil)
	if err != nil {
		c.Err = err
		return
	}

	if !isMember || !isMemberForPreviews {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
		if !isMemberForPreviews {
			previewPost := patchedPost.GetPreviewPost()
			if previewPost != nil {
				model.AddEventParameterToAuditRec(auditRec, "preview_post_id", previewPost.Post.Id)
			}
		}
	}

	auditRec.AddEventResultState(patchedPost)

	auditRec.Success()
	ReturnStatusOK(w)
}

func pinPost(c *Context, w http.ResponseWriter, _ *http.Request) {
	saveIsPinnedPost(c, w, true)
}

func unpinPost(c *Context, w http.ResponseWriter, _ *http.Request) {
	saveIsPinnedPost(c, w, false)
}

func acknowledgePost(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if ok, _ := c.App.SessionHasPermissionToReadPost(c.AppContext, *c.AppContext.Session(), postIdStr); !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	acknowledgement, appErr := c.App.SaveAcknowledgementForPost(c.AppContext, postIdStr, userIdStr)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(acknowledgement)
	if err != nil {
		c.Err = model.NewAppError("acknowledgePost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func unacknowledgePost(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userIdStr) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if ok, _ := c.App.SessionHasPermissionToReadPost(c.AppContext, *c.AppContext.Session(), postIdStr); !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	_, err := c.App.GetSinglePost(c.AppContext, postIdStr, false)
	if err != nil {
		c.Err = err
		return
	}

	appErr := c.App.DeleteAcknowledgementForPost(c.AppContext, postIdStr, userIdStr)
	if appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func moveThread(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	var moveThreadParams model.MoveThreadParams
	if jsonErr := json.NewDecoder(r.Body).Decode(&moveThreadParams); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventMoveThread, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "original_post_id", postIdStr)
	model.AddEventParameterToAuditRec(auditRec, "to_channel_id", moveThreadParams.ChannelId)

	user, err := c.App.GetUser(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	posts, _, err := c.App.GetPostsByIds([]string{postIdStr})
	if err != nil {
		c.Err = err
		return
	}

	channelMember, err := c.App.GetChannelMember(c.AppContext, posts[0].ChannelId, user.Id)
	if err != nil {
		c.Err = err
		return
	}

	userHasRole := hasPermittedWranglerRole(c, user, channelMember)

	// Sysadmins are always permitted
	if !userHasRole && !user.IsSystemAdmin() {
		c.Err = model.NewAppError("moveThread", "api.post.move_thread.no_permission", nil, "", http.StatusForbidden)
		return
	}

	userHasEmailDomain := true
	// Only check the user's email domain if a list of allowed domains is configured
	if len(c.App.Config().WranglerSettings.AllowedEmailDomain) > 0 {
		userHasEmailDomain = slices.Contains(c.App.Config().WranglerSettings.AllowedEmailDomain, user.EmailDomain())
	}

	if !userHasEmailDomain && !user.IsSystemAdmin() {
		c.Err = model.NewAppError("moveThread", "api.post.move_thread.no_permission", nil, fmt.Sprintf("User: %+v", user), http.StatusForbidden)
		return
	}

	sourcePost, err, _ := c.App.GetPostIfAuthorized(c.AppContext, postIdStr, c.AppContext.Session(), false)
	if err != nil {
		c.Err = err
		if err.Id == "app.post.cloud.get.app_error" {
			w.Header().Set(model.HeaderFirstInaccessiblePostTime, "1")
		}

		return
	}

	err = c.App.MoveThread(c.AppContext, postIdStr, sourcePost.ChannelId, moveThreadParams.ChannelId, user)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}

func getFileInfosForPost(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	ok, isMember := c.App.SessionHasPermissionToReadPost(c.AppContext, *c.AppContext.Session(), postIdStr)
	if !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))
	if includeDeleted && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	infos, appErr := c.App.GetFileInfosForPostWithMigration(c.AppContext, postIdStr, includeDeleted)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if c.HandleEtag(model.GetEtagForFileInfos(infos), "Get File Infos For Post", w, r) {
		return
	}

	js, err := json.Marshal(infos)
	if err != nil {
		c.Err = model.NewAppError("getFileInfosForPost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetFileInfosForPost, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "post_id", postIdStr)

	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	w.Header().Set("Cache-Control", "max-age=2592000, private")
	w.Header().Set(model.HeaderEtagServer, model.GetEtagForFileInfos(infos))
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPostInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	userID := c.AppContext.Session().UserId
	post, appErr := c.App.GetSinglePost(c.AppContext, postIdStr, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, post.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	notFoundError := model.NewAppError("GetPostInfo", "app.post.get.app_error", nil, "", http.StatusNotFound)

	var team *model.Team
	hasPermissionToAccessTeam := false
	if channel.TeamId != "" {
		team, appErr = c.App.GetTeam(channel.TeamId)
		if appErr != nil {
			c.Err = appErr
			return
		}

		var teamMember *model.TeamMember
		teamMember, appErr = c.App.GetTeamMember(c.AppContext, channel.TeamId, userID)
		if appErr != nil && appErr.StatusCode != http.StatusNotFound {
			c.Err = appErr
			return
		}

		if appErr == nil {
			if teamMember.DeleteAt == 0 {
				hasPermissionToAccessTeam = true
			}
		}

		if !hasPermissionToAccessTeam {
			if team.AllowOpenInvite {
				hasPermissionToAccessTeam = c.App.HasPermissionToTeam(c.AppContext, userID, team.Id, model.PermissionJoinPublicTeams)
			} else {
				hasPermissionToAccessTeam = c.App.HasPermissionToTeam(c.AppContext, userID, team.Id, model.PermissionJoinPrivateTeams)
			}
		}
	} else {
		// This happens in case of DMs and GMs.
		hasPermissionToAccessTeam = true
	}

	if !hasPermissionToAccessTeam {
		c.Err = notFoundError
		return
	}

	hasPermissionToAccessChannel := false
	hasJoinedChannel := false

	_, channelMemberErr := c.App.GetChannelMember(c.AppContext, channel.Id, userID)

	if channelMemberErr == nil {
		hasPermissionToAccessChannel = true
		hasJoinedChannel = true
	}

	if !hasPermissionToAccessChannel {
		if channel.Type == model.ChannelTypeOpen {
			hasPermissionToAccessChannel = true
		} else if channel.Type == model.ChannelTypePrivate {
			hasPermissionToAccessChannel, _ = c.App.HasPermissionToChannel(c.AppContext, userID, channel.Id, model.PermissionManagePrivateChannelMembers)
		} else if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
			hasPermissionToAccessChannel, _ = c.App.HasPermissionToReadChannel(c.AppContext, userID, channel)
		}
	}

	if !hasPermissionToAccessChannel {
		c.Err = notFoundError
		return
	}

	info, appErr := c.App.GetPostInfo(c.AppContext, postIdStr, channel, team, userID, hasJoinedChannel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(info)
	if err != nil {
		c.Err = model.NewAppError("getPostInfo", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func restorePostVersion(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	restoreVersionId := c.RequireParam("restore_version_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventRestorePostVersion, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "id", postIdStr)
	model.AddEventParameterToAuditRec(auditRec, "restore_version_id", restoreVersionId)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	toRestorePost, err := c.App.GetSinglePost(c.AppContext, restoreVersionId, true)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	// user can only restore their own posts
	if c.AppContext.Session().UserId != toRestorePost.UserId {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	isMember := postPatchChecks(c, auditRec, &toRestorePost.Message)
	if c.Err != nil {
		return
	}

	updatedPost, isMemberForPreview, appErr := c.App.RestorePostVersion(c.AppContext, c.AppContext.Session().UserId, postIdStr, restoreVersionId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !isMember || !isMemberForPreview {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
		if !isMemberForPreview {
			previewPost := updatedPost.GetPreviewPost()
			if previewPost != nil {
				model.AddEventParameterToAuditRec(auditRec, "preview_post_id", previewPost.Post.Id)
			}
		}
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedPost)

	if err := updatedPost.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func hasPermittedWranglerRole(c *Context, user *model.User, channelMember *model.ChannelMember) bool {
	// If there are no configured PermittedWranglerRoles, skip the check
	if len(c.App.Config().WranglerSettings.PermittedWranglerRoles) == 0 {
		return true
	}

	userRoles := user.Roles + " " + channelMember.Roles
	for _, role := range c.App.Config().WranglerSettings.PermittedWranglerRoles {
		if model.IsInRole(userRoles, role) {
			return true
		}
	}

	return false
}

func revealPost(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	if !c.App.Config().FeatureFlags.BurnOnRead {
		c.Err = model.NewAppError("revealPost", "api.post.reveal_post.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	userId := c.AppContext.Session().UserId

	auditRec := c.MakeAuditRecord(model.AuditEventRevealPost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "post_id", postIdStr)
	model.AddEventParameterToAuditRec(auditRec, "user_id", userId)

	post, err, isMember := c.App.GetPostIfAuthorized(c.AppContext, postIdStr, c.AppContext.Session(), false)
	if err != nil {
		c.Err = err
		if err.Id == "app.post.cloud.get.app_error" {
			w.Header().Set(model.HeaderFirstInaccessiblePostTime, "1")
		}
		return
	}

	_, err = c.App.GetChannelMember(c.AppContext, post.ChannelId, userId)
	if err != nil {
		if err.Id == "app.channel.get_member.missing.app_error" {
			c.Err = model.NewAppError("revealPost", "api.post.reveal_post.user_not_in_channel.app_error", nil, fmt.Sprintf("postId=%s", postIdStr), http.StatusForbidden)
		} else {
			c.Err = err
		}
		return
	}

	if post.UserId == userId {
		c.Err = model.NewAppError("revealPost", "api.post.reveal_post.cannot_reveal_own_post.app_error", nil, fmt.Sprintf("postId=%s", postIdStr), http.StatusBadRequest)
		return
	}

	// should reveal the post
	// if it's already revealed, it should be a no-op if the post is not expired yet
	// if it's expired, it should return an error
	revealedPost, err := c.App.RevealPost(c.AppContext, post, userId, connectionID)
	if err != nil {
		c.Err = err
		return
	}

	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	auditRec.Success()
	auditRec.AddEventResultState(revealedPost)

	if jsErr := revealedPost.EncodeJSON(w); jsErr != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(jsErr))
	}
}

func burnPost(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	userId := c.AppContext.Session().UserId

	auditRec := c.MakeAuditRecord(model.AuditEventBurnPost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "post_id", postIdStr)
	model.AddEventParameterToAuditRec(auditRec, "user_id", userId)

	post, err, _ := c.App.GetPostIfAuthorized(c.AppContext, postIdStr, c.AppContext.Session(), false)
	if err != nil {
		c.Err = err
		if err.Id == "app.post.cloud.get.app_error" {
			w.Header().Set(model.HeaderFirstInaccessiblePostTime, "1")
		}
		return
	}

	_, err = c.App.GetChannelMember(c.AppContext, post.ChannelId, userId)
	if err != nil {
		if err.Id == "app.channel.get_member.missing.app_error" {
			c.Err = model.NewAppError("burnPost", "api.post.burn_post.user_not_in_channel.app_error", nil, fmt.Sprintf("postId=%s", postIdStr), http.StatusForbidden)
		} else {
			c.Err = err
		}
		return
	}

	err = c.App.BurnPost(c.AppContext, post, userId, connectionID)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
