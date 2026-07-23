package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestChannelStoreCategories(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestChannelStoreCategories)
}
