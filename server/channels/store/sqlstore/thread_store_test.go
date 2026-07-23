package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestThreadStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestThreadStore)
}
