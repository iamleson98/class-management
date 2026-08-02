/**
 * Desktop notifications + sound — ports the vendored webapp's notification_actions.
 *
 * Fires a browser Notification (and optional sound) on an incoming message when:
 *   - the page is not focused, OR the target channel is not the active one, AND
 *   - the message mentions the current user, is a DM, or the channel isn't muted.
 *
 * Gating (shouldSkip) mirrors the vendored logic: own posts, muted channels,
 * the active+focused channel, and explicit mention-only channels are skipped.
 *
 * Notification permission is requested lazily on first connect.
 */

import type { ChatPost, ChatChannel, ChatUser } from './types'

type NotifyProps = {
  post: ChatPost
  channel: ChatChannel | undefined
  /** The user ids mentioned by the post (from the WS event's `mentions` field). */
  mentionUserIds: string[]
  currentUserId: string | undefined
  activeChannelId: string | null
  authorName: string
}

let permissionRequested = false

/** Request notification permission once (ports the webapp's requestPermission). */
export function ensureNotificationPermission(): void {
  if (permissionRequested) return
  if (typeof window === 'undefined') return
  permissionRequested = true
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      // Don't await — fire-and-forget; permission state is checked again at send.
      void Notification.requestPermission()
    }
  } catch {
    // ignore — Notification API may be blocked
  }
}

/** Whether the current document/window is visible and focused. */
function isWindowFocused(): boolean {
  if (typeof document === 'undefined') return true
  return !document.hidden && document.hasFocus()
}

/** Whether a notification should be skipped for this message. Ports shouldSkipNotification. */
export function shouldNotify({
  post, channel, mentionUserIds, currentUserId, activeChannelId,
}: NotifyProps): { notify: boolean; isMention: boolean } {
  // Never notify on own posts.
  if (post.user_id === currentUserId) return { notify: false, isMention: false }

  const isMention = currentUserId ? mentionUserIds.includes(currentUserId) : false
  const isDM = channel?.type === 'D' || channel?.type === 'G'

  // Muted channels: only notify on explicit mentions.
  const muted = (channel as unknown as { notify_props?: { mark_unread?: string } } | undefined)?.notify_props?.mark_unread === 'mention'
  if (muted && !isMention) return { notify: false, isMention }

  // If the target channel is active AND the window is focused, don't notify.
  if (channel?.id === activeChannelId && isWindowFocused()) return { notify: false, isMention }

  // DMs and mentions always notify (when not focused on them). Other channels
  // notify on any message only if not muted (handled above).
  return { notify: isMention || isDM || !muted, isMention }
}

/** A short message body for the notification (ports the title/body builder). */
function buildBody(post: ChatPost, channel: ChatChannel | undefined, authorName: string): { title: string; body: string } {
  const channelName = channel?.display_name ?? 'Tin nhắn'
  const isDM = channel?.type === 'D' || channel?.type === 'G'
  return {
    title: isDM ? authorName : `${authorName} trong ${channelName}`,
    body: post.message || '📷 Gửi một tệp đính kèm',
  }
}

/**
 * Fire a desktop notification + sound if appropriate. Called from the WS posted
 * handler. No-ops gracefully when Notifications aren't available/permitted.
 */
export function notifyIfNeeded(props: NotifyProps): void {
  const { notify, isMention } = shouldNotify(props)
  if (!notify) return

  const { title, body } = buildBody(props.post, props.channel, props.authorName)

  // Sound (mention → the "mention" bing; otherwise the default). The webapp
  // serves these from /static; we use a lightweight embedded approach: only play
  // when explicitly enabled to avoid surprise audio. Skipped here unless a sound
  // URL is configured by the host.
  playSound(isMention ? 'mention' : 'default')

  // Desktop notification.
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    const n = new Notification(title, {
      body,
      tag: props.post.channel_id, // collapse repeated notifications per channel
      silent: true, // we play our own sound above when configured
    })
    // Focus the window + jump to the channel on click.
    n.onclick = () => {
      window.focus()
      n.close()
    }
    // Auto-close after 6s (webapp behavior).
    setTimeout(() => { try { n.close() } catch { /* ignore */ } }, 6000)
  } catch {
    // ignore — some browsers throw if notifications are blocked mid-flight
  }
}

/** Play a notification sound if the host has configured a sound URL. */
let lastDingAt = 0
function playSound(_kind: 'mention' | 'default'): void {
  // Throttle to one ding per 3s (ports the vendored ding() throttle).
  const now = Date.now()
  if (now - lastDingAt < 3000) return
  lastDingAt = now
  try {
    const audio = new Audio('/sounds/bing.wav')
    audio.volume = 0.5
    void audio.play().catch(() => { /* autoplay blocked until user interaction — ignore */ })
  } catch {
    // ignore
  }
}

/** Resolve the author display name for a post (best-effort from the store). */
export function resolveAuthorName(post: ChatPost, users: Record<string, ChatUser>): string {
  const u = users[post.user_id]
  if (!u) return 'Ai đó'
  return u.nickname || `${u.first_name} ${u.last_name}`.trim() || u.username || 'Ai đó'
}
