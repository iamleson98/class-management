// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/app/platform"
	"github.com/iamleson98/sitename/server/v8/channels/calls"
)

// callsPluginID is the synthetic plugin ID under which the calls module stores
// its KV values (e.g. the rtcd client auth key). The calls module is a
// first-class in-process service, not a plugin, so it borrows the plugin KV
// store namespace for its small durable config.
const callsPluginID = "calls"

// callsHubAdapter adapts *platform.PlatformService to calls.HubBroadcaster.
// It publishes calls websocket events under the "calls" product namespace,
// which the frontend dispatches via the "custom_calls_<event>" prefix.
type callsHubAdapter struct {
	ps *platform.PlatformService
}

// Publish fans an event out to websocket clients (and across the cluster) via
// the platform hub.
func (a callsHubAdapter) Publish(event string, data map[string]any, broadcast *model.WebsocketBroadcast) {
	if a.ps == nil {
		return
	}
	a.ps.PublishWebSocketEvent("calls", event, data, broadcast)
}

// callsKVAdapter adapts the server's plugin KV store to calls.KVStore, using a
// synthetic plugin ID so the calls module can persist small durable values
// (the rtcd auth key) without being an actual plugin.
type callsKVAdapter struct {
	store KVStorePortion
	log   mlog.LoggerIFace
}

// KVStorePortion is the subset of the store the adapter needs.
type KVStorePortion interface {
	SetWithOptions(pluginID string, key string, value []byte, options model.PluginKVSetOptions) (bool, error)
	Get(pluginID, key string) (*model.PluginKeyValue, error)
}

// Get returns the raw value for a key, or nil if absent.
func (a *callsKVAdapter) Get(key string) ([]byte, error) {
	kv, err := a.store.Get(callsPluginID, key)
	if err != nil {
		return nil, err
	}
	if kv == nil {
		return nil, nil
	}
	return kv.Value, nil
}

// Set stores a value, overwriting any prior value for the key.
func (a *callsKVAdapter) Set(key string, value []byte) error {
	ok, err := a.store.SetWithOptions(callsPluginID, key, value, model.PluginKVSetOptions{
		Atomic:          false,
		ExpireInSeconds: 0,
	})
	if err != nil {
		return err
	}
	if !ok {
		a.log.Warn("calls KV set returned false", mlog.String("key", key))
	}
	return nil
}

// Compile-time assertions that the adapters satisfy the calls interfaces.
var (
	_ calls.HubBroadcaster = (*callsHubAdapter)(nil)
	_ calls.KVStore        = (*callsKVAdapter)(nil)
)
