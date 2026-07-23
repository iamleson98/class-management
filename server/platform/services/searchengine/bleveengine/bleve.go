package bleveengine

import (
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"sync/atomic"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/v2/index/scorch"
	"github.com/blevesearch/bleve/v2/mapping"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/public/shared/request"
	"github.com/iamleson98/sitename/server/v8/platform/services/searchengine"
)

const (
	EngineName   = "bleve"
	PostIndex    = "posts"
	FileIndex    = "files"
	UserIndex    = "users"
	ChannelIndex = "channels"
	MapIndex     = "map"
)

type BleveEngine struct {
	PostIndex    bleve.Index
	FileIndex    bleve.Index
	UserIndex    bleve.Index
	ChannelIndex bleve.Index
	MapIndex     bleve.Index // for realtime map search
	Mutex        sync.RWMutex
	ready        int32
	cfg          *model.Config
	indexSync    bool
}

var _ searchengine.SearchEngineInterface = (*BleveEngine)(nil)

var keywordMapping *mapping.FieldMapping
var standardMapping *mapping.FieldMapping
var dateMapping *mapping.FieldMapping

func init() {
	keywordMapping = bleve.NewTextFieldMapping()
	keywordMapping.Analyzer = keyword.Name

	standardMapping = bleve.NewTextFieldMapping()
	standardMapping.Analyzer = standard.Name

	dateMapping = bleve.NewNumericFieldMapping()
}

func getMapIndexMapping() *mapping.IndexMappingImpl {
	im := bleve.NewIndexMapping()
	dm := bleve.NewDocumentMapping()

	text := func() *mapping.FieldMapping {
		f := bleve.NewTextFieldMapping()
		f.Analyzer = standard.Name
		f.Store = true
		f.Index = true
		f.IncludeTermVectors = false
		f.IncludeInAll = true
		return f
	}

	// Keyword (exact match, not analyzed) + stored
	kw := func() *mapping.FieldMapping {
		f := bleve.NewTextFieldMapping()
		f.Analyzer = keyword.Name
		f.Store = true
		f.Index = true
		f.IncludeTermVectors = false
		f.IncludeInAll = false
		return f
	}

	// Numeric + stored + indexed
	num := func() *mapping.FieldMapping {
		f := bleve.NewNumericFieldMapping()
		f.Store = true
		f.Index = true
		f.IncludeInAll = false
		return f
	}

	// Stored-only (not indexed)
	stored := func() *mapping.FieldMapping {
		f := bleve.NewTextFieldMapping()
		f.Store = true
		f.Index = false
		f.IncludeInAll = false
		return f
	}

	// Full-text searchable fields
	dm.AddFieldMappingsAt("name", text())
	dm.AddFieldMappingsAt("country", text())
	dm.AddFieldMappingsAt("state", text())
	dm.AddFieldMappingsAt("county", text())
	dm.AddFieldMappingsAt("city", text())
	dm.AddFieldMappingsAt("district", text())
	dm.AddFieldMappingsAt("postcode", text())
	dm.AddFieldMappingsAt("street", text())

	// Keyword fields (exact match)
	dm.AddFieldMappingsAt("osm_id", kw())
	dm.AddFieldMappingsAt("housenumber", kw())
	dm.AddFieldMappingsAt("osm_type", kw())
	dm.AddFieldMappingsAt("osm_key", kw())
	dm.AddFieldMappingsAt("osm_value", kw())
	dm.AddFieldMappingsAt("place_type", kw())
	dm.AddFieldMappingsAt("country_code", kw())
	dm.AddFieldMappingsAt("geohash4", kw())
	dm.AddFieldMappingsAt("geohash6", kw())

	// Numeric fields
	dm.AddFieldMappingsAt("longitude", num())
	dm.AddFieldMappingsAt("latitude", num())
	dm.AddFieldMappingsAt("importance", num())

	// Stored-only
	dm.AddFieldMappingsAt("name_translations", stored())

	im.DefaultMapping = dm
	im.DefaultAnalyzer = standard.Name

	return im
}

func getChannelIndexMapping() *mapping.IndexMappingImpl {
	channelMapping := bleve.NewDocumentMapping()
	channelMapping.AddFieldMappingsAt("Id", keywordMapping)
	channelMapping.AddFieldMappingsAt("Type", keywordMapping)
	channelMapping.AddFieldMappingsAt("TeamId", keywordMapping)
	channelMapping.AddFieldMappingsAt("NameSuggest", keywordMapping)
	channelMapping.AddFieldMappingsAt("UserIDs", keywordMapping)
	channelMapping.AddFieldMappingsAt("TeamMemberIDs", keywordMapping)

	indexMapping := bleve.NewIndexMapping()
	indexMapping.AddDocumentMapping("_default", channelMapping)

	return indexMapping
}

func getPostIndexMapping() *mapping.IndexMappingImpl {
	postMapping := bleve.NewDocumentMapping()
	postMapping.AddFieldMappingsAt("Id", keywordMapping)
	postMapping.AddFieldMappingsAt("TeamId", keywordMapping)
	postMapping.AddFieldMappingsAt("ChannelId", keywordMapping)
	postMapping.AddFieldMappingsAt("UserId", keywordMapping)
	postMapping.AddFieldMappingsAt("CreateAt", dateMapping)
	postMapping.AddFieldMappingsAt("Message", standardMapping)
	postMapping.AddFieldMappingsAt("Type", keywordMapping)
	postMapping.AddFieldMappingsAt("Hashtags", standardMapping)
	postMapping.AddFieldMappingsAt("Attachments", standardMapping)

	indexMapping := bleve.NewIndexMapping()
	indexMapping.AddDocumentMapping("_default", postMapping)

	return indexMapping
}

func getFileIndexMapping() *mapping.IndexMappingImpl {
	fileMapping := bleve.NewDocumentMapping()
	fileMapping.AddFieldMappingsAt("Id", keywordMapping)
	fileMapping.AddFieldMappingsAt("CreatorId", keywordMapping)
	fileMapping.AddFieldMappingsAt("ChannelId", keywordMapping)
	fileMapping.AddFieldMappingsAt("CreateAt", dateMapping)
	fileMapping.AddFieldMappingsAt("Name", standardMapping)
	fileMapping.AddFieldMappingsAt("Content", standardMapping)
	fileMapping.AddFieldMappingsAt("Extension", keywordMapping)
	fileMapping.AddFieldMappingsAt("Content", standardMapping)

	indexMapping := bleve.NewIndexMapping()
	indexMapping.AddDocumentMapping("_default", fileMapping)

	return indexMapping
}

func getUserIndexMapping() *mapping.IndexMappingImpl {
	userMapping := bleve.NewDocumentMapping()
	userMapping.AddFieldMappingsAt("Id", keywordMapping)
	userMapping.AddFieldMappingsAt("SuggestionsWithFullname", keywordMapping)
	userMapping.AddFieldMappingsAt("SuggestionsWithoutFullname", keywordMapping)
	userMapping.AddFieldMappingsAt("TeamsIds", keywordMapping)
	userMapping.AddFieldMappingsAt("ChannelsIds", keywordMapping)

	indexMapping := bleve.NewIndexMapping()
	indexMapping.AddDocumentMapping("_default", userMapping)

	return indexMapping
}

func NewBleveEngine(cfg *model.Config) *BleveEngine {
	return &BleveEngine{
		cfg: cfg,
	}
}

func (b *BleveEngine) getIndexDir(indexName string) string {
	return filepath.Join(*b.cfg.BleveSettings.IndexDir, indexName+".bleve")
}

func (b *BleveEngine) createOrOpenIndex(indexName string, mapping *mapping.IndexMappingImpl) (bleve.Index, error) {
	indexPath := b.getIndexDir(indexName)
	if index, err := bleve.Open(indexPath); err == nil {
		return index, nil
	}

	index, err := bleve.NewUsing(indexPath, mapping, scorch.Name, scorch.Name, map[string]any{
		"forceSegmentType":    "zap",
		"forceSegmentVersion": 15,
	})
	if err != nil {
		return nil, err
	}
	return index, nil
}

func (b *BleveEngine) openIndexes() *model.AppError {
	if atomic.LoadInt32(&b.ready) != 0 {
		return model.NewAppError("Bleveengine.Start", "bleveengine.already_started.error", nil, "", http.StatusInternalServerError)
	}

	var err error
	b.PostIndex, err = b.createOrOpenIndex(PostIndex, getPostIndexMapping())
	if err != nil {
		return model.NewAppError("Bleveengine.Start", "bleveengine.create_post_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	b.FileIndex, err = b.createOrOpenIndex(FileIndex, getFileIndexMapping())
	if err != nil {
		return model.NewAppError("Bleveengine.Start", "bleveengine.create_file_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	b.UserIndex, err = b.createOrOpenIndex(UserIndex, getUserIndexMapping())
	if err != nil {
		return model.NewAppError("Bleveengine.Start", "bleveengine.create_user_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	b.ChannelIndex, err = b.createOrOpenIndex(ChannelIndex, getChannelIndexMapping())
	if err != nil {
		return model.NewAppError("Bleveengine.Start", "bleveengine.create_channel_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	b.MapIndex, err = b.createOrOpenIndex(MapIndex, getMapIndexMapping())
	if err != nil {
		return model.NewAppError("Bleveengine.Start", "bleveengine.create_map_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	atomic.StoreInt32(&b.ready, 1)
	return nil
}

func (b *BleveEngine) Start() *model.AppError {
	if !*b.cfg.BleveSettings.EnableIndexing || *b.cfg.BleveSettings.IndexDir == "" {
		return nil
	}

	b.Mutex.Lock()
	defer b.Mutex.Unlock()

	mlog.Info("EXPERIMENTAL: Starting Bleve")

	return b.openIndexes()
}

func (b *BleveEngine) closeIndexes() *model.AppError {
	if b.IsActive() {
		if err := b.PostIndex.Close(); err != nil {
			return model.NewAppError("Bleveengine.Stop", "bleveengine.stop_post_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if err := b.FileIndex.Close(); err != nil {
			return model.NewAppError("Bleveengine.Stop", "bleveengine.stop_file_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if err := b.UserIndex.Close(); err != nil {
			return model.NewAppError("Bleveengine.Stop", "bleveengine.stop_user_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if err := b.ChannelIndex.Close(); err != nil {
			return model.NewAppError("Bleveengine.Stop", "bleveengine.stop_channel_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if err := b.MapIndex.Close(); err != nil {
			return model.NewAppError("Bleveengine.Stop", "bleveengine.stop_map_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	atomic.StoreInt32(&b.ready, 0)
	return nil
}

func (b *BleveEngine) Stop() *model.AppError {
	b.Mutex.Lock()
	defer b.Mutex.Unlock()

	mlog.Info("Stopping Bleve")

	return b.closeIndexes()
}

func (b *BleveEngine) IsEnabled() bool {
	return b.IsIndexingEnabled()
}

func (b *BleveEngine) IsActive() bool {
	return atomic.LoadInt32(&b.ready) == 1
}

func (b *BleveEngine) IsIndexingSync() bool {
	return b.indexSync
}

func (b *BleveEngine) RefreshIndexes(_ request.CTX) *model.AppError {
	return nil
}

func (b *BleveEngine) GetVersion() int {
	return 0
}

func (b *BleveEngine) GetFullVersion() string {
	return "0"
}

func (b *BleveEngine) GetPlugins() []string {
	return []string{}
}

func (b *BleveEngine) GetName() string {
	return EngineName
}

func (b *BleveEngine) TestConfig(rctx request.CTX, cfg *model.Config) *model.AppError {
	return nil
}

func (b *BleveEngine) deleteIndexes() *model.AppError {
	if err := os.RemoveAll(b.getIndexDir(PostIndex)); err != nil {
		return model.NewAppError("Bleveengine.PurgeIndexes", "bleveengine.purge_post_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := os.RemoveAll(b.getIndexDir(UserIndex)); err != nil {
		return model.NewAppError("Bleveengine.PurgeIndexes", "bleveengine.purge_user_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := os.RemoveAll(b.getIndexDir(ChannelIndex)); err != nil {
		return model.NewAppError("Bleveengine.PurgeIndexes", "bleveengine.purge_channel_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := os.RemoveAll(b.getIndexDir(FileIndex)); err != nil {
		return model.NewAppError("Bleveengine.PurgeIndexes", "bleveengine.purge_file_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := os.RemoveAll(b.getIndexDir(MapIndex)); err != nil {
		return model.NewAppError("Bleveengine.PurgeIndexes", "bleveengine.purge_map_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (b *BleveEngine) PurgeIndexes(rctx request.CTX) *model.AppError {
	if *b.cfg.BleveSettings.IndexDir == "" {
		return nil
	}

	b.Mutex.Lock()
	defer b.Mutex.Unlock()

	rctx.Logger().Info("PurgeIndexes Bleve")
	if err := b.closeIndexes(); err != nil {
		return err
	}

	if err := b.deleteIndexes(); err != nil {
		return err
	}

	return b.openIndexes()
}

func (b *BleveEngine) PurgeIndexList(rctx request.CTX, indexes []string) *model.AppError {
	return model.NewAppError("Bleve.PurgeIndex", "bleveengine.purge_list.not_implemented", nil, "not implemented", http.StatusNotFound)
}

func (b *BleveEngine) DataRetentionDeleteIndexes(rctx request.CTX, cutoff time.Time) *model.AppError {
	return nil
}

func (b *BleveEngine) IsAutocompletionEnabled() bool {
	return *b.cfg.BleveSettings.EnableAutocomplete
}

func (b *BleveEngine) IsIndexingEnabled() bool {
	return *b.cfg.BleveSettings.EnableIndexing
}

func (b *BleveEngine) IsSearchEnabled() bool {
	return *b.cfg.BleveSettings.EnableSearching
}

func (b *BleveEngine) UpdateConfig(cfg *model.Config) {
	b.Mutex.Lock()
	defer b.Mutex.Unlock()

	if reflect.DeepEqual(cfg.BleveSettings, b.cfg.BleveSettings) {
		return
	}

	mlog.Info("UpdateConf Bleve")

	if *cfg.BleveSettings.EnableIndexing != *b.cfg.BleveSettings.EnableIndexing || *cfg.BleveSettings.IndexDir != *b.cfg.BleveSettings.IndexDir {
		if err := b.closeIndexes(); err != nil {
			mlog.Error("Error closing Bleve indexes to update the config", mlog.Err(err))
			return
		}
		b.cfg = cfg
		if err := b.openIndexes(); err != nil {
			mlog.Error("Error opening Bleve indexes after updating the config", mlog.Err(err))
		}
		return
	}
	b.cfg = cfg
}
