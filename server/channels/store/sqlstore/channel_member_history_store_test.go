package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestChannelMemberHistoryStore(t *testing.T) {
	StoreTest(t, storetest.TestChannelMemberHistoryStore)
}
