package post_persistent_notifications

import (
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

type Scheduler struct {
	*jobs.PeriodicScheduler
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, _ time.Time, _ bool, _ *model.Job) *time.Time {
	nextTime := time.Now().Add((time.Duration(*cfg.ServiceSettings.PersistentNotificationIntervalMinutes) * time.Minute) / 2)
	return &nextTime
}

func MakeScheduler(jobServer *jobs.JobServer) *Scheduler {
	enabledFunc := func(_ *model.Config) bool {
		return true
	}
	return &Scheduler{jobs.NewPeriodicScheduler(jobServer, model.JobTypePostPersistentNotifications, 0, enabledFunc)}
}
