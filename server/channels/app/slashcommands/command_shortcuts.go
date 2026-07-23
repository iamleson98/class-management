package slashcommands

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/i18n"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/channels/app"
)

type ShortcutsProvider struct {
}

const (
	CmdShortcuts = "shortcuts"
)

func init() {
	app.RegisterCommandProvider(&ShortcutsProvider{})
}

func (*ShortcutsProvider) GetTrigger() string {
	return CmdShortcuts
}

func (*ShortcutsProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdShortcuts,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_shortcuts.desc"),
		AutoCompleteHint: "",
		DisplayName:      T("api.command_shortcuts.name"),
	}
}

func (*ShortcutsProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	// This command is handled client-side and shouldn't hit the server.
	return &model.CommandResponse{
		Text:         args.T("api.command_shortcuts.unsupported.app_error"),
		ResponseType: model.CommandResponseTypeEphemeral,
	}
}
