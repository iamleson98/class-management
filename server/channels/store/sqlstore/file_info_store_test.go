package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/searchtest"
	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestFileInfoStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestFileInfoStore)
}

func TestSearchFileInfoStore(t *testing.T) {
	StoreTestWithSearchTestEngine(t, searchtest.TestSearchFileInfoStore)
}
