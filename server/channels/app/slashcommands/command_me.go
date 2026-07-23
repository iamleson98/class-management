package slashcommands

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/i18n"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/channels/app"
)

type MeProvider struct {
}

const (
	CmdMe = "me"
)

func init() {
	app.RegisterCommandProvider(&MeProvider{})
}

func (*MeProvider) GetTrigger() string {
	return CmdMe
}

func (*MeProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdMe,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_me.desc"),
		AutoCompleteHint: T("api.command_me.hint"),
		DisplayName:      T("api.command_me.name"),
	}
}

func (*MeProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	return &model.CommandResponse{
		ResponseType: model.CommandResponseTypeInChannel,
		Type:         model.PostTypeMe,
		Text:         "*" + message + "*",
	}
}
