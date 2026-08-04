// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"errors"
	"fmt"
	"sync"

	"github.com/iamleson98/sitename/server/public/shared/mlog"
	"github.com/iamleson98/sitename/server/v8/channels/store"
)

// CallService is the singleton realtime call control plane. It owns:
//   - the sharded in-memory call-state registry (hot path),
//   - the rtcd client manager (external SFU, DNS-discovered pool),
//   - the persistence bridge (durable boundaries only),
//   - the realtime hub (presence + signaling fan-out).
//
// It is constructed once at server startup (see channels/app/server.go) and
// shared across requests.
type CallService struct {
	cfg ServiceConfig
	log mlog.LoggerIFace

	shards shardRegistry
	rtcd   *rtcdClientManager
	store  StoreBridge
	hub    HubBroadcaster

	mut     sync.RWMutex
	stopCh  chan struct{}
	started bool
}

// storeBridge adapts a store.Store to the narrowed StoreBridge view.
type storeBridge struct{ s store.Store }

func (b storeBridge) Call() store.CallStore                 { return b.s.Call() }
func (b storeBridge) CallSession() store.CallSessionStore   { return b.s.CallSession() }
func (b storeBridge) CallJob() store.CallJobStore           { return b.s.CallJob() }
func (b storeBridge) CallStat() store.CallStatStore         { return b.s.CallStat() }
func (b storeBridge) CallsChannel() store.CallsChannelStore { return b.s.CallsChannel() }

// NewStoreBridge wraps a full store.Store in the narrowed StoreBridge view
// the CallService consumes.
func NewStoreBridge(s store.Store) StoreBridge { return storeBridge{s: s} }

// New constructs the CallService. It does not start background work or connect
// to rtcd until Start is called.
func New(cfg ServiceConfig) (*CallService, error) {
	if cfg.StoreFn == nil || cfg.ConfigFn == nil {
		return nil, errors.New("calls: StoreFn and ConfigFn are required")
	}
	if cfg.Log == nil {
		return nil, errors.New("calls: Log is required")
	}
	if cfg.Hub == nil {
		return nil, errors.New("calls: Hub is required")
	}

	s := &CallService{
		cfg:    cfg,
		log:    cfg.Log,
		store:  cfg.StoreFn(),
		hub:    cfg.Hub,
		shards: newShardRegistry(shardCountFor(&cfg.ConfigFn().CallsSettings)),
		stopCh: make(chan struct{}),
	}
	return s, nil
}

// Start brings up the rtcd client manager (if configured) and registers cluster
// handlers. It is idempotent.
func (s *CallService) Start() error {
	s.mut.Lock()
	defer s.mut.Unlock()
	if s.started {
		return nil
	}

	if url := s.callsConfig().rtcdURL(); url != "" {
		mgr, err := newRTCDClientManager(url, s.log, s.cfg.KVStore, s.newRTCDClient)
		if err != nil {
			return fmt.Errorf("calls: failed to init rtcd client manager: %w", err)
		}
		s.rtcd = mgr
		s.log.Info("calls: rtcd client manager started", mlog.String("url", url))
	} else {
		s.log.Warn("calls: rtcd service URL not set; calls media is unavailable until configured")
	}

	if s.cfg.Cluster != nil {
		s.registerClusterHandlers()
	}

	s.started = true
	return nil
}

// Stop tears down the rtcd manager and releases resources.
func (s *CallService) Stop() error {
	s.mut.Lock()
	defer s.mut.Unlock()
	if !s.started {
		return nil
	}
	close(s.stopCh)
	if s.rtcd != nil {
		_ = s.rtcd.Close()
		s.rtcd = nil
	}
	s.started = false
	return nil
}

// Enabled reports whether calls are turned on for this server.
func (s *CallService) Enabled() bool {
	return s.callsConfig().enabled()
}

// HasRTCD reports whether an external rtcd SFU pool is configured and connected.
func (s *CallService) HasRTCD() bool {
	s.mut.RLock()
	defer s.mut.RUnlock()
	return s.rtcd != nil
}

// newRTCDClient is the factory passed to the rtcd manager: it resolves the
// client config for this server, builds an adapter pinned to a specific host,
// and brings up the control WebSocket (Register + Connect). One call per host.
func (s *CallService) newRTCDClient(rtcdURL, host string) (RTCDClient, error) {
	cfg, err := s.rtcd.resolveClientConfig(rtcdURL, s.cfg.ClientID)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve rtcd client config: %w", err)
	}
	adapter, err := newRTCDClientAdapter(cfg, dialFuncForHost(host, s.rtcd.rtcdPort), s.log)
	if err != nil {
		return nil, err
	}
	if err := adapter.Connect(); err != nil {
		adapter.Close()
		return nil, err
	}
	return adapter, nil
}

// registerClusterHandlers subscribes to calls cluster events for cross-node
// state synchronization. Full cluster sync is layered in next; the wiring is
// here so the seam is explicit.
func (s *CallService) registerClusterHandlers() {
	// Cluster event constants and handlers are added in the cluster sync step.
	// Kept as a no-op seam here to avoid referencing not-yet-defined constants.
	_ = s.cfg.Cluster
}
