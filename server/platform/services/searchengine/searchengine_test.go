package searchengine

import (
	"testing"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/platform/services/searchengine/mocks"
	"github.com/stretchr/testify/assert"
)

func TestActiveEngine(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()

	b := NewBroker(cfg)

	esMock := &mocks.SearchEngineInterface{}
	esMock.On("IsActive").Return(true)
	esMock.On("GetName").Return("elasticsearch")

	assert.Equal(t, "database", b.ActiveEngine())

	b.ElasticsearchEngine = esMock
	assert.Equal(t, "elasticsearch", b.ActiveEngine())

	b.ElasticsearchEngine = nil
	*b.cfg.SqlSettings.DisableDatabaseSearch = true

	assert.Equal(t, "none", b.ActiveEngine())
}
