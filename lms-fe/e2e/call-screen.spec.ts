import { test, expect, type Page } from '@playwright/test'
import { mockCallsBackend, CHANNEL_ID, type HubControls } from './call-hub-mock'

/**
 * E2E — the call screen STAYS ALIVE (regression for "call screen opens but
 * quits immediately", reported on a laptop WITH camera + microphone).
 *
 * Chromium is launched with --use-fake-device-for-media-stream +
 * --use-fake-ui-for-media-stream: the page gets a WORKING fake camera and
 * microphone with permissions auto-granted — exactly the user's machine.
 *
 * The backend (REST + the full calls WS signaling hub) is mocked at the
 * network layer, so this exercises the real ChatView, CallButton, CallWidget,
 * calls-client, calls-events and stores with zero Go server. The sibling spec
 * call-screen-nodevices.spec.ts covers the no-hardware voice-only join.
 */

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
})

const LEAVE_LABEL = 'Rời cuộc gọi'
const CALL_LABEL = 'Bắt đầu cuộc gọi'

/** Collect uncaught page errors (React crashes land here). */
function collectPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

/** Collect console errors from the calls signal path (regression sentinel:
 * the rtcd candidate envelope used to throw "Failed to construct
 * 'RTCIceCandidate'" here, dropping every SFU candidate). */
function collectSignalErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().includes('[calls] failed to handle signal')) {
      errors.push(msg.text())
    }
  })
  return errors
}

/** Navigate to the chat screen as an admin, open the first channel and
 * wait for the call button. */
async function openChat(page: Page): Promise<void> {
  await page.goto('/#lms_admin/chat')
  // Open the channel: the sidebar lists it once my channels load.
  const channelBtn = page.getByRole('button', { name: 'Town Square' })
  await expect(channelBtn).toBeVisible({ timeout: 20_000 })
  await channelBtn.click()
  // The channel header with the call button appears after the config fetch.
  await expect(page.locator(`[aria-label="${CALL_LABEL}"]`)).toBeVisible({ timeout: 15_000 })
}

async function joinCall(page: Page): Promise<void> {
  await page.locator(`[aria-label="${CALL_LABEL}"]`).click()
  // The call widget replaces the chat header's call button with the leave
  // control once the join ack + call state land.
  await expect(page.locator(`[aria-label="${LEAVE_LABEL}"]`).first()).toBeVisible({ timeout: 15_000 })
}

async function assertScreenStaysAlive(page: Page, seconds = 6): Promise<void> {
  const leave = page.locator(`[aria-label="${LEAVE_LABEL}"]`).first()
  // Poll for the whole window: the widget must never unmount.
  const deadline = Date.now() + seconds * 1000
  while (Date.now() < deadline) {
    await expect(leave).toBeVisible({ timeout: 1_000 })
    await page.waitForTimeout(500)
  }
  await expect(leave).toBeVisible({ timeout: 2_000 })
}

test('camera + mic present: call screen opens and STAYS running', async ({ page }) => {
  const errors = collectPageErrors(page)
  const signalErrors = collectSignalErrors(page)
  const hub = await mockCallsBackend(page)
  await openChat(page)

  // Sanity: getUserMedia must succeed here (fake cam + mic).
  const gum = await page.evaluate(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      s.getTracks().forEach((t) => t.stop())
      return 'ok'
    } catch (err) {
      return (err as Error).name
    }
  })
  expect(gum, 'sanity: fake devices must be available').toBe('ok')

  await joinCall(page)

  // The camera should actually be ON (self view bound to the local stream).
  await expect(page.locator('video').first()).toBeVisible({ timeout: 10_000 })

  // The browser completed its half of the signaling: SDP offer + its own
  // trickle candidates went to the (mock) SFU.
  await expect
    .poll(() => hub.actions.some((a) => a.action === 'custom_calls_sdp'), { timeout: 10_000 })
    .toBe(true)
  await expect
    .poll(() => hub.actions.some((a) => a.action === 'custom_calls_ice'), { timeout: 10_000 })
    .toBe(true)

  await assertScreenStaysAlive(page, 6)

  // Join hit the hub with the right channel.
  expect(hub.actions.some((a) => a.action === 'custom_calls_join' && a.data.channelID === CHANNEL_ID)).toBe(true)

  // No React crash (the old #185 "maximum update depth" landed as pageerror).
  expect(errors, errors.join('\n')).toEqual([])
  // No signal-handling failures: the mock SFU answers with real SDP and
  // rtcd-envelope candidates; a regression here is what dropped every SFU
  // candidate in production and killed calls after ~30 seconds.
  expect(signalErrors, signalErrors.join('\n')).toEqual([])
})

test('server error event shows the error modal (explains the death)', async ({ page }) => {
  const errors = collectPageErrors(page)
  await mockCallsBackend(page, {
    // Immediately after the join handshake, reject the join like the server
    // does for a disabled service / participant limit.
    onJoin: (hub: HubControls) => {
      hub.send('custom_calls_error', { data: 'calls: maximum participants reached' })
    },
  })
  await openChat(page)
  await page.locator(`[aria-label="${CALL_LABEL}"]`).click()

  // The error modal must become visible — the screen never dies silently.
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  expect(errors, errors.join('\n')).toEqual([])
})

test('leave button ends the call and restores the chat view', async ({ page }) => {
  const errors = collectPageErrors(page)
  const hub = await mockCallsBackend(page)
  await openChat(page)
  await joinCall(page)

  // The control bar's leave button opens a confirm menu; confirm the leave.
  await page.locator(`[aria-label="${LEAVE_LABEL}"]`).first().click()
  const leaveMenuItem = page.locator('[data-radix-popper-content-wrapper] button', { hasText: LEAVE_LABEL })
  await expect(leaveMenuItem).toBeVisible({ timeout: 5_000 })
  await leaveMenuItem.click()

  // Back to the normal chat header (call button available again).
  await expect(page.locator(`[aria-label="${CALL_LABEL}"]`)).toBeVisible({ timeout: 10_000 })
  expect(hub.actions.some((a) => a.action === 'custom_calls_leave' && a.data.channelID === CHANNEL_ID)).toBe(true)
  expect(errors, errors.join('\n')).toEqual([])
})
