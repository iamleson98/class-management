package main

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/plugin"
	"github.com/iamleson98/sitename/server/v8/channels/app/plugin_api_tests"
)

type MyPlugin struct {
	plugin.MattermostPlugin
	configuration plugin_api_tests.BasicConfig
}

func (p *MyPlugin) OnConfigurationChange() error {
	if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
		return err
	}
	return nil
}

func (p *MyPlugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
	// check existing user first
	data, err := p.API.GetProfileImage(p.configuration.BasicUserID)
	if err != nil {
		return nil, err.Error()
	}
	if plugin_api_tests.IsEmpty(data) {
		return nil, "GetProfileImage return empty"
	}

	// then unknown user
	data, err = p.API.GetProfileImage(model.NewId())
	if err == nil || data != nil {
		return nil, "GetProfileImage should've returned an error"
	}
	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
