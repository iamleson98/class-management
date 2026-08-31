/**
 * api-proxy.js — runtime reverse proxy for /api/v4 (REST + WebSocket).
 *
 * Used by run-server.js so the LMS frontend can be deployed separately from
 * the backend while the browser still sees ONE origin:
 *
 *   browser ── same-origin ──▶ frontend server ──┬─ /api/v4/*  ──▶ backend
 *                                                └─ everything ──▶ Next.js
 *
 * Why this exists
 * ===============
 * Auth is the httpOnly MMAUTHTOKEN cookie. Next.js rewrites can proxy REST
 * but CANNOT proxy WebSocket upgrades, so a "frontend on its own host"
 * deployment previously had no viable WS path: a direct cross-origin WS to
 * the backend drops the (first-party) cookie and needs CORS + token auth.
 * Proxying the WS upgrade here keeps REST, WS and the cookie ALL first-party
 * to the frontend origin — the exact same auth model as the single-domain
 * Swarm deployment, with zero server-side CORS/token changes.
 *
 * The upstream target is provided at RUNTIME (LMS_BACKEND_URL), so one image
 * works on any domain against any backend without rebuilds.
 *
 * Implementation notes
 * ====================
 * - REST  : http.request with streaming pipes (uploads/downloads stream;
 *           hop-by-hop headers stripped; X-Forwarded-For/Proto maintained;
 *           the original Host is preserved so the backend's same-origin
 *           checks still see the public host).
 * - WS    : the upgrade is relayed over a raw TCP/TLS socket pair — the
 *           original request (including Connection/Upgrade/Sec-WebSocket-*
 *           headers, cookies and the client's Host) is serialized verbatim,
 *           then the two sockets are piped bidirectionally. Raw sockets are
 *           used (instead of http.request's 'upgrade' event) for
 *           deterministic behavior on every runtime (Node.js and Bun).
 * - Errors: upstream connect failures surface as HTTP 502 (REST) or a plain
 *           502 response + socket destroy (WS); the browser's WS client
 *           retries with backoff, matching Mattermost's reconnect behavior.
 *
 * Runs on Node.js — the container runtime (see lms-fe/Dockerfile). Only
 * node:http, node:net and node:tls primitives are used, no dependencies.
 *
 * NOTE on Bun: Bun's node:http compatibility does not currently support the
 * server 'upgrade' hijack (writes to the hijacked socket and post-handshake
 * reads never reach the client — verified empirically against Bun 1.3.14).
 * run-server.js therefore refuses to start the proxy under Bun; use the Node
 * runtime for production (bun remains the install/build tool).
 */
'use strict'

const net = require('net')
const tls = require('tls')

// Hop-by-hop headers (RFC 7230 §6.1) — never forwarded on the REST leg.
const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]

function parseBackendURL(raw) {
  let u
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const secure = u.protocol === 'https:'
  return {
    secure,
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : secure ? 443 : 80,
    // A backend URL may carry a base path; keep it as a prefix.
    basePath: u.pathname.replace(/\/+$/, ''),
  }
}

/** Append our hop to X-Forwarded-For / set X-Forwarded-Proto on a header object. */
function addForwardingHeaders(headers, socket) {
  const ip = socket && socket.remoteAddress ? socket.remoteAddress : ''
  const existing = headers['x-forwarded-for']
  headers['x-forwarded-for'] = ip ? (existing ? `${existing}, ${ip}` : ip) : existing
  if (!headers['x-forwarded-proto']) {
    headers['x-forwarded-proto'] = socket && socket.encrypted ? 'https' : 'http'
  }
}

/**
 * Build the proxy. `rawURL` is LMS_BACKEND_URL (http:// or https://).
 * Returns { request(req,res), upgrade(req,socket,head), close(), target }.
 * Throws on an invalid URL — the caller should fail fast (bad config).
 */
function createBackendProxy(rawURL, log) {
  const target = parseBackendURL(rawURL)
  if (!target) {
    throw new Error(`invalid LMS_BACKEND_URL "${rawURL}" (expected http(s)://host[:port])`)
  }

  const httpLib = target.secure ? require('https') : require('http')
  const agent = new httpLib.Agent({
    keepAlive: true,
    keepAliveMsecs: 30_000,
    maxSockets: 128,
    maxFreeSockets: 16,
  })

  // Upgraded (hijacked) client sockets — destroyed on graceful shutdown.
  const upgradedSockets = new Set()

  const targetPath = (url) => target.basePath + url

  /** REST: stream proxy with hop-by-hop hygiene. */
  function request(req, res) {
    const headers = { ...req.headers }
    for (const h of HOP_BY_HOP) delete headers[h]
    // Content-Length is preserved (exact bodies); without it the runtime
    // re-chunks automatically.
    delete headers['transfer-encoding']
    addForwardingHeaders(headers, req.socket)

    const upstream = httpLib.request(
      {
        host: target.host,
        port: target.port,
        method: req.method,
        path: targetPath(req.url),
        headers,
        agent,
      },
      (upstreamRes) => {
        const outHeaders = { ...upstreamRes.headers }
        for (const h of HOP_BY_HOP) delete outHeaders[h]
        delete outHeaders['transfer-encoding']
        res.writeHead(upstreamRes.statusCode, outHeaders)
        upstreamRes.pipe(res)
      },
    )

    upstream.on('error', (err) => {
      if (res.writableEnded) return
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            id: 'proxy.bad_gateway',
            message: `frontend could not reach the backend (${target.host}:${target.port}): ${err.message}`,
          }),
        )
      } else {
        res.destroy()
      }
    })

    // Client went away mid-request (abort / connection reset).
    res.on('close', () => {
      if (!res.writableEnded) upstream.destroy()
    })

    req.pipe(upstream)
  }

  /**
   * WebSocket: relay the upgrade over a raw TCP/TLS socket pair.
   * The request is serialized verbatim (Connection, Upgrade, Sec-WebSocket-*,
   * Host, Cookie stay untouched) so the backend performs the real handshake
   * and the 101 + frames flow byte-for-byte in both directions.
   */
  function upgrade(req, socket, head) {
    const headers = { ...req.headers }
    delete headers['proxy-connection']
    addForwardingHeaders(headers, socket)

    const connectOpts = { host: target.host, port: target.port }
    const upstream = target.secure
      ? tls.connect({ ...connectOpts, servername: target.host })
      : net.connect(connectOpts)

    let failed = false
    const fail = (reason) => {
      if (failed) return
      failed = true
      // A plain HTTP 502 on the raw socket lets the browser's WS client fail
      // fast (it re-runs its own reconnect backoff).
      if (socket.writable) {
        socket.write(
          'HTTP/1.1 502 Bad Gateway\r\n' +
            'Content-Type: text/plain\r\n' +
            'Connection: close\r\n' +
            `\r\nfrontend could not reach the backend (${reason})\n`,
        )
      }
      socket.destroy()
      upstream.destroy()
    }

    // Handshake timeout — only until the backend's 101 arrives.
    upstream.setTimeout(15_000, () => fail('handshake timeout'))
    upstream.on('error', (err) => fail(err.message))

    // Either side closing tears down the pair.
    socket.on('error', () => upstream.destroy())
    upstream.on('close', () => {
      upgradedSockets.delete(socket)
      socket.destroy()
    })
    socket.on('close', () => {
      upgradedSockets.delete(socket)
      upstream.destroy()
    })
    upgradedSockets.add(socket)

    upstream.on('connect', () => {
      let raw = `${req.method} ${targetPath(req.url)} HTTP/1.1\r\n`
      for (const [key, value] of Object.entries(headers)) {
        if (value === undefined) continue
        if (Array.isArray(value)) {
          for (const v of value) raw += `${key}: ${v}\r\n`
        } else {
          raw += `${key}: ${value}\r\n`
        }
      }
      raw += '\r\n'
      // Only after the serialized request (and any early bytes the server
      // handed us with the upgrade event) are flushed do we start the byte
      // pipes — otherwise piped client bytes could overtake the headers.
      upstream.write(raw, () => {
        if (head && head.length) upstream.write(head)
        upstream.setTimeout(0)
        socket.pipe(upstream)
        upstream.pipe(socket)
      })
    })
  }

  /** Destroy all live upgraded connections and the upstream socket pool. */
  function close() {
    for (const s of upgradedSockets) s.destroy()
    upgradedSockets.clear()
    agent.destroy()
  }

  if (log) {
    log(`proxying /api/v4 -> ${target.secure ? 'https' : 'http'}://${target.host}:${target.port}${target.basePath}`)
  }
  return { request, upgrade, close, target }
}

/** Whether a request URL belongs to the backend API namespace. */
function isAPIPath(url) {
  const p = url || ''
  return p === '/api/v4' || p.startsWith('/api/v4/') || p.startsWith('/api/v4?')
}

module.exports = { createBackendProxy, isAPIPath, parseBackendURL, HOP_BY_HOP }
