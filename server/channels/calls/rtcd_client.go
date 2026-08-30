// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/iamleson98/sitename/server/public/shared/mlog"

	rtcd "github.com/mattermost/rtcd/service"
	"github.com/mattermost/rtcd/service/random"
	"github.com/mattermost/rtcd/service/rtc"
)

// rtcd-related constants, ported from the plugin's rtcd.go. They govern DNS
// discovery, reconnection, and host health.
const (
	resolveTimeout          = 2 * time.Second
	dialingTimeout          = 4 * time.Second
	hostCheckInterval       = 10 * time.Second
	baseReconnectIntervalMs = 5000

	rtcdConfigKVKey = "calls_rtcd_config"
)

// RTCDClient is the surface the manager relies on for each rtcd host. The
// concrete implementation (rtcdClientAdapter) wraps rtcd/service.Client.
type RTCDClient interface {
	Connect() error
	Connected() bool
	Send(msg rtcd.ClientMessage) error
	ReceiveCh() <-chan rtcd.ClientMessage
	ErrorCh() <-chan error
	Close() error
}

// rtcdHost is one resolved rtcd backend IP and its client.
type rtcdHost struct {
	ip      string
	client  RTCDClient
	flagged bool
	mut     sync.RWMutex
}

func (h *rtcdHost) isFlagged() bool {
	h.mut.RLock()
	defer h.mut.RUnlock()
	return h.flagged
}

func (h *rtcdHost) setFlagged(v bool) {
	h.mut.Lock()
	defer h.mut.Unlock()
	h.flagged = v
}

// rtcdClientManager owns one persistent client per rtcd host IP, discovered
// via DNS against the configured rtcd URL. It is the horizontal-scaling
// primitive: put N rtcd instances behind a DNS name and the manager discovers
// them all, health-flags dropped hosts, and assigns new calls across the pool.
type rtcdClientManager struct {
	log   mlog.LoggerIFace
	store KVStore

	rtcdURL  string
	rtcdPort string

	hosts map[string]*rtcdHost

	// newClient builds an RTCDClient for a given host. Pluggable so tests can
	// inject a fake without touching the network.
	newClient func(rtcdURL, host string) (RTCDClient, error)

	// onMessage, when set, receives every message every rtcd host sends back
	// (SDP answers/ICE, VAD voice events, session closes). Set once at
	// construction; read-only afterwards.
	onMessage func(host string, msg rtcd.ClientMessage)

	mut       sync.RWMutex
	closeCh   chan struct{}
	closeOnce sync.Once
}

// KVStore is the narrow persistence surface the manager needs to durably store
// its rtcd auth key across restarts. Satisfied by the server's plugin KV store.
type KVStore interface {
	Get(key string) ([]byte, error)
	Set(key string, value []byte) error
}

// rtcdConfigStore adapts a KVStore to typed JSON get/set for rtcd.ClientConfig.
type rtcdConfigStore struct {
	kv  KVStore
	log mlog.LoggerIFace
	mut sync.Mutex
}

func (s *rtcdConfigStore) store(cfg rtcd.ClientConfig) error {
	s.mut.Lock()
	defer s.mut.Unlock()
	data, err := json.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal rtcd config: %w", err)
	}
	if err := s.kv.Set(rtcdConfigKVKey, data); err != nil {
		return fmt.Errorf("failed to persist rtcd config: %w", err)
	}
	return nil
}

func (s *rtcdConfigStore) load() (rtcd.ClientConfig, bool) {
	s.mut.Lock()
	defer s.mut.Unlock()
	data, err := s.kv.Get(rtcdConfigKVKey)
	if err != nil {
		// A missing key is the normal first-boot path; anything else is worth
		// a debug line but must not block generating a fresh key.
		s.log.Debug("rtcd config load returned an error", mlog.Err(err))
		return rtcd.ClientConfig{}, false
	}
	if len(data) == 0 {
		return rtcd.ClientConfig{}, false
	}
	var cfg rtcd.ClientConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		s.log.Warn("failed to unmarshal stored rtcd config", mlog.Err(err))
		return rtcd.ClientConfig{}, false
	}
	return cfg, true
}

// newRTCDClientManager resolves the rtcd URL and stands up a client per host.
// onMessage (optional) is the inbound relay handler for messages produced by
// the rtcd hosts (see rtcd_relay.go).
func newRTCDClientManager(rtcdURL string, log mlog.LoggerIFace, kv KVStore, newClient func(rtcdURL, host string) (RTCDClient, error), onMessage func(host string, msg rtcd.ClientMessage)) (*rtcdClientManager, error) {
	m := &rtcdClientManager{
		log:       log,
		store:     kv,
		rtcdURL:   strings.TrimSuffix(rtcdURL, "/"),
		hosts:     map[string]*rtcdHost{},
		closeCh:   make(chan struct{}),
		newClient: newClient,
		onMessage: onMessage,
	}

	ips, port, err := resolveURL(rtcdURL, resolveTimeout)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve rtcd URL: %w", err)
	}
	m.rtcdPort = port

	for _, ip := range ips {
		client, err := m.newClient(rtcdURL, ip.String())
		if err != nil {
			m.closeAllHosts()
			return nil, fmt.Errorf("failed to create rtcd client for host %s: %w", ip, err)
		}
		if err := m.addHost(ip.String(), client); err != nil {
			// addHost rejected the host (e.g. duplicate): close the orphan so
			// its control connection does not leak.
			if cerr := client.Close(); cerr != nil {
				log.Debug("failed to close rejected rtcd client", mlog.String("host", ip.String()), mlog.Err(cerr))
			}
			return nil, fmt.Errorf("failed to add rtcd host: %w", err)
		}
		log.Debug("rtcd client created", mlog.String("host", ip.String()))
	}

	go m.hostsChecker()

	return m, nil
}

// hostsChecker periodically re-resolves the rtcd URL: new IPs get clients,
// disappeared IPs are flagged so they are skipped for new calls. This makes
// adding/removing rtcd instances a DNS operation.
func (m *rtcdClientManager) hostsChecker() {
	ticker := time.NewTicker(hostCheckInterval)
	defer ticker.Stop()
	for {
		select {
		case <-m.closeCh:
			return
		case <-ticker.C:
			ips, _, err := resolveURL(m.rtcdURL, resolveTimeout)
			if err != nil {
				m.log.Warn("failed to resolve rtcd URL", mlog.Err(err))
				continue
			}
			ipsMap := make(map[string]bool, len(ips))
			for _, ip := range ips {
				ipsMap[ip.String()] = true
			}

			m.mut.RLock()
			for ip, h := range m.hosts {
				if !ipsMap[ip] && !h.isFlagged() {
					m.log.Debug("flagging rtcd host", mlog.String("host", ip))
					h.setFlagged(true)
				} else if ipsMap[ip] && h.isFlagged() {
					m.log.Debug("unflagging rtcd host", mlog.String("host", ip))
					h.setFlagged(false)
				}
			}
			m.mut.RUnlock()

			for ip := range ipsMap {
				m.mut.RLock()
				_, exists := m.hosts[ip]
				m.mut.RUnlock()
				if exists {
					continue
				}
				client, err := m.newClient(m.rtcdURL, ip)
				if err != nil {
					m.log.Warn("failed to create rtcd client for new host",
						mlog.String("host", ip), mlog.Err(err))
					continue
				}
				if err := m.addHost(ip, client); err != nil {
					m.log.Warn("failed to add new rtcd host",
						mlog.String("host", ip), mlog.Err(err))
					if cerr := client.Close(); cerr != nil {
						m.log.Debug("failed to close rejected rtcd client", mlog.String("host", ip), mlog.Err(cerr))
					}
				}
			}
		}
	}
}

func (m *rtcdClientManager) addHost(ip string, client RTCDClient) error {
	m.mut.Lock()
	defer m.mut.Unlock()
	if _, ok := m.hosts[ip]; ok {
		return fmt.Errorf("host already exists: %s", ip)
	}
	m.hosts[ip] = &rtcdHost{ip: ip, client: client}
	// Pump every message this host sends back into the relay handler. The
	// goroutine exits when the client is closed (ReceiveCh is closed).
	go func() {
		for msg := range client.ReceiveCh() {
			if m.onMessage != nil {
				m.onMessage(ip, msg)
			}
		}
	}()
	return nil
}

// GetHostForNewCall returns the address of an rtcd host to assign to a new
// call. Healthy (connected, unflagged) hosts are preferred and cycled randomly
// to spread load across the SFU pool.
func (m *rtcdClientManager) GetHostForNewCall() (string, error) {
	m.mut.RLock()
	defer m.mut.RUnlock()

	healthy := make([]*rtcdHost, 0, len(m.hosts))
	for _, h := range m.hosts {
		if !h.isFlagged() && h.client.Connected() {
			healthy = append(healthy, h)
		}
	}
	if len(healthy) == 0 {
		return "", errors.New("no healthy rtcd host available")
	}
	h := healthy[rand.Intn(len(healthy))]
	return net.JoinHostPort(h.ip, m.rtcdPort), nil
}

// clientForHost returns the RTCDClient for a given host address (ip:port),
// used when sending signaling for an existing call assigned to that host.
func (m *rtcdClientManager) clientForHost(hostAddr string) (RTCDClient, error) {
	host, _, err := net.SplitHostPort(hostAddr)
	if err != nil {
		// hostAddr may be just an IP without a port.
		host = hostAddr
	}
	m.mut.RLock()
	defer m.mut.RUnlock()
	h, ok := m.hosts[host]
	if !ok {
		return nil, fmt.Errorf("rtcd host not found: %s", host)
	}
	return h.client, nil
}

// SendToHost sends a control message to the rtcd client owning a given host.
func (m *rtcdClientManager) SendToHost(host string, msg rtcd.ClientMessage) error {
	c, err := m.clientForHost(host)
	if err != nil {
		return err
	}
	return c.Send(msg)
}

// Close stops the host checker and tears down every host client. Idempotent.
func (m *rtcdClientManager) Close() error {
	var closeErr error
	m.closeOnce.Do(func() {
		close(m.closeCh)
		m.mut.Lock()
		closeErr = m.closeAllHostsLocked()
		m.mut.Unlock()
	})
	return closeErr
}

// closeAllHosts closes every host client WITHOUT taking the manager lock;
// callers must already hold m.mut (or guarantee exclusive access, as the
// constructor's failure path does before any goroutine exists).
func (m *rtcdClientManager) closeAllHosts() error {
	return m.closeAllHostsLocked()
}

func (m *rtcdClientManager) closeAllHostsLocked() error {
	var firstErr error
	for _, h := range m.hosts {
		if h.client != nil {
			if err := h.client.Close(); err != nil && firstErr == nil {
				firstErr = err
			}
		}
	}
	m.hosts = map[string]*rtcdHost{}
	return firstErr
}

// resolveClientConfig resolves the rtcd ClientConfig (ClientID + AuthKey) using
// the same precedence as the plugin: env vars -> embedded URL credentials ->
// diagnostic/clientID fallback -> KV-stored key -> newly generated key.
func (m *rtcdClientManager) resolveClientConfig(rtcdURL, clientIDFallback string) (rtcd.ClientConfig, error) {
	cfg := rtcd.ClientConfig{
		// Jitter to avoid many clients authenticating in lockstep.
		ReconnectInterval: time.Duration(rand.Intn(baseReconnectIntervalMs)) * time.Millisecond,
	}

	cfg.ClientID = os.Getenv("MM_CALLS_RTCD_CLIENT_ID")
	cfg.AuthKey = os.Getenv("MM_CALLS_RTCD_AUTH_KEY")
	cfg.URL = strings.TrimSuffix(rtcdURL, "/")

	// Embedded credentials in the URL (user:pass@host) take effect only when
	// env vars are unset.
	u, embeddedClientID, embeddedAuthKey, err := parseURL(cfg.URL)
	if err != nil {
		return cfg, fmt.Errorf("failed to parse rtcd URL: %w", err)
	}
	if cfg.ClientID == "" && cfg.AuthKey == "" {
		cfg.ClientID = embeddedClientID
		cfg.AuthKey = embeddedAuthKey
	}
	cfg.URL = u

	if cfg.URL == "" {
		return cfg, errors.New("rtcd URL is missing")
	}

	if cfg.ClientID == "" {
		cfg.ClientID = clientIDFallback
	}
	if cfg.ClientID == "" {
		return cfg, errors.New("rtcd client id is missing")
	}

	cfgStore := &rtcdConfigStore{kv: m.store, log: m.log}
	if cfg.AuthKey == "" {
		if stored, ok := cfgStore.load(); ok {
			cfg.AuthKey = stored.AuthKey
		}
	}
	if cfg.AuthKey == "" {
		key, err := random.NewSecureString(32)
		if err != nil {
			return cfg, fmt.Errorf("failed to generate rtcd auth key: %w", err)
		}
		cfg.AuthKey = key
		if err := cfgStore.store(cfg); err != nil {
			m.log.Warn("failed to persist rtcd config", mlog.Err(err))
		}
	}

	return cfg, nil
}

// parseURL extracts credentials embedded as user:pass@host and returns the
// sanitized URL (credentials stripped).
func parseURL(rawURL string) (string, string, string, error) {
	if rawURL == "" {
		return "", "", "", nil
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", "", "", err
	}
	clientID := ""
	authKey := ""
	if u.User != nil {
		clientID = u.User.Username()
		authKey, _ = u.User.Password()
		u.User = nil
	}
	return u.String(), clientID, authKey, nil
}

// resolveURL resolves a URL to its A records and returns the IPs and the port.
// This allows multiple rtcd instances to hide behind one DNS name.
func resolveURL(rawURL string, timeout time.Duration) ([]net.IP, string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse URL %q: %w", rawURL, err)
	}

	host := u.Hostname()
	port := u.Port()
	if port == "" {
		if u.Scheme == "https" || u.Scheme == "wss" {
			port = "443"
		} else {
			port = "80"
		}
	}

	ips, err := net.DefaultResolver.LookupIP(ctx, "ip4", host)
	if err != nil {
		return nil, "", fmt.Errorf("failed to resolve host %q: %w", host, err)
	}
	if len(ips) == 0 {
		return nil, "", fmt.Errorf("no IPs resolved for host %q", host)
	}
	return ips, port, nil
}

// rtcEnvelope is a typed helper constructing the rtc control envelope the SFU
// expects for a given signal type from a session.
func rtcEnvelope(sessionID, callID, userID string, msgType rtc.MessageType, data []byte) rtcd.ClientMessage {
	return rtcd.ClientMessage{
		Type: rtcd.ClientMessageRTC,
		Data: rtc.Message{
			GroupID:   "default",
			UserID:    userID,
			SessionID: sessionID,
			CallID:    callID,
			Type:      msgType,
			Data:      data,
		},
	}
}
