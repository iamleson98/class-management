package product_notices

import (
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

type Scheduler struct {
	*jobs.PeriodicScheduler
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, _ time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := time.Now().Add(time.Duration(*cfg.AnnouncementSettings.NoticesFetchFrequency) * time.Second)
	return &nextTime
}

func MakeScheduler(jobServer *jobs.JobServer) *Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.AnnouncementSettings.AdminNoticesEnabled || *cfg.AnnouncementSettings.UserNoticesEnabled
	}
	return &Scheduler{PeriodicScheduler: jobs.NewPeriodicScheduler(jobServer, model.JobTypeProductNotices, 0, isEnabled)}
}
