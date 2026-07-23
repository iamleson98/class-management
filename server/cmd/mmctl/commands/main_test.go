//go:build e2e

package commands

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/api4"
	"github.com/iamleson98/sitename/server/v8/channels/testlib"
)

func TestMain(m *testing.M) {
	var options = testlib.HelperOptions{
		EnableStore:     true,
		EnableResources: true,
	}

	mainHelper := testlib.NewMainHelperWithOptions(&options)
	api4.SetMainHelper(mainHelper)
	defer mainHelper.Close()

	mainHelper.Main(m)
}
