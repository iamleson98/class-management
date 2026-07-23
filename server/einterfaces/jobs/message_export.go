package jobs

import (
	"github.com/iamleson98/sitename/server/public/model"
)

type MessageExportJobInterface interface {
	MakeWorker() model.Worker
	MakeScheduler() Scheduler
}
