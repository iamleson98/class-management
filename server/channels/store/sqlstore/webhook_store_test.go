package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestWebhookStore(t *testing.T) {
	StoreTest(t, storetest.TestWebhookStore)
}
