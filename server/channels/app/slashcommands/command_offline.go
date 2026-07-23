package slashcommands

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/i18n"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/channels/app"
)

type OfflineProvider struct {
}

const (
	CmdOffline = "offline"
)

func init() {
	app.RegisterCommandProvider(&OfflineProvider{})
}

func (*OfflineProvider) GetTrigger() string {
	return CmdOffline
}

func (*OfflineProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdOffline,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_offline.desc"),
		DisplayName:      T("api.command_offline.name"),
	}
}

func (*OfflineProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	a.SetStatusOffline(args.UserId, true, false)

	return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_offline.success")}
}
