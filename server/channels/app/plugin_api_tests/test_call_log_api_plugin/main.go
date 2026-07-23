package main

import (
	"github.com/pkg/errors"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/plugin"
)

type PluginUsingLogAPI struct {
	plugin.MattermostPlugin
}

type Foo struct {
	bar float64
}

func main() {
	plugin.ClientMain(&PluginUsingLogAPI{})
}

func (p *PluginUsingLogAPI) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
	p.API.LogDebug("LogDebug", "one", 1, "two", "two", "foo", Foo{bar: 3.1416})
	p.API.LogInfo("LogInfo", "one", 1, "two", "two", "foo", Foo{bar: 3.1416})
	p.API.LogWarn("LogWarn", "one", 1, "two", "two", "foo", Foo{bar: 3.1416})
	p.API.LogError("LogError", "error", errors.WithStack(errors.New("boom!")))
	return nil, "OK"
}
