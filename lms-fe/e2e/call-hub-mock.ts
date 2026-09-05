import type { Page, Route, WebSocketRoute } from '@playwright/test'

/**
 * E2E fixture — a fake Mattermost-style backend for the CALLS feature.
 *
 * Serves the chat REST surface (teams/channels/posts/calls config) plus a
 * full fake WebSocket hub (page.routeWebSocket) that speaks the native
 * calls signaling protocol:
 *
 *   client sends:  {"action":"custom_calls_join","seq":N,"data":{...}}
 *   hub replies:   {"event":"custom_calls_join","data":{"connID","iceServers"},...}
 *                  {"event":"custom_calls_call_start", ...}
 *                  {"event":"custom_calls_user_joined", ...}
 *                  {"event":"custom_calls_call_state","data":{"call":"<json>"}}
 *
 * The wsClient tracks a per-connection sequence number and FORCE-DISCONNECTS
 * on a mismatch ("missed websocket event"), so every hub event must carry an
 * incrementing seq starting at 0. pings are answered with seq_reply frames.
 */

export const TEAM_ID = 'team1'
export const CHANNEL_ID = 'chan1'
export const USER_ID = 'admin-user-1'

export interface HubScript {
  /** Extra behavior after the standard join handshake (send custom events). */
  onJoin?: (hub: HubControls) => void
}

export interface HubControls {
  /** Send a server event with the next sequence number. */
  send: (event: string, data: Record<string, unknown>, broadcast?: Record<string, unknown>) => void
  /** All client actions received so far (in order). */
  actions: Array<{ action: string; data: Record<string, unknown> }>
  /** The connID handed out for the most recent join. */
  lastConnID: () => string
}

/** Install the REST + WS mocks. Returns the live hub controls. */
export async function mockCallsBackend(page: Page, script: HubScript = {}): Promise<HubControls> {
  // ── Loopback SFU binding ──────────────────────────────────────────────
  // A loopback RTCPeerConnection created INSIDE the page answers the
  // browser's offer with a real SDP and trickles real ICE candidates back
  // through the hub — in rtcd's wire format: {type:"candidate",
  // candidate:{…ICECandidateInit}}. The previous mock never sent signal
  // events at all, so the exact production regression (constructing
  // RTCIceCandidate from the envelope instead of the nested init) was
  // invisible to e2e.
  const controlsRef: { send?: HubControls['send'] } = {}
  await page.exposeFunction('__vmgMockSfuCandidate', (candidateJson: string) => {
    controlsRef.send?.('custom_calls_signal', {
      data: JSON.stringify({ type: 'candidate', candidate: JSON.parse(candidateJson) }),
    })
  })

  // ── REST (catch-all FIRST so specific mocks below win) ──────────────
  // NOTE: every specific pattern below tolerates query strings with a
  // trailing ** — Playwright glob URL matching includes the query string.
  await page.route('**/api/v4/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }))

  await page.route('**/api/v4/users/me', (route) =>
    route.fulfill(jsonBody(route, {
      id: USER_ID,
      username: 'admin',
      email: 'admin@vmg.test',
      nickname: 'VMG Admin',
      firstname: 'VMG',
      lastname: 'Admin',
      roles: 'system_admin system_user lms_admin',
    })))

  await page.route('**/api/v4/users/me/teams', (route) =>
    route.fulfill(jsonBody(route, [{ id: TEAM_ID, name: 'vmg', display_name: 'VMG', type: 'I', delete_at: 0, create_at: 1, update_at: 1, email: 'a@b.c', allow_open_invite: true }])))

  await page.route(`**/api/v4/users/me/teams/${TEAM_ID}/channels**`, (route) =>
    route.fulfill(jsonBody(route, [{
      id: CHANNEL_ID,
      team_id: TEAM_ID,
      name: 'town-square',
      display_name: 'Town Square',
      type: 'O',
      total_msg_count: 3,
      delete_at: 0,
      create_at: 1,
      update_at: 1,
      creator_id: USER_ID,
      header: '',
      purpose: '',
    }])))

  await page.route(`**/api/v4/users/me/teams/${TEAM_ID}/channels/members**`, (route) =>
    route.fulfill(jsonBody(route, [{
      channel_id: CHANNEL_ID,
      user_id: USER_ID,
      roles: 'channel_user',
      msg_count: 3,
      mention_count: 0,
      last_viewed_at: Date.now(),
    }])))

  await page.route(`**/api/v4/users/${USER_ID}/channels/${CHANNEL_ID}/posts/unread**`, (route) =>
    route.fulfill(jsonBody(route, { order: [], posts: {}, prev_post_id: '', next_post_id: '', has_next: false })))

  await page.route('**/api/v4/calls/config', (route) =>
    route.fulfill(jsonBody(route, {
      enabled: true,
      maxParticipants: 0,
      allowScreenSharing: true,
      allowRecording: false,
      ringingEnabled: false,
      hostControlsAllowed: true,
      groupCallsAllowed: true,
      enableVideo: true,
      enableReactions: true,
    })))

  await page.route(`**/api/v4/calls/channels/${CHANNEL_ID}/enabled`, (route) =>
    route.fulfill(jsonBody(route, { enabled: true })))

  await page.route('**/api/v4/calls/channels', (route) =>
    route.fulfill(jsonBody(route, [])))

  // ── WebSocket hub ───────────────────────────────────────────────────
  const actions: Array<{ action: string; data: Record<string, unknown> }> = []
  let connID = ''
  let pendingScript = script.onJoin
  let routeWs: WebSocketRoute | null = null

  const controls: HubControls = {
    send: (event, data, broadcast) => {
      routeWs?.send(JSON.stringify({ event, data, broadcast: broadcast ?? {}, seq: nextSeq++ }))
    },
    actions,
    lastConnID: () => connID,
  }
  controlsRef.send = controls.send

  // Per-connection server sequence (must start at 0 and increment per event).
  let nextSeq = 0

  await page.routeWebSocket(/\/api\/v4\/websocket/, (ws) => {
    routeWs = ws
    nextSeq = 0
    // hello is always the first frame; establishes the connection id.
    ws.send(JSON.stringify({
      event: 'hello',
      data: { connection_id: 'hub-' + Math.random().toString(36).slice(2), server_hostname: 'mock' },
      broadcast: {},
      seq: nextSeq++,
    }))

    ws.onMessage((message) => {
      let msg: { action?: string; seq?: number; data?: Record<string, unknown> }
      try {
        msg = JSON.parse(String(message))
      } catch {
        return
      }
      if (!msg.action) return
      actions.push({ action: msg.action, data: msg.data ?? {} })

      // Replies carry seq_reply and bypass the event-sequence counter.
      if (msg.action === 'ping') {
        ws.send(JSON.stringify({ seq_reply: msg.seq, data: { text: 'pong', version: 'mock' } }))
        return
      }

      if (msg.action === 'custom_calls_join') {
        connID = 'sess-' + Math.random().toString(36).slice(2)
        const channelId = String(msg.data?.channelID ?? CHANNEL_ID)
        const now = Date.now()

        // Join ack (unicast): session id + ICE servers.
        ws.send(JSON.stringify({
          event: 'custom_calls_join',
          data: { connID, iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] },
          broadcast: {},
          seq: nextSeq++,
        }))
        // Call lifecycle (channel-scoped broadcasts).
        ws.send(JSON.stringify({
          event: 'custom_calls_call_start',
          data: { channel_id: channelId, call_id: 'call-1', start_at: now, owner_id: USER_ID },
          broadcast: { channel_id: channelId },
          seq: nextSeq++,
        }))
        ws.send(JSON.stringify({
          event: 'custom_calls_user_joined',
          data: { user_id: USER_ID, session_id: connID },
          broadcast: { channel_id: channelId },
          seq: nextSeq++,
        }))
        // Full call state snapshot.
        ws.send(JSON.stringify({
          event: 'custom_calls_call_state',
          data: { call: JSON.stringify({
            call_id: 'call-1',
            channel_id: channelId,
            start_at: now,
            rtcd_host: 'mock',
            participants: 1,
            host_session_id: connID,
            sessions: [{ id: connID, user_id: USER_ID, unmuted: true, voice_on: true, screen_on: false, video_on: false, raised_hand_at: 0, is_host: true }],
          }) },
          broadcast: {},
          seq: nextSeq++,
        }))

        // Optional scripted extra behavior (e.g. server error).
        if (pendingScript) {
          const fn = pendingScript
          pendingScript = undefined
          fn(controls)
        }
        return
      }

      // The last participant leaving ends the call, like the real server's
      // handleLeave -> endCallState: user_left + call_end broadcasts.
      if (msg.action === 'custom_calls_leave') {
        const channelId = String(msg.data?.channelID ?? CHANNEL_ID)
        ws.send(JSON.stringify({
          event: 'custom_calls_user_left',
          data: { user_id: USER_ID, session_id: connID },
          broadcast: { channel_id: channelId },
          seq: nextSeq++,
        }))
        ws.send(JSON.stringify({
          event: 'custom_calls_call_end',
          data: { channel_id: channelId, call_id: 'call-1', end_at: Date.now() },
          broadcast: { channel_id: channelId },
          seq: nextSeq++,
        }))
        return
      }

      // The browser's SDP offer: answer it from a loopback peer connection
      // living in the page (real SDP, real trickle ICE), exactly like rtcd:
      // unicast `signal` events carrying the answer, then candidates in the
      // rtcd envelope shape {type:"candidate", candidate:{…}}.
      if (msg.action === 'custom_calls_sdp') {
        const offerJson = String(msg.data?.data ?? '')
        void page
          .evaluate(async (offerJson: string) => {
            const offer = JSON.parse(offerJson)
            const pc = new RTCPeerConnection()
            ;(window as unknown as Record<string, unknown>).__vmgLoopbackPC = pc
            await pc.setRemoteDescription(offer)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            pc.onicecandidate = (ev: RTCIceCandidateEventish) => {
              if (ev.candidate) {
                void (window as unknown as Record<string, (json: string) => void>).__vmgMockSfuCandidate(
                  JSON.stringify(ev.candidate.toJSON()),
                )
              }
            }
            return { type: answer.type, sdp: answer.sdp }
          }, offerJson)
          .then((answer) => {
            controls.send('custom_calls_signal', { data: JSON.stringify(answer) })
          })
          .catch(() => {
            // Signaling is best-effort in the mock; tests assert on the
            // actions log and console noise, not on this path.
          })
        return
      }

      // The browser's own trickle candidates: feed them to the loopback PC
      // so the ICE exchange is symmetrical (like the real SFU's handleICE).
      if (msg.action === 'custom_calls_ice') {
        const candJson = String(msg.data?.data ?? '')
        void page
          .evaluate((candJson: string) => {
            const pc = (window as unknown as Record<string, RTCPeerConnectionish | undefined>).__vmgLoopbackPC
            if (pc) void pc.addIceCandidate(JSON.parse(candJson)).catch(() => undefined)
          }, candJson)
          .catch(() => undefined)
        return
      }

      // Mute etc. are recorded in actions; no reply needed.
    })
  })

  return controls
}

type RTCIceCandidateEventish = { candidate: { toJSON: () => unknown } | null }
type RTCPeerConnectionish = { addIceCandidate: (init: unknown) => Promise<void> }

function jsonBody(route: Route, body: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) }
}
