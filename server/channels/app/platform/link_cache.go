package platform

import (
	"time"

	"github.com/iamleson98/sitename/server/v8/platform/services/cache"
)

const LinkCacheSize = 10000
const LinkCacheDuration = 1 * time.Hour

var linkCache = cache.NewLRU(&cache.CacheOptions{
	Size: LinkCacheSize,
})

func PurgeLinkCache() error {
	return linkCache.Purge()
}

func LinkCache() cache.Cache {
	return linkCache
}
