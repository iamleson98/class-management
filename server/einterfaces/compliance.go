package einterfaces

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/request"
)

type ComplianceInterface interface {
	StartComplianceDailyJob()
	RunComplianceJob(rctx request.CTX, job *model.Compliance) *model.AppError
}
