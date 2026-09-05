import { test, expect, type Page } from '@playwright/test'
import { mockCallsBackend } from './call-hub-mock'

/**
 * E2E — voice-only join: NO capture hardware (getUserMedia fails), permission
 * auto-granted. The call screen must still open and STAY running (regression
 * for the "no camera/mic" machine where the screen also died instantly).
 *
 * Chromium is launched with ONLY --use-fake-ui-for-media-stream (permission
 * granted) and no fake device, so getUserMedia rejects with NotFoundError —
 * exactly like real missing hardware.
 */

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream'],
  },
})

const LEAVE_LABEL = 'Rời cuộc gọi'
const CALL_LABEL = 'Bắt đầu cuộc gọi'

test('no camera or microphone: call screen opens and STAYS running (voice-only)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  await mockCallsBackend(page)

  await page.goto('/#lms_admin/chat')
  const channelBtn = page.getByRole('button', { name: 'Town Square' })
  await expect(channelBtn).toBeVisible({ timeout: 20_000 })
  await channelBtn.click()
  await expect(page.locator(`[aria-label="${CALL_LABEL}"]`)).toBeVisible({ timeout: 15_000 })

  // Sanity: getUserMedia fails with no devices available.
  const gum = await page.evaluate(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      s.getTracks().forEach((t) => t.stop())
      return 'ok'
    } catch (err) {
      return (err as Error).name
    }
  })
  expect(gum, 'sanity: no devices must be available').not.toBe('ok')

  await page.locator(`[aria-label="${CALL_LABEL}"]`).click()
  await expect(page.locator(`[aria-label="${LEAVE_LABEL}"]`).first()).toBeVisible({ timeout: 15_000 })

  // Poll for the whole window: the widget must never unmount.
  const leave = page.locator(`[aria-label="${LEAVE_LABEL}"]`).first()
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    await expect(leave).toBeVisible({ timeout: 1_000 })
    await page.waitForTimeout(500)
  }
  await expect(leave).toBeVisible({ timeout: 2_000 })

  expect(errors, errors.join('\n')).toEqual([])
})
