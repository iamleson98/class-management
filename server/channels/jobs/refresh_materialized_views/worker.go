package refresh_materialized_views

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

const jobName = "RefreshMaterializedViews"

func MakeWorker(jobServer *jobs.JobServer, sqlDriverName string) *jobs.SimpleWorker {
	isEnabled := func(cfg *model.Config) bool {
		return sqlDriverName == model.DatabaseDriverPostgres
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		if err := jobServer.Store.Post().RefreshPostStats(); err != nil {
			return err
		}

		if err := jobServer.Store.FileInfo().RefreshFileStats(); err != nil {
			return err
		}

		return jobServer.Store.User().RefreshPostStatsForUsers()
	}

	worker := jobs.NewSimpleWorker(jobName, jobServer, execute, isEnabled)
	return worker
}
