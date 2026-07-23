package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestOutgoingOAuthConnectionStore(t *testing.T) {
	StoreTest(t, storetest.TestOutgoingOAuthConnectionStore)
}
