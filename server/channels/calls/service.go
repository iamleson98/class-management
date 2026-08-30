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
//   - the global session index (connID/sessionID -> call, hot path),
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
	index  *sessionRegistry
	rtcd   *rtcdClientManager
	store  StoreBridge
	hub    HubBroadcaster

	// mut guards the lifecycle fields below (started, rtcd). It is held only
	// for pointer swaps and flag flips — never across network I/O — so the
	// signaling hot path (sendToHost takes mut.RLock) is never blocked.
	mut     sync.RWMutex
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

	storeBridgeInstance := cfg.StoreFn()
	if storeBridgeInstance == nil {
		return nil, errors.New("calls: StoreFn returned a nil store")
	}
	cfgSnapshot := cfg.ConfigFn()
	if cfgSnapshot == nil {
		return nil, errors.New("calls: ConfigFn returned a nil config")
	}

	s := &CallService{
		cfg:    cfg,
		log:    cfg.Log,
		store:  storeBridgeInstance,
		hub:    cfg.Hub,
		shards: newShardRegistry(shardCountFor(&cfgSnapshot.CallsSettings)),
		index:  newSessionRegistry(),
	}
	return s, nil
}

// Start brings up the rtcd client manager (if configured) and registers cluster
// handlers. It is idempotent. The manager construction (DNS resolution plus
// one control WebSocket per discovered host) happens OUTSIDE the service lock
// so signaling on an already-running service is never blocked by startup I/O.
func (s *CallService) Start() error {
	if s.startedFast() {
		return nil
	}

	var mgr *rtcdClientManager
	if url := s.callsConfig().rtcdURL(); url != "" {
		m, err := newRTCDClientManager(url, s.log, s.cfg.KVStore, s.newRTCDClient, s.handleRTCDMessage)
		if err != nil {
			return fmt.Errorf("calls: failed to init rtcd client manager: %w", err)
		}
		mgr = m
	} else {
		s.log.Warn("calls: rtcd service URL not set; calls media is unavailable until configured")
	}

	s.mut.Lock()
	if s.started {
		// A concurrent Start() won the race and already owns the manager.
		s.mut.Unlock()
		if mgr != nil {
			if err := mgr.Close(); err != nil {
				s.log.Warn("calls: closed duplicate rtcd manager", mlog.Err(err))
			}
		}
		return nil
	}
	s.rtcd = mgr
	s.started = true
	s.mut.Unlock()

	if mgr != nil {
		s.log.Info("calls: rtcd client manager started", mlog.String("url", s.callsConfig().rtcdURL()))
	}

	if s.cfg.Cluster != nil {
		s.registerClusterHandlers()
	}
	return nil
}

// Stop tears down the rtcd manager and releases resources. Idempotent.
func (s *CallService) Stop() error {
	s.mut.Lock()
	defer s.mut.Unlock()
	if !s.started {
		return nil
	}
	mgr := s.rtcd
	s.rtcd = nil
	s.started = false
	if mgr != nil {
		if err := mgr.Close(); err != nil {
			return fmt.Errorf("calls: failed to close rtcd client manager: %w", err)
		}
	}
	return nil
}

// Enabled reports whether calls are turned on for this server.
func (s *CallService) Enabled() bool {
	return s.callsConfig().enabled()
}

// HasRTCD reports whether an external rtcd SFU pool is configured and connected.
func (s *CallService) HasRTCD() bool {
	return s.rtcdManager() != nil
}

// rtcdManager returns the live rtcd client manager, or nil when calls run
// without an external SFU (rtcd URL not configured). The read is lock-guarded
// so Stop() can never race a concurrent send into a nil dereference.
func (s *CallService) rtcdManager() *rtcdClientManager {
	s.mut.RLock()
	defer s.mut.RUnlock()
	return s.rtcd
}

func (s *CallService) startedFast() bool {
	s.mut.RLock()
	defer s.mut.RUnlock()
	return s.started
}

// newRTCDClient is the factory passed to the rtcd manager: it resolves the
// client config for this server, builds an adapter pinned to a specific host,
// and brings up the control WebSocket (Register + Connect). One call per host.
func (s *CallService) newRTCDClient(rtcdURL, host string) (RTCDClient, error) {
	mgr := s.rtcdManager()
	if mgr == nil {
		return nil, errors.New("calls: rtcd client manager is not running")
	}
	cfg, err := mgr.resolveClientConfig(rtcdURL, s.cfg.ClientID)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve rtcd client config: %w", err)
	}
	adapter, err := newRTCDClientAdapter(cfg, dialFuncForHost(host, mgr.rtcdPort), s.log)
	if err != nil {
		return nil, err
	}
	if err := adapter.Connect(); err != nil {
		if cerr := adapter.Close(); cerr != nil {
			s.log.Debug("calls: error closing failed rtcd adapter", mlog.Err(cerr))
		}
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
