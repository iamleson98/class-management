package indexer

import (
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

const bleveInitialScheduleDelay = 5 * time.Second

type BleveIndexerScheduler struct {
	jobServer *jobs.JobServer
}

func MakeScheduler(jobServer *jobs.JobServer) *BleveIndexerScheduler {
	return &BleveIndexerScheduler{jobServer: jobServer}
}

func (scheduler *BleveIndexerScheduler) Enabled(cfg *model.Config) bool {
	if cfg == nil || cfg.BleveSettings.EnableIndexing == nil || cfg.BleveSettings.IndexDir == nil {
		return false
	}

	return *cfg.BleveSettings.EnableIndexing && *cfg.BleveSettings.IndexDir != ""
}

func (scheduler *BleveIndexerScheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	if !scheduler.Enabled(cfg) || pendingJobs || lastSuccessfulJob != nil {
		return nil
	}

	nextTime := now.Add(bleveInitialScheduleDelay)
	return &nextTime
}

func (scheduler *BleveIndexerScheduler) ScheduleJob(rctx request.CTX, cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	if !scheduler.Enabled(cfg) || pendingJobs || lastSuccessfulJob != nil {
		return nil, nil
	}

	return scheduler.jobServer.CreateJob(rctx, model.JobTypeBlevePostIndexing, map[string]string{})
}
