package pluginapi_test

import (
	"github.com/iamleson98/sitename/server/public/pluginapi"

	"github.com/iamleson98/sitename/server/public/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin
	client *pluginapi.Client
}

func (p *Plugin) OnActivate() error {
	p.client = pluginapi.NewClient(p.API, p.Driver)

	return nil
}

func Example() {
}
