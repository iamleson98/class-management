package expirynotify

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

func MakeWorker(jobServer *jobs.JobServer, notifySessionsExpired func() error) *jobs.SimpleWorker {
	const workerName = "ExpiryNotify"

	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ServiceSettings.ExtendSessionLengthWithActivity
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		return notifySessionsExpired()
	}
	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}
