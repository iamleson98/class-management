// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"context"
	"errors"
	"fmt"
	"net"
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
type rtcdClientAdapter struct {
	cfg    rtcd.ClientConfig
	dialFn rtcd.DialContextFn
	log    mlog.LoggerIFace

	mut    sync.RWMutex
	client *rtcd.Client
}

// newRTCDClientAdapter builds (but does not connect) an adapter for a host.
// The dialFn pins outbound connections to the specific host IP resolved by the
// manager, so each adapter targets exactly one rtcd backend even though the
// configured rtcd URL may resolve to several.
func newRTCDClientAdapter(cfg rtcd.ClientConfig, dialFn rtcd.DialContextFn, log mlog.LoggerIFace) (*rtcdClientAdapter, error) {
	return &rtcdClientAdapter{cfg: cfg, dialFn: dialFn, log: log}, nil
}

// Connect brings up the control WebSocket. It tries Connect() first (another
// node may have already registered for this ClientID); on failure it registers
// and stores credentials, then connects again — exactly the plugin's sequence.
func (a *rtcdClientAdapter) Connect() error {
	a.mut.Lock()
	defer a.mut.Unlock()

	if a.client != nil {
		return nil
	}

	client, err := rtcd.NewClient(a.cfg, rtcd.WithDialFunc(a.dialFn))
	if err != nil {
		return fmt.Errorf("rtcd: failed to create client: %w", err)
	}

	// Try to connect with existing (possibly stored) credentials first.
	if err := client.Connect(); err != nil {
		a.log.Debug("rtcd connect with existing creds failed, registering", mlog.Err(err))

		if regErr := client.Register(a.cfg.ClientID, a.cfg.AuthKey); regErr != nil {
			client.Close()
			return fmt.Errorf("rtcd: failed to register client: %w", regErr)
		}

		if err := client.Connect(); err != nil {
			client.Close()
			return fmt.Errorf("rtcd: failed to connect after register: %w", err)
		}
	}

	a.client = client
	return nil
}

// Connected reports whether the underlying client is live.
func (a *rtcdClientAdapter) Connected() bool {
	a.mut.RLock()
	defer a.mut.RUnlock()
	return a.client != nil && a.client.Connected()
}

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

// ReceiveCh returns the inbound message channel from rtcd (SDP/ICE answers,
// VAD events, close notifications).
func (a *rtcdClientAdapter) ReceiveCh() <-chan rtcd.ClientMessage {
	a.mut.RLock()
	defer a.mut.RUnlock()
	if a.client == nil {
		return nil
	}
	return a.client.ReceiveCh()
}

// ErrorCh returns async client errors (e.g. terminal reconnect failure).
func (a *rtcdClientAdapter) ErrorCh() <-chan error {
	a.mut.RLock()
	defer a.mut.RUnlock()
	if a.client == nil {
		return nil
	}
	return a.client.ErrorCh()
}

// Close permanently tears down the control connection.
func (a *rtcdClientAdapter) Close() error {
	a.mut.Lock()
	defer a.mut.Unlock()
	if a.client == nil {
		return nil
	}
	err := a.client.Close()
	a.client = nil
	return err
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
