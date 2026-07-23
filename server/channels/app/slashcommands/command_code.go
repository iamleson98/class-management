package slashcommands

import (
	"strings"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/i18n"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/channels/app"
)

type CodeProvider struct {
}

const (
	CmdCode = "code"
)

func init() {
	app.RegisterCommandProvider(&CodeProvider{})
}

func (*CodeProvider) GetTrigger() string {
	return CmdCode
}

func (*CodeProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdCode,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_code.desc"),
		AutoCompleteHint: T("api.command_code.hint"),
		DisplayName:      T("api.command_code.name"),
	}
}

func (*CodeProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	if message == "" {
		return &model.CommandResponse{Text: args.T("api.command_code.message.app_error"), ResponseType: model.CommandResponseTypeEphemeral}
	}
	rmsg := "    " + strings.Join(strings.Split(message, "\n"), "\n    ")
	return &model.CommandResponse{ResponseType: model.CommandResponseTypeInChannel, Text: rmsg, SkipSlackParsing: true}
}
