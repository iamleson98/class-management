package main

import (
	"fmt"
	"path/filepath"

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
	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		return nil, err.Error() + "failed get bundle path"
	} else if bundlePathFromConfig, _ := filepath.Abs(filepath.Join(*p.API.GetConfig().PluginSettings.Directory, "test_get_bundle_path_plugin")); bundlePathFromConfig != bundlePath {
		return nil, fmt.Sprintf("Invalid bundle path returned: %v vs %v", bundlePathFromConfig, bundlePath)
	}

	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
