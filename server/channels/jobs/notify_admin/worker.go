package notify_admin

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

const (
	UpgradeNotifyJobName = "UpgradeNotifyAdmin"
	TrialNotifyJobName   = "TrialNotifyAdmin"
	InstallNotifyJobName = "InstallNotifyAdmin"
)

type AppIface interface {
	DoCheckForAdminNotifications(trial bool) *model.AppError
}

func MakeUpgradeNotifyWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	isEnabled := func(_ *model.Config) bool {
		return true
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		appErr := app.DoCheckForAdminNotifications(false)
		if appErr != nil {
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(UpgradeNotifyJobName, jobServer, execute, isEnabled)
	return worker
}

func MakeTrialNotifyWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	isEnabled := func(_ *model.Config) bool {
		return true
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		appErr := app.DoCheckForAdminNotifications(true)
		if appErr != nil {
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(TrialNotifyJobName, jobServer, execute, isEnabled)
	return worker
}

func MakeInstallPluginNotifyWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	isEnabled := func(_ *model.Config) bool {
		return true
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		appErr := app.DoCheckForAdminNotifications(false)
		if appErr != nil {
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(InstallNotifyJobName, jobServer, execute, isEnabled)
	return worker
}
