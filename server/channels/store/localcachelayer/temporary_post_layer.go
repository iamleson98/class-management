package localcachelayer

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/public/shared/request"

	"github.com/iamleson98/sitename/server/v8/channels/store"
)

type LocalCacheTemporaryPostStore struct {
	store.TemporaryPostStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheTemporaryPostStore) handleClusterInvalidateTemporaryPosts(msg *model.ClusterMessage) {
	if err := s.rootStore.temporaryPostCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge temporary post cache", mlog.Err(err))
	}
}

func (s LocalCacheTemporaryPostStore) ClearCaches() {
	if err := s.rootStore.temporaryPostCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge temporary post cache", mlog.Err(err))
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.temporaryPostCache.Name())
	}
}

func (s LocalCacheTemporaryPostStore) InvalidateTemporaryPost(id string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.temporaryPostCache, id, nil)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.temporaryPostCache.Name())
	}
}

func (s LocalCacheTemporaryPostStore) Get(rctx request.CTX, id string) (*model.TemporaryPost, error) {
	var post *model.TemporaryPost
	if err := s.rootStore.doStandardReadCache(s.rootStore.temporaryPostCache, id, &post); err == nil {
		return post, nil
	}

	post, err := s.TemporaryPostStore.Get(rctx, id)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.temporaryPostCache, id, post)
	return post, nil
}

func (s LocalCacheTemporaryPostStore) Delete(rctx request.CTX, id string) error {
	defer s.InvalidateTemporaryPost(id)
	return s.TemporaryPostStore.Delete(rctx, id)
}
