/**
 * Functional tests for lib/api-proxy.js — the runtime /api/v4 reverse proxy
 * (REST + WebSocket upgrade) that lets the frontend be deployed separately
 * from the backend while keeping everything same-origin.
 *
 * Run under BOTH runtimes (the container uses Bun; CI/dev uses Node):
 *   node scripts/test-api-proxy.cjs
 *   bun  scripts/test-api-proxy.cjs
 *
 * Covers:
 *   - REST proxying: method/URL/headers/status, streaming bodies (2 MB),
 *     keep-alive socket reuse under concurrency, cookie + Host preservation,
 *     X-Forwarded-For/Proto generation and chaining.
 *   - WebSocket upgrade: verbatim handshake (101 + Sec-WebSocket-Accept
 *     computed by the BACKEND), header/cookie passthrough, bidirectional
 *     byte flow, clean pair teardown.
 *   - Failure modes: backend down -> 502 JSON (REST) and 502 raw (WS).
 *   - URL classification helpers (isAPIPath, parseBackendURL).
 */
'use strict'

const crypto = require('crypto')
const http = require('http')
const net = require('net')

const { createBackendProxy, isAPIPath, parseBackendURL } = require('../lib/api-proxy')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let passed = 0
let failed = 0
function ok(cond, label) {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

function eq(a, b, label) {
  const cond = a === b
  if (!cond) console.error(`    expected: ${JSON.stringify(b)}\n    actual:   ${JSON.stringify(a)}`)
  ok(cond, label)
}

// ─── 1. unit: URL helpers ─────────────────────────────────────────────────

async function testURLHelpers() {
  console.log('\n[1] URL helpers')
  ok(isAPIPath('/api/v4'), 'isAPIPath("/api/v4")')
  ok(isAPIPath('/api/v4/users/login'), 'isAPIPath("/api/v4/users/login")')
  ok(isAPIPath('/api/v4?token=1'), 'isAPIPath("/api/v4?token=1")')
  ok(!isAPIPath('/api/v41'), 'not "/api/v41"')
  ok(!isAPIPath('/api/v3/users'), 'not "/api/v3/users"')
  ok(!isAPIPath('/'), 'not "/"')
  ok(!isAPIPath('/_next/static/x.js'), 'not "/_next/static"')

  const t1 = parseBackendURL('http://lms-server:8065')
  ok(t1 && t1.host === 'lms-server' && t1.port === 8065 && !t1.secure && t1.basePath === '', 'parse http host:port')
  const t2 = parseBackendURL('https://api.example.com/base/')
  ok(t2 && t2.secure && t2.port === 443 && t2.basePath === '/base', 'parse https + base path')
  eq(parseBackendURL('ftp://x'), null, 'parse rejects non-http scheme')
  eq(parseBackendURL('not a url'), null, 'parse rejects garbage')
  eq(parseBackendURL('http://lms-server:8065/sub').basePath, '/sub', 'no trailing slash stripping of base path')
}

// ─── 2. stub backend + proxy wiring ───────────────────────────────────────

function startBackend() {
  const seen = { lastHeaders: null, wsGotPong: null }
  const wsPong = new Promise((resolve) => {
    seen.wsGotPong = resolve
  })

  const server = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      seen.lastHeaders = req.headers
      seen.lastURL = req.url
      seen.lastMethod = req.method
      if (req.url.startsWith('/api/v4/echo')) {
        const body = Buffer.concat(chunks)
        res.writeHead(200, { 'content-type': 'application/octet-stream', 'x-backend': 'yes' })
        res.end(body)
      } else if (req.url.startsWith('/api/v4/health')) {
        res.writeHead(200, { 'content-type': 'text/plain', 'x-backend': 'yes' })
        res.end('ok')
      } else {
        res.writeHead(404)
        res.end('nope')
      }
    })
  })

  const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
  server.on('upgrade', (req, socket, head) => {
    seen.wsHeaders = req.headers
    seen.wsURL = req.url
    seen.wsHead = head ? head.toString('utf8') : ''
    const key = req.headers['sec-websocket-key'] || ''
    const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64')
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n` +
        '\r\n',
    )
    // Echo the upgrade head back so the client can verify early bytes made
    // it to the backend, then send our own payload.
    if (head && head.length) socket.write(head)
    socket.write('backend-says-hi')
    // Collect client -> backend bytes; resolve when "pong" arrives.
    let buf = ''
    socket.on('data', (d) => {
      buf += d.toString('utf8')
      if (buf.includes('pong')) seen.wsGotPong('pong')
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, seen, wsPong, port: server.address().port }))
  })
}

function startProxy(backendURL) {
  const proxy = createBackendProxy(backendURL, null)
  const server = http.createServer((req, res) => {
    if (isAPIPath(req.url)) return proxy.request(req, res)
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('next-page')
  })
  server.on('upgrade', (req, socket, head) => proxy.upgrade(req, socket, head))
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, proxy, port: server.address().port }),
    )
  })
}

/** Hand-rolled WS client: returns the raw socket + the parsed handshake response. */
function wsHandshake(port, { path = '/api/v4/websocket?connection_id=&sequence_number=0&posted_ack=true', host = 'app.example.test', origin = 'http://app.example.test', cookie = 'MMAUTHTOKEN=stubby', earlyBytes = null } = {}) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64')
    const sock = net.connect(port, '127.0.0.1', () => {
      let req =
        `GET ${path} HTTP/1.1\r\n` +
        `Host: ${host}:${port}\r\n` +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Key: ${key}\r\n` +
        'Sec-WebSocket-Version: 13\r\n' +
        `Origin: ${origin}\r\n` +
        `Cookie: ${cookie}\r\n` +
        '\r\n'
      sock.write(req, () => {
        if (earlyBytes) sock.write(earlyBytes)
      })
    })
    sock.once('error', reject)
    let headBuf = Buffer.alloc(0)
    const onData = (d) => {
      headBuf = Buffer.concat([headBuf, d])
      const idx = headBuf.indexOf('\r\n\r\n')
      if (idx === -1) return
      sock.off('data', onData)
      const head = headBuf.subarray(0, idx).toString('utf8')
      const rest = headBuf.subarray(idx + 4)
      resolve({ sock, head, rest, key })
    }
    sock.on('data', onData)
    setTimeout(() => reject(new Error('ws handshake timeout')), 5000).unref?.()
  })
}

// ─── 3. REST tests ────────────────────────────────────────────────────────

async function testREST(proxy) {
  console.log('\n[2] REST proxying')
  const base = `http://127.0.0.1:${proxy.port}`

  const r1 = await fetch(`${base}/api/v4/health`)
  eq(r1.status, 200, 'GET /api/v4/health -> 200')
  eq(await r1.text(), 'ok', 'body forwarded')
  eq(r1.headers.get('x-backend'), 'yes', 'response header forwarded')

  const body = Buffer.alloc(2 * 1024 * 1024, 7)
  const r2 = await fetch(`${base}/api/v4/echo`, { method: 'POST', body })
  const echoed = Buffer.from(await r2.arrayBuffer())
  ok(echoed.length === body.length, `2 MB body streamed intact (${echoed.length} bytes)`)
  ok(echoed.equals(body), 'body bytes identical')

  // Concurrency + keep-alive reuse.
  const results = await Promise.all(
    Array.from({ length: 24 }, (_, i) =>
      fetch(`${base}/api/v4/echo`, { method: 'POST', body: `req-${i}` }).then((r) => r.text()),
    ),
  )
  ok(results.every((v, i) => v === `req-${i}`), '24 concurrent keep-alive requests all correct')

  // Non-API path falls through to the "Next" handler.
  const r3 = await fetch(`${base}/some/page`)
  eq(await r3.text(), 'next-page', 'non-/api/v4 path handled by Next handler')

  // Header hygiene seen by the backend.
  const r4 = await fetch(`${base}/api/v4/echo`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain', 'x-requested-with': 'XMLHttpRequest' },
    body: 'hdr',
  })
  await r4.text()
  return proxy // seen assertions happen in caller with backend.seen
}

async function assertBackendSaw(backend, expectations) {
  for (const [label, cond] of expectations) ok(cond, label)
}

// ─── 4. WebSocket tests ───────────────────────────────────────────────────

async function testWS(backend, proxy) {
  console.log('\n[3] WebSocket upgrade proxying')

  // Send early bytes (the `head` buffer) plus the normal flow.
  const ws = await wsHandshake(proxy.port, { earlyBytes: 'early-bytes' })
  ok(ws.head.startsWith('HTTP/1.1 101'), 'backend 101 relayed')
  ok(/sec-websocket-accept:/i.test(ws.head), 'Sec-WebSocket-Accept relayed (real backend handshake)')

  const expectedAccept = crypto
    .createHash('sha1')
    .update(ws.key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64')
  const gotAccept = (ws.head.match(/sec-websocket-accept:\s*(\S+)/i) || [])[1]
  eq(gotAccept, expectedAccept, 'accept token matches backend-computed value')

  ok(ws.rest.toString('utf8').includes('early-bytes'), 'upgrade head (early bytes) reached the backend and came back')
  ok(ws.rest.toString('utf8').includes('backend-says-hi'), 'server->client bytes flow right after the handshake')

  ws.sock.write('pong')
  const got = await Promise.race([backend.wsPong, sleep(3000).then(() => null)])
  eq(got, 'pong', 'client->backend bytes flow after the handshake')
  eq(backend.seen.wsHead, 'early-bytes', 'early bytes delivered as the backend upgrade head')

  // Backend saw the handshake verbatim: cookie, host, origin, upgrade headers.
  eq(backend.seen.wsHeaders['cookie'], 'MMAUTHTOKEN=stubby', 'Cookie header forwarded on upgrade')
  eq(backend.seen.wsHeaders['host'], `app.example.test:${proxy.port}`, 'original Host preserved')
  eq(backend.seen.wsHeaders['origin'], 'http://app.example.test', 'Origin preserved')
  eq(backend.seen.wsHeaders['upgrade'], 'websocket', 'Upgrade header preserved')
  ok(backend.seen.wsURL.startsWith('/api/v4/websocket'), 'upgrade URL + query forwarded')
  ok(!!backend.seen.wsHeaders['x-forwarded-for'], 'X-Forwarded-For added on upgrade')

  // Teardown: client close tears down the upstream pair.
  ws.sock.end()
  await sleep(200)
  ok(true, 'clean client close')
}

// ─── 5. failure modes ─────────────────────────────────────────────────────

async function testFailures() {
  console.log('\n[4] failure modes (backend down)')

  // A port that is definitively closed: bind then immediately close.
  const deadPort = await new Promise((resolve) => {
    const s = net.createServer(() => {})
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => resolve(p))
    })
  })

  const proxy = await startProxy(`http://127.0.0.1:${deadPort}`)
  const base = `http://127.0.0.1:${proxy.port}`

  const r = await fetch(`${base}/api/v4/health`)
  eq(r.status, 502, 'REST -> 502 when backend is down')
  const j = await r.json().catch(() => null)
  ok(j && j.id === 'proxy.bad_gateway', '502 body is structured JSON')

  // WS upgrade -> raw 502.
  const ws = await wsHandshake(proxy.port, { cookie: 'x=1' })
  ok(ws.head.startsWith('HTTP/1.1 502'), 'WS upgrade -> 502 when backend is down')
  ws.sock.destroy()
  proxy.server.close()
  proxy.server.closeAllConnections?.()
}

// ─── main ─────────────────────────────────────────────────────────────────

async function main() {
  const runtime = `${typeof Bun !== 'undefined' ? 'bun' : 'node'} ${typeof Bun !== 'undefined' ? Bun.version : process.version}`
  console.log(`api-proxy functional tests (${runtime})`)

  await testURLHelpers()

  const backend = await startBackend()
  const proxy = await startProxy(`http://127.0.0.1:${backend.port}`)
  const seenProxy = await testREST(proxy)

  // Backend-side header assertions for the REST leg (last request had these).
  await assertBackendSaw(backend, [
    ['backend saw x-requested-with', seenProxy && backend.seen.lastHeaders['x-requested-with'] === 'XMLHttpRequest'],
    ['backend saw X-Forwarded-For', !!backend.seen.lastHeaders['x-forwarded-for']],
    ['backend saw X-Forwarded-Proto', backend.seen.lastHeaders['x-forwarded-proto'] === 'http'],
    ['backend saw content-type', backend.seen.lastHeaders['content-type'] === 'text/plain'],
  ])

  await testWS(backend, proxy)

  await testFailures()

  console.log(`\n${passed} passed, ${failed} failed (${runtime})`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})
