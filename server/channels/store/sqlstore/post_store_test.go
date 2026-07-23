package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/searchtest"
	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestPostStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestPostStore)
}

func TestSearchPostStore(t *testing.T) {
	StoreTestWithSearchTestEngine(t, searchtest.TestSearchPostStore)
}
