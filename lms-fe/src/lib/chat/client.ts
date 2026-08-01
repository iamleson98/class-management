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
 * Open the WebSocket connection. Derives the ws(s) URL from the page origin
 * and initializes with token = undefined so the cookie authenticates.
 * Idempotent; safe to call again after a disconnect (reconnect is handled
 * internally by WebSocketClient).
 *
 * Registers no listeners itself — callers add their own via
 * wsClient.addMessageListener / addReconnectListener / etc.
 */
export function connectWebSocket(): void {
  if (typeof window === 'undefined' || wsInitialized) return
  configureClient4()

  // Connect directly to backend for WebSocket (Next.js rewrites don't handle WebSocket upgrades)
  // CORS is configured on the backend to allow connections from the frontend
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8065'
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
