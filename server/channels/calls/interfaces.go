// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/store"
	"github.com/iamleson98/sitename/server/v8/einterfaces"
)

// StoreBridge exposes only the calls-related sub-stores to the service. The
// full store.Store is injected via ServiceConfig; this is the narrowed view.
type StoreBridge interface {
	Call() store.CallStore
	CallSession() store.CallSessionStore
	CallJob() store.CallJobStore
	CallStat() store.CallStatStore
	CallsChannel() store.CallsChannelStore
}

// HubBroadcaster is the realtime fan-out surface the service needs. It mirrors
// PlatformService.PublishWebSocketEvent / Publish, so the platform itself
// satisfies this interface without an adapter.
type HubBroadcaster interface {
	// Publish broadcasts a websocket event to connected clients (and across
	// the cluster). The event type is prefixed with "custom_calls_".
	Publish(event string, data map[string]any, broadcast *model.WebsocketBroadcast)
}

// Cluster is the subset of einterfaces.ClusterInterface the service uses. The
// method signatures match einterfaces.ClusterInterface exactly so that a
// platform.ClusterInterface satisfies this without an adapter.
type Cluster interface {
	RegisterClusterMessageHandler(event model.ClusterEvent, crm einterfaces.ClusterMessageHandler)
	SendClusterMessage(msg *model.ClusterMessage)
	SendClusterMessageToNode(nodeID string, msg *model.ClusterMessage) error
	IsLeader() bool
}

// ServiceConfig wires the CallService to its dependencies, mirroring
// channels/app/users.ServiceConfig.
type ServiceConfig struct {
	StoreFn  func() StoreBridge
	ConfigFn func() *model.Config

	// Optional but expected in production.
	Cluster Cluster
	Hub     HubBroadcaster

	// KVStore durably persists the rtcd client auth key across restarts.
	// Required when RTCDServiceURL is configured.
	KVStore KVStore

	// PostCreatorFn lazily resolves the app-layer bridge that persists call
	// announcement posts (see posts.go). Optional; when nil no posts are
	// created. Lazy because the service is constructed before the app layer
	// is ready to serve.
	PostCreatorFn func() PostCreator

	// ClientID is the fallback rtcd client identity when no explicit ID is
	// configured (env var or embedded URL credential). Typically the server
	// diagnostic ID.
	ClientID string

	Log     mlog.LoggerIFace
	Metrics einterfaces.MetricsInterface

	// NodeID identifies this server node within the cluster. It is set only
	// when a node may host call state (e.g. the embedded RTC path). When rtcd
	// is used externally the SFU owns the call, so this is left empty.
	NodeID string
}
