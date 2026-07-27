package api4

import (
	"net/http"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/app"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

func (api *API) InitPostLocal() {
	api.BaseRoutes.Post.Method(http.MethodGet, "/", api.APILocal(getPost))
	api.BaseRoutes.PostsForChannel.Method(http.MethodGet, "/", api.APILocal(getPostsForChannel))
	api.BaseRoutes.Post.Method(http.MethodDelete, "/", api.APILocal(localDeletePost))
}

func localDeletePost(c *Context, w http.ResponseWriter, r *http.Request) {
	postIdStr := c.RequireParam("post_id", web.RequireValidId)
	if c.Err != nil {
		return
	}

	permanent := c.Params["permanent"].(bool)

	auditRec := c.MakeAuditRecord(model.AuditEventLocalDeletePost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "post_id", postIdStr)
	model.AddEventParameterToAuditRec(auditRec, "permanent", permanent)

	includeDeleted := permanent

	post, appErr := c.App.GetSinglePost(c.AppContext, postIdStr, includeDeleted)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddEventPriorState(post)
	auditRec.AddEventObjectType("post")

	if permanent {
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
