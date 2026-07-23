package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestRemoteClusterStore(t *testing.T) {
	StoreTest(t, storetest.TestRemoteClusterStore)
}
