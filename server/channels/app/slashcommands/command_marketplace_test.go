package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/iamleson98/sitename/server/public/model"
)

func TestMarketplaceProviderGetCommand(t *testing.T) {
	th := setup(t).initBasic(t)

	mp := MarketplaceProvider{}

	testCases := []struct {
		TestName string

		PluginEnabled      bool
		MarketplaceEnabled bool

		MustAutocomplete bool
	}{
		{
			"All true",
			true, true,
			true,
		},
		{
			"Plugin false",
			false, true,
			false,
		},
		{
			"Marketplace false",
			true, false,
			false,
		},
		{
			"All false",
			false, false,
			false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.TestName, func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PluginSettings.Enable = tc.PluginEnabled
				*cfg.PluginSettings.EnableMarketplace = tc.MarketplaceEnabled
			})

			cmd := mp.GetCommand(th.App, th.Context.T)
			require.Equal(t, tc.MustAutocomplete, cmd.AutoComplete)
		})
	}
}
