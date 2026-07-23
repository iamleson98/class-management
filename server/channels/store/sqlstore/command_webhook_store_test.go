package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestCommandWebhookStore(t *testing.T) {
	StoreTest(t, storetest.TestCommandWebhookStore)
}
