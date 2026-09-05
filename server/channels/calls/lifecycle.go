// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
	"errors"
	"time"

	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/public/shared/mlog"
)

// Teardown sources beyond the explicit leave/host-remove/SFU-close ones.
const reasonWSClosed = "ws_closed"

// Defaults for the lifecycle watchdogs. Both are overridable (shrink) in
// tests via the service's config accessors below.
const (
	// wsDisconnectGrace bounds how long a session survives its websocket
	// dying. The browser reconnects within seconds and re-points the session
	// (custom_calls_reconnect); the grace keeps a transient blip from ending
	// a live participation.
	wsDisconnectGrace = 15 * time.Second

	// reapInterval is the idle-call reaper cadence: the backstop that ends
	// calls whose teardown paths never fired (a websocket that died before
	// the SFU ever registered the session leaves no close callback).
	reapInterval = 60 * time.Second
)

// HandleWSDisconnect reacts to a browser websocket connection dying. It is
// the native equivalent of the plugin OnWebSocketDisconnect hook and is
// registered by the app layer (app/server.go) with the platform.
//
// The session is torn down after a grace window, not immediately: the browser
// re-establishes its websocket and sends custom_calls_reconnect, which
// re-points the session at the new connection — the deferred teardown then
// finds nothing and no-ops. If the user really is gone (tab closed, network
// dropped), the teardown closes the SFU leg, persists the leave boundary, and
// — when they were the last participant — ends the call, freeing its
// resources.
func (s *CallService) HandleWSDisconnect(connID, userID string) {
	if connID == "" {
		return
	}
	cs := s.index.byConnID(connID)
	if cs == nil {
		return
	}
	sess, ok := cs.findByConn(connID)
	if !ok {
		return
	}

	time.AfterFunc(s.disconnectGrace(), func() {
		// Re-resolve under the CURRENT state: a reconnect re-pointed the
		// session (the old connID no longer maps), or a teardown already
		// removed it — either way the timer is a no-op. Only a session still
		// bound to the dead connection is torn down.
		cur, ok := cs.findByConn(connID)
		if !ok || cur != sess || cs.ended() {
			return
		}
		s.teardownSession(cs, sess, reasonWSClosed)
	})
}

// reapIdleCalls ends calls with no participants left — the backstop for
// teardown paths that never fired. A live call always has at least one
// session (the last leave ends it), so an empty registry entry means state
// leaked: a websocket died before the SFU registered the session, or an rtcd
// close was lost. The reaper bounds that leak to one interval.
func (s *CallService) reapIdleCalls() {
	for _, cs := range s.shards.all() {
		if cs.ended() || cs.participants() > 0 {
			continue
		}
		if err := s.endCallState(cs, model.GetMillis()); err != nil && !errors.Is(err, ErrCallEnded) {
			s.log.Warn("calls: idle-call reaper failed to end call",
				mlog.String("callID", cs.callID), mlog.Err(err))
		} else {
			s.log.Info("calls: idle-call reaper ended participant-less call",
				mlog.String("callID", cs.callID))
		}
	}
}

// reapLoop runs the idle-call reaper until stop closes. Started by Start(),
// stopped by Stop().
func (s *CallService) reapLoop(stop <-chan struct{}) {
	ticker := time.NewTicker(s.reapTick())
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			s.reapIdleCalls()
		}
	}
}

// disconnectGrace snapshots the ws-disconnect grace window, applying the
// default when unset (tests shrink it). See rtcdInitBounds for the locking
// rationale: goroutines read bounds at start while tests mutate them.
func (s *CallService) disconnectGrace() time.Duration {
	s.mut.Lock()
	defer s.mut.Unlock()
	if s.disconnectGraceDur == 0 {
		s.disconnectGraceDur = wsDisconnectGrace
	}
	return s.disconnectGraceDur
}

// reapTick snapshots the reaper cadence, applying the default when unset
// (tests shrink it).
func (s *CallService) reapTick() time.Duration {
	s.mut.Lock()
	defer s.mut.Unlock()
	if s.reapTickDur == 0 {
		s.reapTickDur = reapInterval
	}
	return s.reapTickDur
}
