package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestRetentionPolicyStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestRetentionPolicyStore)
}
