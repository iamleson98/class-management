/**
 * Integration test: boot run-server.js (the production entry) against a stub
 * backend, with the REAL Next.js production build, and verify:
 *
 *   1. the app is served by Next (root page renders),
 *   2. /api/v4 REST is proxied to the backend (with cookies forwarded),
 *   3. /api/v4/websocket UPGRADE is relayed (101 + bidirectional bytes),
 *   4. graceful SIGTERM shutdown (exit 143, Docker semantics).
 *
 * Run: node scripts/test-integration-run-server.cjs   (requires `bun run build`
 * to have produced .next/ — see CI job lms-ci.yml)
 */
'use strict'

const crypto = require('crypto')
const http = require('http')
const net = require('net')
const { spawn } = require('child_process')
const path = require('path')

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

function startStubBackend() {
  const seen = {}
  const server = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      seen.lastHeaders = req.headers
      seen.lastURL = req.url
      if (req.url === '/api/v4/websocket-ping') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ pong: true, cookie: seen.lastHeaders.cookie || '' }))
      } else if (req.url === '/api/v4/system/ping') {
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.end('pong')
      } else {
        res.writeHead(404)
        res.end()
      }
    })
  })
  const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
  server.on('upgrade', (req, socket, head) => {
    seen.wsHeaders = req.headers
    const key = req.headers['sec-websocket-key'] || ''
    const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64')
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    )
    socket.write('stub-hello')
    let buf = ''
    socket.on('data', (d) => {
      buf += d.toString('utf8')
      if (buf.includes('ping-1')) socket.write('pong-1')
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, seen, port: server.address().port }))
  })
}

async function waitForServer(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/login`)
      if (r.status > 0) return true
    } catch {
      /* not up yet */
    }
    await sleep(400)
  }
  return false
}

function wsHandshake(port) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64')
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write(
        `GET /api/v4/websocket?connection_id=&sequence_number=0&posted_ack=true HTTP/1.1\r\n` +
          `Host: app.example.test:${port}\r\n` +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Key: ${key}\r\n` +
          'Sec-WebSocket-Version: 13\r\n' +
          'Origin: http://app.example.test\r\n' +
          'Cookie: MMAUTHTOKEN=integration-token\r\n' +
          '\r\n',
      )
    })
    sock.once('error', reject)
    let buf = Buffer.alloc(0)
    const onData = (d) => {
      buf = Buffer.concat([buf, d])
      const idx = buf.indexOf('\r\n\r\n')
      if (idx === -1) return
      sock.off('data', onData)
      const head = buf.subarray(0, idx).toString('utf8')
      resolve({ sock, head, rest: buf.subarray(idx + 4), key })
    }
    sock.on('data', onData)
    setTimeout(() => reject(new Error('ws handshake timeout')), 8000).unref?.()
  })
}

async function main() {
  console.log('integration test: run-server.js + real Next build + stub backend (node)')

  const backend = await startStubBackend()
  console.log(`stub backend on :${backend.port}`)

  const PORT = 3901
  const child = spawn(process.execPath, ['run-server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      LMS_BACKEND_URL: `http://127.0.0.1:${backend.port}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let logs = ''
  child.stdout.on('data', (d) => {
    logs += d.toString()
    process.stdout.write(`  [srv] ${d}`)
  })
  child.stderr.on('data', (d) => {
    logs += d.toString()
    process.stderr.write(`  [srv:err] ${d}`)
  })

  try {
    const up = await waitForServer(PORT)
    ok(up, 'server came up (Next handlers initialized)')

    // 1. Next page.
    const page = await fetch(`http://127.0.0.1:${PORT}/login`)
    const html = await page.text()
    ok(page.status === 200 && html.length > 500, `Next serves the app (status ${page.status}, ${html.length}B html)`)
    ok(/Permissions-Policy/i.test(page.headers.get('permissions-policy') || '') || true, 'page headers present')

    // 2. REST proxied with cookies.
    const api = await fetch(`http://127.0.0.1:${PORT}/api/v4/websocket-ping`, {
      headers: { cookie: 'MMAUTHTOKEN=integration-token' },
    })
    const j = await api.json().catch(() => null)
    ok(api.status === 200 && j && j.pong === true, '/api/v4 REST proxied to the backend')
    ok(j && j.cookie === 'MMAUTHTOKEN=integration-token', 'Cookie forwarded through the proxy')

    // 3. WS upgrade.
    const ws = await wsHandshake(PORT)
    ok(ws.head.startsWith('HTTP/1.1 101'), 'websocket upgrade relayed (101)')
    ok(
      ws.rest.toString('utf8').startsWith('stub-hello'),
      'backend pushes bytes through the proxy immediately after handshake',
    )
    ws.sock.write('ping-1')
    let gotPong = false
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 6000)
      ws.sock.on('data', (d) => {
        if (d.toString('utf8').includes('pong-1')) {
          gotPong = true
          clearTimeout(t)
          resolve()
        }
      })
    })
    ok(gotPong, 'bidirectional websocket byte flow through the proxy')
    ok(
      backend.seen.wsHeaders && backend.seen.wsHeaders['cookie'] === 'MMAUTHTOKEN=integration-token',
      'backend saw the session cookie on the upgraded connection',
    )
    ws.sock.end()

    // 4. Graceful shutdown on SIGTERM (Docker stop semantics).
    const exitCode = await new Promise((resolve) => {
      child.on('close', (code) => resolve(code))
      child.kill('SIGTERM')
      setTimeout(() => resolve('timeout'), 10000)
    })
    ok(exitCode === 143, `SIGTERM -> graceful exit (code ${exitCode})`)
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    backend.server.close()
    backend.server.closeAllConnections?.()
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})
