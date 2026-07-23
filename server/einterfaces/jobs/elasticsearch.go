package jobs

import (
	"github.com/iamleson98/sitename/server/public/model"
)

type ElasticsearchIndexerInterface interface {
	MakeWorker() model.Worker
}

type ElasticsearchAggregatorInterface interface {
	MakeWorker() model.Worker
	MakeScheduler() Scheduler
}
