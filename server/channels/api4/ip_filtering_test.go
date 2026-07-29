package api4

import (
	"context"
	"os"
	"testing"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/plugin/plugintest/mock"
	"github.com/iamleson98/sitename/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

func Test_getIPFilters(t *testing.T) {

	t.Run("No license returns 501", func(t *testing.T) {
		t.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("No feature flag returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("Feature flag and license but no permission", func(t *testing.T) {
		t.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		_, _, err := th.Client.Login(context.Background(), th.BasicUser2.Email, th.BasicUser2.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 403, r.StatusCode)
	})

	t.Run("Feature flag and license and permission", func(t *testing.T) {
		t.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFiltering.Mock.On("GetIPFilters").Return(&model.AllowedIPRanges{
			model.AllowedIPRange{
				CIDRBlock:   "127.0.0.1/32",
				Description: "test",
			},
		}, nil)
		th.App.Srv().IPFiltering = ipFiltering

		_, _, err := th.Client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.NoError(t, err)
		require.NotNil(t, ipFilters)
		require.Equal(t, 200, r.StatusCode)
	})

	t.Run("Feature flag and license and permission but not cloud returns 503", func(t *testing.T) {
		t.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFiltering.Mock.On("GetIPFilters").Return(&model.AllowedIPRanges{
			model.AllowedIPRange{
				CIDRBlock:   "127.0.0.1/32",
				Description: "test",
			},
		}, nil)
		th.App.Srv().IPFiltering = ipFiltering

		_, _, err := th.Client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})
}

func Test_applyIPFilters(t *testing.T) {
	allowedRanges := &model.AllowedIPRanges{
		model.AllowedIPRange{
			CIDRBlock:   "127.0.0.1/32",
			Description: "test",
		},
	}

	// Initialize the allowedRanges variable
	t.Run("No license returns 501", func(t *testing.T) {
		t.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("License but no feature flag returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("feature flag and license but no permission", func(t *testing.T) {
		t.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		th := Setup(t).InitBasic(t)

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 403, r.StatusCode)
	})

	t.Run("Feature flag and license and permission", func(t *testing.T) {
		t.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFiltering.Mock.On("ApplyIPFilters", mock.Anything).Return(&model.AllowedIPRanges{
			model.AllowedIPRange{
				CIDRBlock:   "127.0.0.1/32",
				Description: "test",
			},
		}, nil)
		th.App.Srv().IPFiltering = ipFiltering

		cloud := &mocks.CloudInterface{}
		cloud.Mock.On("GetCloudCustomer", mock.Anything).Return(&model.CloudCustomer{
			CloudCustomerInfo: model.CloudCustomerInfo{Email: "test@localhost"},
		}, nil)

		th.App.Srv().Cloud = cloud

		_, _, err := th.Client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.NoError(t, err)
		require.NotNil(t, ipFilters)
		require.Equal(t, 200, r.StatusCode)
	})
}

func Test_getMyIP(t *testing.T) {
	t.Run("No license returns 501", func(t *testing.T) {
		t.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		myIP, r, err := th.Client.GetMyIP(context.Background())
		require.Error(t, err)
		require.Nil(t, myIP)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("Licensed, but no feature flag returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic(t)

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		myIP, r, err := th.Client.GetMyIP(context.Background())
		require.Error(t, err)
		require.Nil(t, myIP)
		require.Equal(t, 501, r.StatusCode)
	})
}
