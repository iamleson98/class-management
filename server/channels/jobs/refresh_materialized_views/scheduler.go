package refresh_materialized_views

import (
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

func MakeScheduler(jobServer *jobs.JobServer, sqlDriverName string) *jobs.DailyScheduler {
	startTime := func(cfg *model.Config) *time.Time {
		parsedTime, err := time.Parse("15:04", *cfg.ServiceSettings.RefreshPostStatsRunTime)
		if err == nil {
			return &parsedTime
		}
		return nil
	}
	isEnabled := func(cfg *model.Config) bool {
		return sqlDriverName == model.DatabaseDriverPostgres
	}
	return jobs.NewDailyScheduler(jobServer, model.JobTypeRefreshMaterializedViews, startTime, isEnabled)
}
