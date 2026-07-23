package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestPostAcknowledgementsStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestPostAcknowledgementsStore)
}
