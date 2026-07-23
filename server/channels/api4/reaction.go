package api4

import (
	"encoding/json"
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitReaction() {
	api.BaseRoutes.Reactions.Method(http.MethodPost, "/", api.APISessionRequired(saveReaction))
	api.BaseRoutes.Post.Method(http.MethodGet, "/reactions", api.APISessionRequired(getReactions))
	api.BaseRoutes.ReactionByNameForPostForUser.Method(http.MethodDelete, "/", api.APISessionRequired(deleteReaction))
	api.BaseRoutes.Posts.Method(http.MethodPost, "/ids/reactions", api.APISessionRequired(getBulkReactions))
}

func saveReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	var reaction model.Reaction
	if jsonErr := json.NewDecoder(r.Body).Decode(&reaction); jsonErr != nil {
		c.SetInvalidParamWithErr("reaction", jsonErr)
		return
	}

	if !model.IsValidId(reaction.UserId) || !model.IsValidId(reaction.PostId) || reaction.EmojiName == "" || len(reaction.EmojiName) > model.EmojiNameMaxLength {
		c.Err = model.NewAppError("saveReaction", "api.reaction.save_reaction.invalid.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if reaction.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("saveReaction", "api.reaction.save_reaction.user_id.app_error", nil, "", http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), reaction.PostId, model.PermissionAddReaction) {
		c.SetPermissionError(model.PermissionAddReaction)
		return
	}

	re, err := c.App.SaveReactionForPost(c.AppContext, &reaction)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(re); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	postId := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	postIdStr := postId.(string)

	if ok, _ := c.App.SessionHasPermissionToReadPost(c.AppContext, *c.AppContext.Session(), postIdStr); !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	reactions, appErr := c.App.GetReactionsForPost(postIdStr)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(reactions)
	if err != nil {
		c.Err = model.NewAppError("getReactions", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing js response", mlog.Err(err))
	}
}

func deleteReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userIdStr := c.Params["user_id"].(string)
	postId := c.RequireParam("post_id", web.RequireValidId)
	emojiName := c.RequireParam("emoji_name", web.RequireEmojiName)
	if c.Err != nil {
		return
	}
	postIdStr := postId.(string)
	emojiNameStr := emojiName.(string)

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), postIdStr, model.PermissionRemoveReaction) {
		c.SetPermissionError(model.PermissionRemoveReaction)
		return
	}

	if userIdStr != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionRemoveOthersReactions) {
		c.SetPermissionError(model.PermissionRemoveOthersReactions)
		return
	}

	reaction := &model.Reaction{
		UserId:    userIdStr,
		PostId:    postIdStr,
		EmojiName: emojiNameStr,
	}

	err := c.App.DeleteReactionForPost(c.AppContext, reaction)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getBulkReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	postIds, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getBulkReactions", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	for _, postId := range postIds {
		if ok, _ := c.App.SessionHasPermissionToReadPost(c.AppContext, *c.AppContext.Session(), postId); !ok {
			c.SetPermissionError(model.PermissionReadChannelContent)
			return
		}
	}
	reactions, appErr := c.App.GetBulkReactionsForPosts(postIds)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(reactions)
	if err != nil {
		c.Err = model.NewAppError("getBulkReactions", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing js response", mlog.Err(err))
	}
}
