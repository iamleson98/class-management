package cleanup_desktop_tokens

import (
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

const jobName = "CleanupDesktopTokens"
const maxAge = 5 * time.Minute

func MakeWorker(jobServer *jobs.JobServer) *jobs.SimpleWorker {
	isEnabled := func(cfg *model.Config) bool {
		return true
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		return jobServer.Store.DesktopTokens().DeleteOlderThan(time.Now().Add(-maxAge).Unix())
	}
	worker := jobs.NewSimpleWorker(jobName, jobServer, execute, isEnabled)
	return worker
}
