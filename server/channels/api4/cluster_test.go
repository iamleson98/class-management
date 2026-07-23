package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/iamleson98/sitename/server/public/model"
)

func TestGetClusterStatus(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	t.Run("as system user", func(t *testing.T) {
		_, resp, err := th.Client.GetClusterStatus(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as system admin", func(t *testing.T) {
		infos, _, err := th.SystemAdminClient.GetClusterStatus(context.Background())
		require.NoError(t, err)

		require.NotNil(t, infos, "cluster status should not be nil")
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		_, resp, err := th.SystemAdminClient.GetClusterStatus(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}
