package slashcommands

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/i18n"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/channels/app"
)

type DndProvider struct {
}

const (
	CmdDND = "dnd"
)

func init() {
	app.RegisterCommandProvider(&DndProvider{})
}

func (*DndProvider) GetTrigger() string {
	return CmdDND
}

func (*DndProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdDND,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_dnd.desc"),
		DisplayName:      T("api.command_dnd.name"),
	}
}

func (*DndProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	a.SetStatusDoNotDisturb(args.UserId)

	return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: args.T("api.command_dnd.success")}
}
