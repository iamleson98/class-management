package jobs

import (
	"github.com/iamleson98/sitename/server/public/model"
)

type AccessControlSyncJobInterface interface {
	MakeWorker() model.Worker
	MakeScheduler() Scheduler
}
