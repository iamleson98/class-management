/**
 * run-server.js — production entry for the LMS frontend container.
 *
 * Boots the Next.js standalone server and wires the /api/v4 reverse proxy
 * (lib/api-proxy.js — REST + WebSocket) so the frontend can be deployed
 * separately from the backend while the browser still sees ONE origin and
 * the httpOnly MMAUTHTOKEN cookie stays first-party for REST, the chat
 * WebSocket and the calls (audio/video signaling) WebSocket alike.
 *
 * Runtime configuration (all read at RUNTIME — one image, any deployment):
 *   PORT               listen port                  (default 3000)
 *   HOSTNAME           listen address               (default 0.0.0.0)
 *   LMS_BACKEND_URL    backend origin for /api/v4   (unset = proxy disabled;
 *                      /api/v4 then falls through to Next.js — dev mode,
 *                      where the next dev rewrites / Caddy handle it)
 *   KEEP_ALIVE_TIMEOUT server keep-alive ms         (optional, passthrough)
 *
 * Runs on Node.js — the container runtime. (Bun installs/builds the app but
 * does not support hijacked WS-upgrade sockets; see lib/api-proxy.js.)
 */
'use strict'

const fs = require('fs')
const http = require('http')
const path = require('path')

const { createBackendProxy, isAPIPath } = require('./lib/api-proxy')

const dir = path.join(__dirname)

process.env.NODE_ENV = 'production'
process.chdir(dir)

const PORT = parseInt(process.env.PORT, 10) || 3000
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0'
const KEEP_ALIVE_TIMEOUT = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10)

// ─── Next.js standalone config ────────────────────────────────────────────
// The standalone build embeds the resolved config in its generated server.js;
// we keep it in .next/required-server-files.json (copied by the Dockerfile)
// and pass it through the same private env var.
let nextConfig
try {
  nextConfig = JSON.parse(
    fs.readFileSync(path.join(dir, '.next/required-server-files.json'), 'utf8'),
  ).config
} catch (err) {
  console.error('[run-server] fatal: cannot read .next/required-server-files.json:', err.message)
  process.exit(1)
}
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)

require('next')
const { getRequestHandlers } = require('next/dist/server/lib/start-server')

// ─── Server bootstrap (mirrors next's own start-server flow) ───────────────

async function main() {
  let proxy = null
  if (process.env.LMS_BACKEND_URL) {
    if (typeof Bun !== 'undefined') {
      console.error(
        '[run-server] fatal: LMS_BACKEND_URL proxy requires the Node runtime — ' +
          "Bun's node:http server does not support hijacked WebSocket upgrade sockets " +
          '(writes to the upgraded socket never reach the client). ' +
          'The production image runs Node (lms-fe/Dockerfile); use "node run-server.js" locally.',
      )
      process.exit(1)
    }
    try {
      proxy = createBackendProxy(process.env.LMS_BACKEND_URL, (m) => console.log(`[run-server] ${m}`))
    } catch (err) {
      console.error(`[run-server] fatal: ${err.message}`)
      process.exit(1)
    }
  } else {
    console.log('[run-server] LMS_BACKEND_URL not set: /api/v4 proxy disabled (dev mode)')
  }

  let handlersReady = () => {}
  const handlersPromise = new Promise((resolve) => {
    handlersReady = resolve
  })

  let requestHandler = async (req, res) => {
    await handlersPromise
    return requestHandler(req, res)
  }
  let upgradeHandler = async (req, socket, head) => {
    await handlersPromise
    return upgradeHandler(req, socket, head)
  }
  let nextServer

  const server = http.createServer(async (req, res) => {
    try {
      if (proxy && isAPIPath(req.url)) {
        proxy.request(req, res)
        return
      }
      await requestHandler(req, res)
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('Internal Server Error')
      } else {
        res.destroy()
      }
      console.error(`[run-server] request failed for ${req.url}`)
      console.error(err)
    }
  })

  server.on('upgrade', async (req, socket, head) => {
    try {
      if (proxy && isAPIPath(req.url)) {
        proxy.upgrade(req, socket, head)
        return
      }
      await upgradeHandler(req, socket, head)
    } catch (err) {
      socket.destroy()
      console.error(`[run-server] upgrade failed for ${req.url}`)
      console.error(err)
    }
  })

  if (Number.isFinite(KEEP_ALIVE_TIMEOUT) && KEEP_ALIVE_TIMEOUT >= 0) {
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT
  }
  // Large uploads must not trip default request timeouts — the backend owns
  // its own limits. WebSocket pairs are hijacked sockets and are unaffected.
  server.requestTimeout = 0
  server.headersTimeout = 60_000

  server.on('error', (err) => {
    console.error('[run-server] failed to start server')
    console.error(err)
    process.exit(1)
  })

  // Graceful shutdown (Docker SIGTERM): stop accepting, drain in-flight
  // requests, close hijacked WS pairs and the upstream pool.
  let shuttingDown = false
  const shutdown = (signal) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[run-server] ${signal} received, shutting down`)
    if (proxy) proxy.close()
    server.close(async () => {
      try {
        if (nextServer && nextServer.close) await nextServer.close()
      } catch (err) {
        console.error('[run-server] error closing Next server', err)
      }
      process.exit(signal === 'SIGINT' ? 130 : 143)
    })
    // Hard exit if draining stalls (Docker gives ~10s by default).
    setTimeout(() => process.exit(signal === 'SIGINT' ? 130 : 143), 8000).unref()
  }
  if (!process.env.NEXT_MANUAL_SIG_HANDLE) {
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  }

  server.listen(PORT, HOSTNAME, async () => {
    process.env.PORT = String(PORT)
    process.env.__NEXT_PRIVATE_ORIGIN = `http://localhost:${PORT}`
    try {
      const handlers = await getRequestHandlers({
        dir,
        port: PORT,
        isDev: false,
        server,
        hostname: HOSTNAME,
        keepAliveTimeout: Number.isFinite(KEEP_ALIVE_TIMEOUT) ? KEEP_ALIVE_TIMEOUT : undefined,
      })
      requestHandler = handlers.requestHandler
      upgradeHandler = handlers.upgradeHandler
      nextServer = handlers.server
      handlersReady()
      console.log(`[run-server] LMS frontend ready on http://${HOSTNAME}:${PORT}`)
    } catch (err) {
      console.error('[run-server] fatal: failed to initialize Next.js')
      console.error(err)
      process.exit(1)
    }
  })
}

main().catch((err) => {
  console.error('[run-server] fatal:', err)
  process.exit(1)
})
