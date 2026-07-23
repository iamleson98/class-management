package lmsstore

import (
	"database/sql"

	"github.com/aarondl/sqlboiler/v4/boil"
	"github.com/aarondl/sqlboiler/v4/queries/qm"
	lms_models "github.com/iamleson98/sitename/server/public/lms_models"
	modelhelper "github.com/iamleson98/sitename/server/public/model_helper"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlBlogPostStore struct {
	sqlStore store.Store
}

func NewSqlBlogPostStore(s store.Store) store.BlogPostStore {
	return &SqlBlogPostStore{sqlStore: s}
}

func (s *SqlBlogPostStore) Get(id string) (*lms_models.BlogPost, error) {
	post, err := lms_models.FindBlogPost(s.sqlStore.GetReplicaExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("BlogPost", id)
		}
		return nil, errors.Wrap(err, "failed to get blog post")
	}

	return post, nil
}

func (s *SqlBlogPostStore) GetAll(opts modelhelper.BlogPostFilterOpts) ([]*lms_models.BlogPost, error) {
	mods := []qm.QueryMod{}

	if opts.Status != "" {
		mods = append(mods, lms_models.BlogPostWhere.Status.EQ(opts.Status))
	}
	if opts.CategoryID != "" {
		mods = append(mods, lms_models.BlogPostWhere.CategoryID.EQ(opts.CategoryID))
	}

	if opts.PerPage > 0 {
		mods = append(mods, qm.Limit(opts.PerPage))
		if opts.Page > 0 {
			mods = append(mods, qm.Offset((opts.Page-1)*opts.PerPage))
		}
	}

	mods = append(mods, qm.OrderBy(lms_models.BlogPostColumns.Createat+" DESC"))

	posts, err := lms_models.BlogPosts(mods...).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get blog posts")
	}

	return posts, nil
}

func (s *SqlBlogPostStore) GetPublished() ([]*lms_models.BlogPost, error) {
	posts, err := lms_models.BlogPosts(
		lms_models.BlogPostWhere.Status.EQ("PUBLISHED"),
		qm.OrderBy(lms_models.BlogPostColumns.PublishedAt+" DESC"),
	).All(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return nil, errors.Wrap(err, "failed to get published blog posts")
	}

	return posts, nil
}

func (s *SqlBlogPostStore) Save(post *lms_models.BlogPost) (*lms_models.BlogPost, error) {
	modelhelper.BlogPostPreCreate(post)
	if err := modelhelper.BlogPostIsValid(post); err != nil {
		return nil, err
	}

	if err := post.Insert(s.sqlStore.GetMasterExecuter(), boil.Infer()); err != nil {
		return nil, errors.Wrap(err, "failed to save blog post")
	}

	return post, nil
}

func (s *SqlBlogPostStore) Update(post *lms_models.BlogPost) (*lms_models.BlogPost, error) {
	modelhelper.BlogPostPreUpdate(post)
	if err := modelhelper.BlogPostIsValid(post); err != nil {
		return nil, err
	}

	rowsAffected, err := post.Update(s.sqlStore.GetMasterExecuter(), boil.Infer())
	if err != nil {
		return nil, errors.Wrap(err, "failed to update blog post")
	}

	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("BlogPost", post.ID)
	}

	if err := post.Reload(s.sqlStore.GetMasterExecuter()); err != nil {
		return nil, errors.Wrap(err, "failed to reload blog post after update")
	}

	return post, nil
}

func (s *SqlBlogPostStore) Delete(id string) error {
	post, err := lms_models.FindBlogPost(s.sqlStore.GetMasterExecuter(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("BlogPost", id)
		}
		return errors.Wrap(err, "failed to find blog post for deletion")
	}

	rows, err := post.Delete(s.sqlStore.GetMasterExecuter())
	if err != nil {
		return errors.Wrap(err, "failed to delete blog post")
	}

	if rows == 0 {
		return store.NewErrNotFound("BlogPost", id)
	}

	return nil
}

func (s *SqlBlogPostStore) Count(opts modelhelper.BlogPostFilterOpts) (int64, error) {
	var mods []qm.QueryMod

	if opts.Status != "" {
		mods = append(mods, lms_models.BlogPostWhere.Status.EQ(opts.Status))
	}
	if opts.CategoryID != "" {
		mods = append(mods, lms_models.BlogPostWhere.CategoryID.EQ(opts.CategoryID))
	}

	count, err := lms_models.BlogPosts(mods...).Count(s.sqlStore.GetReplicaExecuter())
	if err != nil {
		return 0, errors.Wrap(err, "failed to count blog posts")
	}
	return count, nil
}
