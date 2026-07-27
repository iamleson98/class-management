package lms

import (
	"errors"
	"net/http"
	"time"

	"github.com/aarondl/null/v8"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

func (a *LMSApp) GetPostCategories() ([]*lms_models.PostCategory, *model.AppError) {
	categories, err := a.store.PostCategory().GetAll()
	if err != nil {
		return nil, model.NewAppError("GetPostCategories", "app.lms.post_category.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return categories, nil
}

func (a *LMSApp) CreatePostCategory(pc *lms_models.PostCategory) (*lms_models.PostCategory, *model.AppError) {
	saved, err := a.store.PostCategory().Save(pc)
	if err != nil {
		return nil, model.NewAppError("CreatePostCategory", "app.lms.post_category.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) UpdatePostCategory(id string, pc *lms_models.PostCategory) (*lms_models.PostCategory, *model.AppError) {
	pc.ID = id
	updated, err := a.store.PostCategory().Update(pc)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdatePostCategory", "app.lms.post_category.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdatePostCategory", "app.lms.post_category.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return updated, nil
}

func (a *LMSApp) DeletePostCategory(id string) *model.AppError {
	err := a.store.PostCategory().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeletePostCategory", "app.lms.post_category.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeletePostCategory", "app.lms.post_category.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return nil
}

func (a *LMSApp) GetPost(id string) (*lms_models.BlogPost, *model.AppError) {
	post, err := a.store.BlogPost().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetPost", "app.lms.blog_post.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetPost", "app.lms.blog_post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return post, nil
}

func (a *LMSApp) GetPosts(opts modelhelper.BlogPostFilterOpts) ([]*lms_models.BlogPost, int64, *model.AppError) {
	posts, totalCount, err := a.store.BlogPost().Search(opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetPosts", "app.lms.blog_post.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return posts, totalCount, nil
}

func (a *LMSApp) CreatePost(post *lms_models.BlogPost) (*lms_models.BlogPost, *model.AppError) {
	// If status is PUBLISHED, set PublishedAt to current time.
	if post.Status == "PUBLISHED" {
		post.PublishedAt = null.Int64From(time.Now().UnixMilli())
	}

	saved, err := a.store.BlogPost().Save(post)
	if err != nil {
		return nil, model.NewAppError("CreatePost", "app.lms.blog_post.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return saved, nil
}

func (a *LMSApp) UpdatePost(id string, post *lms_models.BlogPost) (*lms_models.BlogPost, *model.AppError) {
	post.ID = id

	// If status is PUBLISHED and PublishedAt is not set, set it to current time.
	if post.Status == "PUBLISHED" && !post.PublishedAt.Valid {
		post.PublishedAt = null.Int64From(time.Now().UnixMilli())
	}

	updated, err := a.store.BlogPost().Update(post)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdatePost", "app.lms.blog_post.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdatePost", "app.lms.blog_post.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return updated, nil
}

func (a *LMSApp) DeletePost(id string) *model.AppError {
	err := a.store.BlogPost().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeletePost", "app.lms.blog_post.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeletePost", "app.lms.blog_post.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return nil
}
