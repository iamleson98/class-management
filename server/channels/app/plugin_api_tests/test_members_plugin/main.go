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
	teamMembers, err := p.API.GetTeamMembersForUser(p.configuration.BasicUserID, 0, 10)
	if err != nil {
		return nil, err.Error() + "failed to get team members"
	} else if len(teamMembers) != 1 {
		return nil, "Invalid number of team members"
	} else if teamMembers[0].UserId != p.configuration.BasicUserID || teamMembers[0].TeamId != p.configuration.BasicTeamID {
		return nil, "Invalid user or team id returned"
	}
	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
