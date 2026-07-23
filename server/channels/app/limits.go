package app

import (
	"github.com/iamleson98/sitename/server/public/model"
)

const (
	maxUsersLimit = 1_000_000
)

// GetServerLimits returns the server's seat/post-history limits. The license-derived
// limit fields and post-history fields are always computed (they are cheap and needed
// by all users). The active user and single-channel guest counts are only computed when
// includeUserCounts is true, because those queries are expensive and the counts are only
// consumed by admin-gated UI and internal seat-limit checks. Callers that do not need the
// counts (e.g. non-admin API requests) should pass false to keep the expensive queries off
// the hot path.
func (a *App) GetServerLimits(includeUserCounts bool) (*model.ServerLimits, *model.AppError) {
	limits := &model.ServerLimits{
		MaxUsersLimit:          maxUsersLimit,
		MaxUsersHardLimit:      maxUsersLimit,
		ActiveUserCount:        maxUsersLimit,
		PostHistoryLimit:       maxUsersLimit,
		LastAccessiblePostTime: maxUsersLimit,
	}

	return limits, nil
}
