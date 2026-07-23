package lmsapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/public/utils"
	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/web"
)

// InitPosts registers post category and post routes on the LMS router.
func (a *LMSAPI) InitPosts() {
	a.routes.Method(http.MethodGet, "/posts/categories", a.api.APISessionRequired(getPostCategories))
	a.routes.Method(http.MethodPost, "/posts/categories", a.api.APISessionRequired(createPostCategory))
	a.routes.Method(http.MethodGet, "/posts", a.api.APISessionRequired(getPosts))
	a.routes.Method(http.MethodPost, "/posts", a.api.APISessionRequired(createPost))
	a.routes.Method(http.MethodGet, "/posts/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(getPost))
	a.routes.Method(http.MethodPut, "/posts/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(updatePost))
	a.routes.Method(http.MethodDelete, "/posts/{id:[A-Za-z0-9]+}", a.api.APISessionRequired(deletePost))
}

func getPostCategories(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManagePosts) {
		c.SetPermissionError(model.PermissionLmsManagePosts)
		return
	}

	categories, err := c.App.LMS().GetPostCategories()
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(utils.ResponseList{Items: categories})
	w.Write(data)
}

func createPostCategory(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManagePosts) {
		c.SetPermissionError(model.PermissionLmsManagePosts)
		return
	}

	var category *lms_models.PostCategory
	if err := json.NewDecoder(r.Body).Decode(&category); err != nil {
		c.Err = model.NewAppError("createPostCategory", "api.lms.post.category_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreatePostCategory(category)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(created)
	w.Write(data)
}

func getPosts(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManagePosts) {
		c.SetPermissionError(model.PermissionLmsManagePosts)
		return
	}

	q := r.URL.Query()
	opts := modelhelper.BlogPostFilterOpts{
		Status:     q.Get("status"),
		CategoryID: q.Get("category_id"),
	}
	if v := q.Get("page"); v != "" {
		opts.Page, _ = strconv.Atoi(v)
	}
	if v := q.Get("per_page"); v != "" {
		opts.PerPage, _ = strconv.Atoi(v)
	}
	if q.Get("count_total") == "true" {
		opts.CountTotal = true
	}

	posts, err := c.App.LMS().GetPosts(opts)
	if err != nil {
		c.Err = err
		return
	}

	if posts == nil {
		posts = []*lms_models.BlogPost{}
	}

	res := utils.ResponseList{Items: posts}
	data, _ := json.Marshal(res)
	w.Write(data)
}

func createPost(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManagePosts) {
		c.SetPermissionError(model.PermissionLmsManagePosts)
		return
	}

	var post *lms_models.BlogPost
	if err := json.NewDecoder(r.Body).Decode(&post); err != nil {
		c.Err = model.NewAppError("createPost", "api.lms.post.create_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := c.App.LMS().CreatePost(post)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	data, _ := json.Marshal(created)
	w.Write(data)
}

func getPost(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManagePosts) {
		c.SetPermissionError(model.PermissionLmsManagePosts)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	post, err := c.App.LMS().GetPost(id)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(post)
	w.Write(data)
}

func updatePost(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManagePosts) {
		c.SetPermissionError(model.PermissionLmsManagePosts)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	var post *lms_models.BlogPost
	if err := json.NewDecoder(r.Body).Decode(&post); err != nil {
		c.Err = model.NewAppError("updatePost", "api.lms.post.update_body.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	updated, err := c.App.LMS().UpdatePost(id, post)
	if err != nil {
		c.Err = err
		return
	}

	data, _ := json.Marshal(updated)
	w.Write(data)
}

func deletePost(c *api4.Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionLmsManagePosts) {
		c.SetPermissionError(model.PermissionLmsManagePosts)
		return
	}

	idVal := c.RequireParam("id", web.RequireValidId)
	if c.Err != nil {
		return
	}
	id := idVal.(string)

	if err := c.App.LMS().DeletePost(id); err != nil {
		c.Err = err
		return
	}

	api4.ReturnStatusOK(w)
}
