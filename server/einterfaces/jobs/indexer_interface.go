package jobs

import (
	"github.com/iamleson98/sitename/server/public/model"
)

type IndexerJobInterface interface {
	MakeWorker() model.Worker
}
