package einterfaces

import (
	saml2 "github.com/mattermost/gosaml2"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/request"
)

type SamlInterface interface {
	ConfigureSP(rctx request.CTX) error
	BuildRequest(rctx request.CTX, relayState string) (*model.SamlAuthRequest, *model.AppError)
	DoLogin(rctx request.CTX, encodedXML string, relayState map[string]string) (*model.User, *saml2.AssertionInfo, *model.AppError)
	GetMetadata(rctx request.CTX) (string, *model.AppError)
	CheckProviderAttributes(rctx request.CTX, SS *model.SamlSettings, ouser *model.User, patch *model.UserPatch) string
}
