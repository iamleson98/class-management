// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

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

	// rtcdKick guards single-flight background re-initialization of the rtcd
	// manager (1 = an init attempt is in flight). It lets a late join kick a
	// retry after the boot-time init loop gave up (rtcd down for >5min at
	// server start) instead of leaving calls dead until a restart.
	rtcdKick atomic.Bool

	// rtcdInitMaxWait / rtcdInitMinBackoff bound the rtcd init retry loop.
	// Defaults are set in Start/kickRTCDInit; tests shrink them.
	rtcdInitMaxWait    time.Duration
	rtcdInitMinBackoff time.Duration
}

// kickRTCDInit starts a background rtcd manager initialization when the
// manager is missing but a URL is configured, at most one attempt at a time.
// Join failures call this so a transiently-unavailable rtcd at boot is
// recovered by the next call attempt rather than by a server restart.
func (s *CallService) kickRTCDInit() {
	if s.rtcdManager() != nil {
		return
	}
	url := s.callsConfig().rtcdURL()
	if url == "" {
		return
	}
	if !s.rtcdKick.CompareAndSwap(false, true) {
		return // already initializing
	}
	if s.rtcdInitMaxWait == 0 {
		s.rtcdInitMaxWait = 5 * time.Minute
	}
	if s.rtcdInitMinBackoff == 0 {
		s.rtcdInitMinBackoff = 2 * time.Second
	}
	go func() {
		defer s.rtcdKick.Store(false)
		s.initRTCDManagerWithRetry(url)
	}()
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

	if url := s.callsConfig().rtcdURL(); url != "" {
		// rtcd resolves via swarm DNS with dnsrr endpoints: during stack
		// rollouts and worker restarts the name can transiently fail to
		// resolve, and a failed init here disables calls until the next
		// server restart. Initialize in the background with retries so the
		// boot path is never blocked and a startup race can never disable
		// calls permanently.
		if s.rtcdInitMaxWait == 0 {
			s.rtcdInitMaxWait = 5 * time.Minute
		}
		if s.rtcdInitMinBackoff == 0 {
			s.rtcdInitMinBackoff = 2 * time.Second
		}
		go s.initRTCDManagerWithRetry(url)
	} else {
		s.log.Warn("calls: rtcd service URL not set; calls media is unavailable until configured")
	}

	s.mut.Lock()
	if s.started {
		// A concurrent Start() won the race; the background init path
		// resolves manager ownership on its own.
		s.mut.Unlock()
		return nil
	}
	s.started = true
	s.mut.Unlock()

	if s.cfg.Cluster != nil {
		s.registerClusterHandlers()
	}
	return nil
}

// initRTCDManagerWithRetry brings up the rtcd client manager, retrying
// transient failures (DNS resolution during dnsrr rollouts, control socket
// connect while rtcd boots) with exponential backoff for up to five minutes
// before giving up with calls disabled until the next restart. A later join
// attempt can kick a fresh round via kickRTCDInit, so "gave up" is not a
// permanent state while the server keeps running.
func (s *CallService) initRTCDManagerWithRetry(url string) {
	const (
		defaultMaxWait    = 5 * time.Minute
		defaultMinBackoff = 2 * time.Second
		defaultMaxBackoff = 15 * time.Second
	)
	maxWait := s.rtcdInitMaxWait
	if maxWait == 0 {
		maxWait = defaultMaxWait
	}
	minBackoff := s.rtcdInitMinBackoff
	if minBackoff == 0 {
		minBackoff = defaultMinBackoff
	}
	maxBackoff := defaultMaxBackoff
	if minBackoff > maxBackoff {
		maxBackoff = minBackoff
	}

	deadline := time.Now().Add(maxWait)
	backoff := minBackoff
	for {
		m, err := newRTCDClientManager(url, s.log, s.cfg.KVStore, s.newRTCDClient, s.handleRTCDMessage)
		if err == nil {
			s.mut.Lock()
			if s.started && s.rtcd == nil {
				s.rtcd = m
				s.mut.Unlock()
				s.log.Info("calls: rtcd client manager started", mlog.String("url", url))
				return
			}
			s.mut.Unlock()
			// Start() lost the race or the service was stopped meanwhile: the
			// manager we built is an orphan — close it so its control
			// connections do not leak.
			if cerr := m.Close(); cerr != nil {
				s.log.Debug("calls: error closing orphan rtcd manager", mlog.Err(cerr))
			}
			return
		}
		if time.Now().After(deadline) {
			s.log.Error("calls: rtcd client manager unavailable; calls disabled until next kick", mlog.String("url", url), mlog.Err(err))
			return
		}
		s.log.Warn("calls: rtcd client manager init failed; retrying", mlog.String("url", url), mlog.Err(err))
		time.Sleep(backoff)
		backoff = min(backoff*2, maxBackoff)
	}
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
// The manager is passed explicitly — the factory runs DURING manager
// construction, long before s.rtcd is assigned, so it must not read the
// service field (that nil-check was the cause of the "rtcd client manager is
// not running" boot failure with an external SFU).
func (s *CallService) newRTCDClient(m *rtcdClientManager, rtcdURL, host string) (RTCDClient, error) {
	if m == nil {
		return nil, errors.New("calls: rtcd client manager is not running")
	}
	cfg, err := m.resolveClientConfig(rtcdURL, s.cfg.ClientID)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve rtcd client config: %w", err)
	}
	adapter, err := newRTCDClientAdapter(cfg, dialFuncForHost(host, m.rtcdPort), s.log)
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
