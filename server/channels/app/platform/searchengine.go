package platform

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

func (ps *PlatformService) StartSearchEngine() string {
	if ps.SearchEngine.ElasticsearchEngine != nil && ps.SearchEngine.ElasticsearchEngine.IsEnabled() {
		ps.Go(func() {
			if err := ps.SearchEngine.ElasticsearchEngine.Start(); err != nil {
				ps.Log().Error(err.Error())
			}
		})
	}

	configListenerId := ps.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
		if ps.SearchEngine == nil {
			return
		}

		if err := ps.SearchEngine.UpdateConfig(newConfig); err != nil {
			ps.Log().Error("Failed to update search engine config", mlog.Err(err))
		}

		if ps.SearchEngine.ElasticsearchEngine != nil && !*oldConfig.ElasticsearchSettings.EnableIndexing && *newConfig.ElasticsearchSettings.EnableIndexing {
			ps.Go(func() {
				if err := ps.SearchEngine.ElasticsearchEngine.Start(); err != nil {
					ps.Log().Error(err.Error())
				}
			})
		} else if ps.SearchEngine.ElasticsearchEngine != nil && *oldConfig.ElasticsearchSettings.EnableIndexing && !*newConfig.ElasticsearchSettings.EnableIndexing {
			ps.Go(func() {
				if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
					ps.Log().Error(err.Error())
				}
			})
		} else if ps.SearchEngine.ElasticsearchEngine != nil && *oldConfig.ElasticsearchSettings.Password != *newConfig.ElasticsearchSettings.Password || *oldConfig.ElasticsearchSettings.Username != *newConfig.ElasticsearchSettings.Username || *oldConfig.ElasticsearchSettings.ConnectionURL != *newConfig.ElasticsearchSettings.ConnectionURL || *oldConfig.ElasticsearchSettings.Sniff != *newConfig.ElasticsearchSettings.Sniff {
			ps.Go(func() {
				if *oldConfig.ElasticsearchSettings.EnableIndexing {
					if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
						ps.Log().Error(err.Error())
					}
					if err := ps.SearchEngine.ElasticsearchEngine.Start(); err != nil {
						ps.Log().Error(err.Error())
					}
				}
			})
		}
	})

	return configListenerId
}

func (ps *PlatformService) StopSearchEngine() {
	ps.RemoveConfigListener(ps.searchConfigListenerId)
	if ps.SearchEngine != nil && ps.SearchEngine.ElasticsearchEngine != nil && ps.SearchEngine.ElasticsearchEngine.IsActive() {
		if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
			ps.Log().Error("Failed to stop Elasticsearch engine", mlog.Err(err))
		}
	}
}
