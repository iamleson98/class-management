package users

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/iamleson98/sitename/server/public/model"
)

func TestNew(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	_, err := New(ServiceConfig{})
	require.Error(t, err)

	dbStore := mainHelper.GetStore()

	cfn := func() *model.Config {
		return &model.Config{}
	}

	_, err = New(ServiceConfig{
		UserStore:    dbStore.User(),
		SessionStore: dbStore.Session(),
		OAuthStore:   dbStore.OAuth(),
		ConfigFn:     cfn,
	})
	require.NoError(t, err)
}
