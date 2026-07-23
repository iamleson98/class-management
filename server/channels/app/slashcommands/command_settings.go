package slashcommands

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/i18n"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/channels/app"
)

type SettingsProvider struct {
}

const (
	CmdSettings = "settings"
)

func init() {
	app.RegisterCommandProvider(&SettingsProvider{})
}

func (settings *SettingsProvider) GetTrigger() string {
	return CmdSettings
}

func (settings *SettingsProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdSettings,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_settings.desc"),
		AutoCompleteHint: "",
		DisplayName:      T("api.command_settings.name"),
	}
}

func (settings *SettingsProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	// This command is handled client-side and shouldn't hit the server.
	return &model.CommandResponse{
		Text:         args.T("api.command_settings.unsupported.app_error"),
		ResponseType: model.CommandResponseTypeEphemeral,
	}
}
