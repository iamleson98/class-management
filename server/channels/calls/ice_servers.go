// Copyright (c) 2024-present. All Rights Reserved.
// See LICENSE.txt for license information.

package calls

import (
        "net/url"
        "strings"

        "github.com/iamleson98/sitename/server/public/shared/mlog"
)

// iceServers parses CallsSettings.ICEServers (comma-separated ICE URLs) into
// the RTCIceServer-shaped objects delivered to browsers in the join ack and
// the client config.
//
// Each entry is a full ICE URL:
//
//      stun:stun.example.net:3478
//      turn:turn.example.net:3478?transport=udp
//      turn:username:password@turn.example.net:3478?transport=tcp
//      turns:username:password@turn.example.net:5349?transport=tcp   (TURN over TLS)
//
// Credentials are embedded as URL userinfo (RFC 7065) and split into the
// username/credential fields the browser expects. Entries with an invalid
// scheme or shape are skipped (debug-logged with credentials redacted).
//
// An EMPTY list is the correct default when nothing is configured: rtcd runs
// on a public IP and publishes host candidates, which browsers reach with
// their own host candidates — no STUN/TURN is needed for the
// client-to-public-SFU path. STUN only matters when administrators want
// reflexive candidates, and TURN matters for clients behind firewalls that
// block both UDP and direct TCP to non-443 ports (deploy coturn and list it
// here — see DEPLOY.md, "Calls in production").
func (s *CallService) iceServers() []map[string]any {
        cfg := s.callsConfig()
        if cfg.ICEServers == nil || *cfg.ICEServers == "" {
                return nil
        }
        var out []map[string]any
        for _, entry := range strings.Split(*cfg.ICEServers, ",") {
                entry = strings.TrimSpace(entry)
                if entry == "" {
                        continue
                }
                server, valid := parseICEServer(entry)
                if !valid {
                        s.log.Debug("calls: skipping invalid ICE server entry",
                                mlog.String("entry", redactICEEntry(entry)))
                        continue
                }
                out = append(out, server)
        }
        return out
}

// parseICEServer converts one ICE URL into the wire shape used by the join
// ack: {"urls": [url], "username": ..., "credential": ...}. The userinfo
// (turn:user:pass@host) is stripped from the returned URL and moved into the
// username/credential fields — the canonical form every browser accepts.
// transport= query parameters are preserved in the URL.
func parseICEServer(entry string) (map[string]any, bool) {
        u, err := url.Parse(entry)
        if err != nil {
                return nil, false
        }
        switch u.Scheme {
        case "stun", "turn", "turns":
        default:
                return nil, false
        }

        // ICE URLs are opaque (scheme:host[:port][?transport=...]); a "//" form
        // means the entry is not an ICE URL.
        rest := u.Opaque
        if rest == "" {
                return nil, false
        }

        // Split optional userinfo (RFC 7065): user:pass@host:port. The split is
        // at the LAST '@' so usernames containing ':' stay intact.
        userinfo := ""
        if i := strings.LastIndex(rest, "@"); i != -1 {
                userinfo = rest[:i]
                rest = rest[i+1:]
        }
        if rest == "" {
                return nil, false
        }

        // Rebuild the URL without the userinfo, preserving any query string
        // (e.g. ?transport=tcp, which selects the TURN transport).
        final := u.Scheme + ":" + rest
        if u.ForceQuery || u.RawQuery != "" {
                final += "?" + u.RawQuery
        }

        server := map[string]any{"urls": []string{final}}
        if userinfo != "" {
                user, pass, found := strings.Cut(userinfo, ":")
                if !found || user == "" || pass == "" {
                        return nil, false
                }
                server["username"] = user
                server["credential"] = pass
        }
        return server, true
}

// redactICEEntry masks the password of an ICE URL userinfo before logging.
func redactICEEntry(entry string) string {
        scheme, rest, found := strings.Cut(entry, ":")
        if !found {
                return entry
        }
        if i := strings.LastIndex(rest, "@"); i != -1 {
                if _, _, hasPass := strings.Cut(rest[:i], ":"); hasPass {
                        return scheme + ":***:***@" + rest[i+1:]
                }
                return scheme + ":***@" + rest[i+1:]
        }
        return entry
}
