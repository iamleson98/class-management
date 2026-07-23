package post_persistent_notifications

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

type AppIface interface {
	SendPersistentNotifications() error
	IsPersistentNotificationsEnabled() bool
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	const workerName = "PostPersistentNotifications"

	isEnabled := func(_ *model.Config) bool {
		return app.IsPersistentNotificationsEnabled()
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)
		return app.SendPersistentNotifications()
	}
	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
