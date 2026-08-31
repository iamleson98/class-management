/**
 * Chat client singletons — thin wrappers over the vendored Mattermost
 * Client4 (REST) + WebSocketClient (real-time), reused verbatim for best
 * compatibility with the server's protocol.
 *
 * Auth is identical to the rest of lms-fe: the httpOnly MMAUTHTOKEN cookie.
 * Client4 uses `credentials: 'include'` + reads the MMCSRF cookie for mutating
 * requests; the WebSocket handshake relies on the cookie too (initialize is
 * called with token = undefined, so no authentication_challenge is sent).
 *
 * Same-origin is required for this to work — enforced in prod by the Traefik
 * path rule (app.<domain>/api/v4/* → backend) and in dev by the Caddy proxy.
 * Both make /api/v4/* first-party so the cookie rides REST and WS alike.
 *
 * Browser-only: Client4.setUrl uses window.location.origin, and
 * WebSocketClient instantiates `new WebSocket(...)`. Never import this module
 * from a Server Component — only from client components / effects.
 */

import { Client4, WebSocketClient } from '@mattermost/client'

/**
 * Single shared Client4. Base URL is the current origin (same-origin proxy).
 * setUrl('') makes getBaseRoute() return '/api/v4/...' relative to the page,
 * which is exactly what the Next rewrite / Traefik path rule serves.
 */
export const client4 = new Client4()

let configured = false

/** Configure Client4 with the current origin. Safe to call repeatedly. */
export function configureClient4(): void {
  if (configured || typeof window === 'undefined') return
  // Empty string => relative base, resolved against window.location.origin.
  // The proxy/Traefik rule routes /api/v4/* to the backend same-origin.
  client4.setUrl('')
  configured = true
}

/** Single shared WebSocket client (mirrors the old webapp's singleton). */
export const wsClient = new WebSocketClient()

let wsInitialized = false

/**
 * Resolve the backend origin for the WebSocket connection.
 *
 * NEXT_PUBLIC_API_URL semantics (baked at build time by lms-fe/Dockerfile):
 *   - "/"        → same-origin production image (DEFAULT): the frontend's own
 *                  server (run-server.js) reverse-proxies /api/v4 — REST and
 *                  the WebSocket UPGRADE alike — to LMS_BACKEND_URL at
 *                  runtime. One origin for everything, on any domain, against
 *                  any backend; the httpOnly MMAUTHTOKEN cookie stays
 *                  first-party for both REST and the WS handshake.
 *   - unset      → dev default http://localhost:8065 (cookies are
 *                  port-agnostic, so the WS from localhost:3001 carries it).
 *   - full URL   → legacy direct mode: REST rides the Next rewrite, but the
 *                  WS goes cross-origin and then requires server CORS +
 *                  token auth (not configured by default). Prefer the
 *                  same-origin sentinel + LMS_BACKEND_URL instead.
 */
export function resolveBackendOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL
  if (configured === '/') {
    return typeof window !== 'undefined' ? window.location.origin : ''
  }
  return configured || 'http://localhost:8065'
}

/**
 * Open the WebSocket connection.
 *
 * Connects to the backend on the origin resolved by resolveBackendOrigin().
 * In dev that is localhost:8065 because the httpOnly MMAUTHTOKEN cookie is
 * host-only to "localhost" and cookies are port-agnostic (RFC 6265 §5.1.4) —
 * so a WS to localhost:8065 from a page on localhost:3001 DOES carry the
 * cookie. In production the origin is same-origin (NEXT_PUBLIC_API_URL="/"
 * baked into the image): run-server.js proxies the /api/v4/websocket upgrade
 * to the backend, so the cookie model is identical whether the backend runs
 * next to the frontend (Swarm overlay) or far away (separated deployment).
 * The backend's AllowCorsFrom includes the frontend origin as defense in
 * depth, but no credentialed cross-origin request is needed.
 *
 * Do not switch this to a relative URL — the Next.js server itself cannot
 * register a WS client route; the absolute URL points either at the same
 * origin (proxied upgrade) or the dev backend. The URL must be absolute
 * (ws:// or wss://).
 *
 * Idempotent; safe to call again after a disconnect (reconnect is handled
 * internally by WebSocketClient).
 *
 * Registers no listeners itself — callers add their own via
 * wsClient.addMessageListener / addReconnectListener / etc.
 */
export function connectWebSocket(): void {
  if (typeof window === 'undefined' || wsInitialized) return
  configureClient4()

  const backendUrl = resolveBackendOrigin()
  const wsOrigin = backendUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  const connUrl = `${wsOrigin}/api/v4/websocket`

  // token = undefined  → cookie auth (no authentication_challenge sent).
  // postedAck = true   → server acks posted events for reliable delivery.
  wsClient.initialize(connUrl, undefined, true)
  wsInitialized = true
}

/** Tear down the WebSocket connection and reset so it can reconnect later. */
export function disconnectWebSocket(): void {
  if (!wsInitialized) return
  try {
    wsClient.close()
  } catch {
    // ignore — close can throw if already closing
  }
  wsInitialized = false
}
