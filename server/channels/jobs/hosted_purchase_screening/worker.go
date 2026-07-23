package hosted_purchase_screening

import (
	"strconv"
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/jobs"
)

const (
	// 3 days matches the expecation given in portal purchase flow.
	waitForScreeningDuration = 3 * 24 * time.Hour
)

type ScreenTimeStore interface {
	GetByName(string) (*model.System, error)
	PermanentDeleteByName(name string) (*model.System, error)
}

func MakeWorker(jobServer *jobs.JobServer, screenTimeStore ScreenTimeStore) *jobs.SimpleWorker {
	const workerName = "HostedPurchaseScreening"

	isEnabled := func(_ *model.Config) bool {
		return true
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		now := time.Now()
		screenTimeValue, err := screenTimeStore.GetByName(model.SystemHostedPurchaseNeedsScreening)
		if err != nil {
			return err
		}
		screenTime, err := strconv.ParseInt(screenTimeValue.Value, 10, 64)
		if err != nil {
			return err
		}

		if now.After(time.UnixMilli(screenTime).Add(waitForScreeningDuration)) {
			_, err = screenTimeStore.PermanentDeleteByName(model.SystemHostedPurchaseNeedsScreening)
			if err != nil {
				return err
			}
		}
		return nil
	}
	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
