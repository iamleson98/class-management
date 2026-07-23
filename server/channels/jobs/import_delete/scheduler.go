package import_delete

import (
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

const schedFreq = 24 * time.Hour

func MakeScheduler(jobServer *jobs.JobServer) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ImportSettings.Directory != "" && *cfg.ImportSettings.RetentionDays > 0
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeImportDelete, schedFreq, isEnabled)
}
