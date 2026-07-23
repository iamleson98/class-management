package mobile_session_metadata

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/iamleson98/sitename/server/v8/einterfaces"
)

func MakeWorker(jobServer *jobs.JobServer, store store.Store, getMetrics func() einterfaces.MetricsInterface) *jobs.SimpleWorker {
	const workerName = "MobileSessionMetadata"

	isEnabled := func(cfg *model.Config) bool {
		return *cfg.MetricsSettings.EnableClientMetrics
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		metrics := getMetrics()
		if metrics == nil {
			return nil
		}

		versions, err := store.Session().GetMobileSessionMetadata()
		if err != nil {
			return err
		}

		metrics.ClearMobileClientSessionMetadata()
		for _, v := range versions {
			metrics.ObserveMobileClientSessionMetadata(v.Version, v.Platform, v.Count, v.NotificationDisabled)
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
