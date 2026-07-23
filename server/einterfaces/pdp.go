package einterfaces

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/request"
)

// PolicyDecisionPointInterface is the service that evaluates access requests
// using the OpenID Auth API spec. It determines whether a subject can perform
// an action on a resource based on the resource policy.
type PolicyDecisionPointInterface interface {
	AccessEvaluation(rctx request.CTX, accessRequest model.AccessRequest) (model.AccessDecision, *model.AppError)
}
