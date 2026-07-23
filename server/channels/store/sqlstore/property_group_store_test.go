package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestPropertyGroupStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestPropertyGroupStore)
}
