package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestPostPriorityStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestPostPriorityStore)
}
