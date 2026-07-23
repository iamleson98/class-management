package last_accessible_post

import (
	"strconv"
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

const schedFreq = 30 * time.Minute

func MakeScheduler(jobServer *jobs.JobServer) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		// Enable for any license with post history limits (i.e. Entry SKU)
		mlog.Debug("Scheduler: isEnabled: "+strconv.FormatBool(true), mlog.String("scheduler", model.JobTypeLastAccessiblePost))
		return true
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeLastAccessiblePost, schedFreq, isEnabled)
}
