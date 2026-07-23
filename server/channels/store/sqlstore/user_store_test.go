package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/searchtest"
	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestUserStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestUserStore)
}

func TestSearchUserStore(t *testing.T) {
	StoreTestWithSearchTestEngine(t, searchtest.TestSearchUserStore)
}
