package notify_admin

import (
	"strconv"
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

const installPluginSchedFreq = 24 * time.Hour

func MakeInstallPluginScheduler(jobServer *jobs.JobServer, jobType string) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		enabled := jobType == model.JobTypeInstallPluginNotifyAdmin
		mlog.Debug("Scheduler: isEnabled: "+strconv.FormatBool(enabled), mlog.String("scheduler", jobType))
		return enabled
	}
	return jobs.NewPeriodicScheduler(jobServer, jobType, installPluginSchedFreq, isEnabled)
}
