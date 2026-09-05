import { test, expect } from '@playwright/test'
import { mockCallsBackend, CHANNEL_ID, USER_ID, type HubControls } from './call-hub-mock'

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--auto-select-desktop-capture-source=Entire screen',
    ],
  },
})

const OUT = process.env.UI_PREVIEW_OUT || 'test-results/ui-preview'

/** Inject remote participants (call_state sync drives the roster). */
function addParticipants(hub: HubControls, n: number) {
  const now = Date.now()
  const base = hub.lastConnID()
  const sessions: Array<Record<string, unknown>> = [
    { id: base, user_id: USER_ID, unmuted: true, voice_on: false, screen_on: false, video_on: true, raised_hand_at: 0, is_host: true },
  ]
  for (let i = 1; i <= n; i++) {
    sessions.push({
      id: `remote-${i}`,
      user_id: `user-${1000 + i}`,
      unmuted: i % 2 === 0,
      voice_on: i === 1,
      screen_on: false,
      video_on: true,
      raised_hand_at: i === 3 ? now : 0,
      is_host: false,
    })
  }
  hub.send('custom_calls_call_state', {
    call: JSON.stringify({
      call_id: 'call-1', channel_id: CHANNEL_ID, start_at: now - 95_000,
      participants: sessions.length, host_session_id: base, sessions,
    }),
  })
}

test('capture call UI states', async ({ page }) => {
  const hub = await mockCallsBackend(page)
  await page.goto('/#lms_admin/chat')
  await page.getByRole('button', { name: 'Town Square' }).click()
  await page.locator('[aria-label="Bắt đầu cuộc gọi"]').click()
  await expect(page.locator('[aria-label="Rời cuộc gọi"]').first()).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1500)

  // 1. Solo (waiting room with self view)
  await page.screenshot({ path: `${OUT}/1-solo.png` })

  // 2. Grid with 5 participants
  addParticipants(hub, 4)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/2-grid.png` })

  // 3. Presentation mode (self share)
  await page.locator('[aria-label="Chia sẻ màn hình"]').click()
  await expect(page.getByText('Bạn đang chia sẻ màn hình')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/3-presentation.png` })
  await page.getByRole('button', { name: 'Dừng chia sẻ' }).first().click()
  await page.waitForTimeout(600)

  // 4. Minimized bar
  await page.locator('[aria-label="Thu nhỏ cuộc gọi"]').click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/4-minimized.png` })
})
