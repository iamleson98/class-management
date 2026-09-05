// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/iamleson98/sitename/server/public/shared/mlog"

	rtcd "github.com/mattermost/rtcd/service"
)

// rtcdClientAdapter wraps a real rtcd/service.Client and adapts it to the
// RTCDClient interface used by the rtcdClientManager. It owns the full SFU
// control lifecycle: Register (self-registration with HMAC credentials),
// Connect (the persistent control WebSocket), Send (signaling + control
// messages), and Receive (VAD/SDP/ICE/close messages back from the SFU).
//
// One adapter corresponds to one rtcd host IP. Many call sessions are
// multiplexed over its single WebSocket connection and demultiplexed on
// receive by rtc.Message.SessionID.
//
// Self-healing: the vendored service.Client retries its WebSocket forever but
// NEVER re-registers. When rtcd is recreated with a fresh auth store (new
// volume, redeploy) the credentials the server holds become invalid and the
// reconnect loop fails authentication for the life of the process — which
// surfaces to users as "no healthy rtcd host available" on every call. The
// adapter therefore (a) re-registers best-effort before each reconnect
// attempt (WithClientReconnectCb) and (b) exposes Heal() to force a full
// rebuild (close + register + connect) when the control socket is found dead.
// A rebuild swaps the internal client, so the adapter exposes STABLE bridge
// channels (pumped from whichever internal client is live) — the manager's
// consumer goroutine survives rebuilds.
type rtcdClientAdapter struct {
	cfg    rtcd.ClientConfig
	dialFn rtcd.DialContextFn
	log    mlog.LoggerIFace

	mut    sync.RWMutex
	client *rtcd.Client

	// Stable channels bridged from the live internal client.
	outCh     chan rtcd.ClientMessage
	errCh     chan error
	closeOnce sync.Once

	// lastHealAt throttles Heal rebuilds (guards against join storms
	// rebuilding a merely-reconnecting client in a tight loop).
	lastHealAt time.Time
}

// newRTCDClientAdapter builds (but does not connect) an adapter for a host.
// The dialFn pins outbound connections to the specific host IP resolved by the
// manager, so each adapter targets exactly one rtcd backend even though the
// configured rtcd URL may resolve to several.
func newRTCDClientAdapter(cfg rtcd.ClientConfig, dialFn rtcd.DialContextFn, log mlog.LoggerIFace) (*rtcdClientAdapter, error) {
	return &rtcdClientAdapter{
		cfg:    cfg,
		dialFn: dialFn,
		log:    log,
		outCh:  make(chan rtcd.ClientMessage, 64),
		errCh:  make(chan error, 32),
	}, nil
}

// Connect brings up the control WebSocket. It tries Connect() first (another
// node may have already registered for this ClientID); on failure it registers
// and stores credentials, then connects again — exactly the plugin's sequence.
// "Already registered" is NOT fatal: the initial failure may have been
// transient and the stored key may still be valid.
func (a *rtcdClientAdapter) Connect() error {
	_, err := a.connectInternal(false)
	return err
}

// connectInternal creates the internal client (registering when the first
// connect fails) and starts its bridge pumps. force closes and replaces any
// existing internal client first. Returns whether the client ended up
// connected.
func (a *rtcdClientAdapter) connectInternal(force bool) (bool, error) {
	a.mut.Lock()
	defer a.mut.Unlock()

	if a.client != nil && !force {
		return a.client.Connected(), nil
	}
	if a.client != nil {
		// Replace a dead/wedged client: closing it also closes ITS receive
		// channels, which stops its bridge pumps.
		if err := a.client.Close(); err != nil {
			a.log.Debug("calls: error closing rtcd client before rebuild", mlog.Err(err))
		}
		a.client = nil
	}

	client, err := rtcd.NewClient(a.cfg,
		rtcd.WithDialFunc(a.dialFn),
		rtcd.WithClientReconnectCb(a.reconnectCallback),
	)
	if err != nil {
		return false, fmt.Errorf("rtcd: failed to create client: %w", err)
	}

	// Try to connect with existing (possibly stored) credentials first.
	if err := client.Connect(); err != nil {
		a.log.Debug("rtcd connect with existing creds failed, registering", mlog.Err(err))

		if regErr := client.Register(a.cfg.ClientID, a.cfg.AuthKey); regErr != nil {
			// "already registered" is benign: another server (or this one,
			// before a restart) holds the registration and the key may still
			// be valid. Everything else (rtcd unreachable, key rejected)
			// still gets one more Connect attempt below before failing.
			if !isAlreadyRegisteredErr(regErr) {
				a.log.Debug("rtcd client registration failed", mlog.Err(regErr))
			}
		}

		if err := client.Connect(); err != nil {
			client.Close()
			return false, fmt.Errorf("rtcd: failed to connect after register: %w", err)
		}
	}

	a.client = client
	a.pump(client)
	return true, nil
}

// reconnectCallback runs before EVERY internal WebSocket reconnect attempt
// (including the ones started by the vendored client's own retry loop). It
// re-registers best-effort so an rtcd instance that lost its auth store
// (recreated volume) accepts us again — otherwise the loop would fail
// authentication forever. All failures are swallowed: reconnecting is still
// the right move when rtcd is merely down.
func (a *rtcdClientAdapter) reconnectCallback(c *rtcd.Client, _ int) error {
	if err := c.Register(a.cfg.ClientID, a.cfg.AuthKey); err != nil && !isAlreadyRegisteredErr(err) {
		// Unreachable / rejected: log at debug — the reconnect attempt that
		// follows will surface connectivity problems through ErrorCh anyway.
		a.log.Debug("calls: rtcd re-registration during reconnect failed", mlog.Err(err))
	}
	return nil
}

// isAlreadyRegisteredErr matches rtcd's "registration failed: already
// registered" sentinel string (the vendored service does not export it as an
// error value).
func isAlreadyRegisteredErr(err error) bool {
	return err != nil && strings.Contains(err.Error(), "already registered")
}

// pump bridges one internal client's channels into the adapter's stable
// channels. Both pumps exit when the internal client is closed (its channels
// close); dropped messages mean rtcd restarted mid-flight and the queue was
// stale anyway.
func (a *rtcdClientAdapter) pump(c *rtcd.Client) {
	go func() {
		for msg := range c.ReceiveCh() {
			select {
			case a.outCh <- msg:
			default:
				a.log.Warn("calls: rtcd message dropped (bridge full)")
			}
		}
	}()
	go func() {
		for err := range c.ErrorCh() {
			select {
			case a.errCh <- err:
			default:
				// Keep reconnect diagnostics lossless-but-quiet.
				a.log.Debug("calls: rtcd client error", mlog.Err(err))
			}
		}
	}()
}

// Connected reports whether the underlying client is live.
func (a *rtcdClientAdapter) Connected() bool {
	a.mut.RLock()
	defer a.mut.RUnlock()
	return a.client != nil && a.client.Connected()
}

// Heal force-rebuilds the control connection when it is dead. Returns whether
// the adapter is connected afterwards. Throttled to one rebuild per
// healThrottle: a reconnecting client (the vendored retry loop) must not be
// torn down on every join attempt, but a truly dead one IS rebuilt so the next
// call proceeds instead of failing with "no healthy rtcd host".
func (a *rtcdClientAdapter) Heal() bool {
	if a.Connected() {
		return true
	}
	a.mut.Lock()
	if time.Since(a.lastHealAt) < healThrottle {
		throttled := a.client != nil && a.client.Connected()
		a.mut.Unlock()
		return throttled
	}
	a.lastHealAt = time.Now()
	a.mut.Unlock()

	connected, err := a.connectInternal(true)
	if err != nil {
		a.log.Warn("calls: rtcd host heal failed", mlog.Err(err))
	}
	return connected
}

// healThrottle limits forced rebuilds of one adapter.
const healThrottle = 5 * time.Second

// clientOrConnect returns the live client, connecting on demand if needed.
func (a *rtcdClientAdapter) clientOrConnect() (*rtcd.Client, error) {
	a.mut.RLock()
	c := a.client
	a.mut.RUnlock()
	if c != nil && c.Connected() {
		return c, nil
	}
	if err := a.Connect(); err != nil {
		return nil, err
	}
	a.mut.RLock()
	defer a.mut.RUnlock()
	// Connect succeeded but Close() may have run concurrently; never hand out
	// a nil client to a caller that would dereference it.
	if a.client == nil {
		return nil, errors.New("rtcd: client closed during connect")
	}
	return a.client, nil
}

// Send forwards a control/signaling message to rtcd for this host.
func (a *rtcdClientAdapter) Send(msg rtcd.ClientMessage) error {
	c, err := a.clientOrConnect()
	if err != nil {
		return err
	}
	return c.Send(msg)
}

// ReceiveCh returns the stable inbound message channel from rtcd (SDP/ICE
// answers, VAD events, close notifications). The channel survives internal
// client rebuilds.
func (a *rtcdClientAdapter) ReceiveCh() <-chan rtcd.ClientMessage {
	return a.outCh
}

// ErrorCh returns stable async client errors (e.g. reconnect failures).
func (a *rtcdClientAdapter) ErrorCh() <-chan error {
	return a.errCh
}

// Close permanently tears down the control connection and the bridges.
func (a *rtcdClientAdapter) Close() error {
	a.mut.Lock()
	if a.client == nil {
		a.mut.Unlock()
		a.closeBridges()
		return nil
	}
	err := a.client.Close()
	a.client = nil
	a.mut.Unlock()
	a.closeBridges()
	return err
}

func (a *rtcdClientAdapter) closeBridges() {
	a.closeOnce.Do(func() {
		close(a.outCh)
		close(a.errCh)
	})
}

// dialFuncForHost builds a DialContextFn that pins TCP connections to a
// specific rtcd host IP:port. This lets one adapter target one backend out of
// a DNS-resolved pool. Mirrors the plugin's getDialFn.
func dialFuncForHost(host, port string) rtcd.DialContextFn {
	addr := net.JoinHostPort(host, port)
	return func(ctx context.Context, network, _ string) (net.Conn, error) {
		d := net.Dialer{Timeout: dialingTimeout, KeepAlive: 30 * time.Second}
		return d.DialContext(ctx, network, addr)
	}
}
