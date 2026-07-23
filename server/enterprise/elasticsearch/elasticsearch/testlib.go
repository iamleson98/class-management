// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"testing"

	"github.com/elastic/go-elasticsearch/v8"
	"github.com/stretchr/testify/require"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/platform/shared/filestore"
	"github.com/iamleson98/sitename/server/v8/platform/shared/filestore/mocks"
)

func createTestClient(t *testing.T, rctx request.CTX, cfg *model.Config, fileStore filestore.FileBackend) *elasticsearch.TypedClient {
	t.Helper()

	if fileStore == nil {
		fileStore = &mocks.FileBackend{}
	}

	client, err := createTypedClient(rctx.Logger(), cfg, fileStore, true)
	require.Nil(t, err)
	return client
}
