package jobs

import (
	"github.com/iamleson98/sitename/server/public/model"
)

type CloudJobInterface interface {
	MakeWorker() model.Worker
	MakeScheduler() Scheduler
}
