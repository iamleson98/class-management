package sqlstore

import (
	"testing"

	"github.com/iamleson98/sitename/server/v8/channels/store/storetest"
)

func TestLinkMetadataStore(t *testing.T) {
	StoreTest(t, storetest.TestLinkMetadataStore)
}
