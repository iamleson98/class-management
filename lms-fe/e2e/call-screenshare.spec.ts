import { test, expect, type Page } from '@playwright/test'
import { mockCallsBackend } from './call-hub-mock'

/**
 * E2E — the presentation (screen share) mode: starting a share must switch
 * the stage to the framed presentation surface with the presenter chip and
 * the stop control, and the browser must notify the backend
 * (custom_calls_screen_on). Stopping returns to the normal stage.
 *
 * Chromium auto-selects a capture source via
 * --auto-select-desktop-capture-source, so getDisplayMedia resolves without
 * user interaction.
 */

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--auto-select-desktop-capture-source=Entire screen',
    ],
  },
})

const CALL_LABEL = 'Bắt đầu cuộc gọi'
const LEAVE_LABEL = 'Rời cuộc gọi'
const SHARE_LABEL = 'Chia sẻ màn hình'
const PRESENTER_CHIP = 'Bạn đang chia sẻ màn hình'
const STOP_LABEL = 'Dừng chia sẻ'

const errors: string[] = []

test('screen share enters presentation mode and stopping restores the stage', async ({ page }) => {
  errors.length = 0
  page.on('pageerror', (err) => errors.push(String(err)))
  const hub = await mockCallsBackend(page)

  await page.goto('/#lms_admin/chat')
  const channelBtn = page.getByRole('button', { name: 'Town Square' })
  await expect(channelBtn).toBeVisible({ timeout: 20_000 })
  await channelBtn.click()
  await expect(page.locator(`[aria-label="${CALL_LABEL}"]`)).toBeVisible({ timeout: 15_000 })
  await page.locator(`[aria-label="${CALL_LABEL}"]`).click()
  await expect(page.locator(`[aria-label="${LEAVE_LABEL}"]`).first()).toBeVisible({ timeout: 15_000 })

  // Start the share from the control bar.
  await page.locator(`[aria-label="${SHARE_LABEL}"]`).click()

  // The presentation stage takes over: presenter chip + framed surface.
  await expect(page.getByText(PRESENTER_CHIP)).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('main video').first()).toBeVisible({ timeout: 5_000 })

  // The browser notified the backend about the share (with its stream id).
  await expect
    .poll(() => hub.actions.some((a) => a.action === 'custom_calls_screen_on'), { timeout: 10_000 })
    .toBe(true)

  // Stopping the share (the stage's red pill) restores the regular stage.
  await page.getByRole('button', { name: STOP_LABEL }).first().click()
  await expect(page.getByText(PRESENTER_CHIP)).toBeHidden({ timeout: 10_000 })
  await expect
    .poll(() => hub.actions.some((a) => a.action === 'custom_calls_screen_off'), { timeout: 10_000 })
    .toBe(true)

  // The call itself is still alive after the share cycle.
  await expect(page.locator(`[aria-label="${LEAVE_LABEL}"]`).first()).toBeVisible({ timeout: 5_000 })
  expect(errors, errors.join('\n')).toEqual([])
})

/** Keep the Page type import used for readability in helper signatures. */
export type { Page }
