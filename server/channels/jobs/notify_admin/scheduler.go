package notify_admin

import (
	"strconv"
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

const schedFreq = 24 * time.Hour

func MakeScheduler(jobServer *jobs.JobServer, jobType string) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		mlog.Debug("Scheduler: isEnabled: "+strconv.FormatBool(true), mlog.String("scheduler", jobType))
		return true
	}
	return jobs.NewPeriodicScheduler(jobServer, jobType, schedFreq, isEnabled)
}
