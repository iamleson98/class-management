package last_accessible_file

import (
	"strconv"
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

const schedFreq = 2 * time.Hour

func MakeScheduler(jobServer *jobs.JobServer) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		mlog.Debug("Scheduler: isEnabled: "+strconv.FormatBool(true), mlog.String("scheduler", model.JobTypeLastAccessibleFile))
		return true
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeLastAccessibleFile, schedFreq, isEnabled)
}
