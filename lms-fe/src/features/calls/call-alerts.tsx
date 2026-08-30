/**
 * Call alert banners + transient notifications — ports the plugin webapp's
 * GlobalBanner/WidgetBanner CallAlertConfigs (missing devices / permissions /
 * fallback notices) and the join notification ("You're muted…").
 *
 * Alerts live in the calls store (deduped by kind, dismissable) and render as
 * a stacked strip at the top of the call stage.
 */

'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Mic, MicOff, MonitorX, VideoOff, VolumeX } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { useChatStore } from '@/lib/chat/store'
import { userDisplayName } from '@/lib/chat/types'
import { useCallsStore, type CallAlert } from './calls-store'
import { UserAvatar } from './user-avatar'

const ALERT_ICONS: Record<CallAlert['kind'], React.ReactNode> = {
        'audio-input-missing': <MicOff className="h-4 w-4 shrink-0" />,
        'audio-input-permissions': <VolumeX className="h-4 w-4 shrink-0" />,
        'video-input-missing': <VideoOff className="h-4 w-4 shrink-0" />,
        'video-input-permissions': <VideoOff className="h-4 w-4 shrink-0" />,
        'screen-permissions': <MonitorX className="h-4 w-4 shrink-0" />,
        'audio-input-fallback': <Mic className="h-4 w-4 shrink-0" />,
        'audio-output-fallback': <VolumeX className="h-4 w-4 shrink-0" />,
}

export function CallAlertBanners() {
        const { t } = useTranslation()
        const alerts = useCallsStore((s) => s.alerts)
        const dismiss = useCallsStore((s) => s.expireAlert)

        if (alerts.length === 0) return null

        return (
                <div className="flex flex-col gap-1 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5">
                        {alerts.map((a) => (
                                <div key={a.id} className="flex items-center gap-2 text-xs text-amber-300" role="alert">
                                        {ALERT_ICONS[a.kind] ?? <AlertTriangle className="h-4 w-4 shrink-0" />}
                                        <span className="min-w-0 flex-1">{alertCopy(t, a)}</span>
                                        <button
                                                type="button"
                                                className="shrink-0 underline underline-offset-2 hover:text-amber-200"
                                                onClick={() => dismiss(a.id)}
                                        >
                                                {t('common.dismiss', 'Bỏ qua')}
                                        </button>
                                </div>
                        ))}
                </div>
        )
}

function alertCopy(t: (k: string, f?: string, v?: Record<string, string>) => string, a: CallAlert): string {
        switch (a.kind) {
                case 'audio-input-missing':
                        return t('chat.alerts.audioMissing', 'Không tìm thấy micro. Người khác sẽ không nghe thấy bạn.')
                case 'audio-input-permissions':
                        return t('chat.alerts.audioPermissions', 'Quyền truy cập micro bị từ chối. Hãy cấp quyền trong trình duyệt để nói.')
                case 'video-input-missing':
                        return t('chat.alerts.videoMissing', 'Không tìm thấy camera.')
                case 'video-input-permissions':
                        return t('chat.alerts.videoPermissions', 'Quyền truy cập camera bị từ chối.')
                case 'screen-permissions':
                        return t('chat.alerts.screenPermissions', 'Không có quyền chia sẻ màn hình.')
                case 'audio-input-fallback':
                        return t('chat.alerts.audioFallback', 'Thiết bị âm thanh đầu vào đã chuyển sang {device}', {
                                device: a.deviceLabel || t('chat.alerts.defaultDevice', 'thiết bị mặc định'),
                        })
                case 'audio-output-fallback':
                        return t('chat.alerts.audioOutputFallback', 'Thiết bị phát âm thanh đã chuyển sang {device}', {
                                device: a.deviceLabel || t('chat.alerts.defaultDevice', 'thiết bị mặc định'),
                        })
        }
}

/**
 * Join notification — "You're muted. Select the mic icon to unmute." shown
 * for a few seconds after joining (plugin parity: join_notification).
 */
export function JoinNotification() {
        const { t } = useTranslation()
        const micEnabled = useCallsStore((s) => s.micEnabled)
        const status = useCallsStore((s) => s.status)
        // Visible from mount (the widget mounts on join); the effect only HIDES
        // it after the window elapses (async setState is rule-compliant).
        const [visible, setVisible] = useState(true)

        useEffect(() => {
                if (status !== 'connected') return
                const timer = window.setTimeout(() => setVisible(false), 8_000)
                return () => window.clearTimeout(timer)
        }, [status])

        if (!visible || status !== 'connected') return null

        return (
                <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
                        <div className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs text-white/90 backdrop-blur-sm">
                                {micEnabled ? <Mic className="h-3.5 w-3.5 text-emerald-400" /> : <MicOff className="h-3.5 w-3.5 text-amber-400" />}
                                <span>
                                        {micEnabled
                                                ? t('chat.joinNotice.unmuted', 'Đang bật tiếng — mọi người có thể nghe thấy bạn.')
                                                : t('chat.joinNotice.muted', 'Đang tắt tiếng. Nhấn biểu tượng micro để bật.')}
                                </span>
                        </div>
                </div>
        )
}

/**
 * "X has joined the call." transient bars for recent joiners (plugin parity:
 * recentlyJoinedUsers, 5s expiry).
 */
export function RecentlyJoinedToasts() {
        const { t } = useTranslation()
        const recentlyJoined = useCallsStore((s) => s.recentlyJoined)
        const users = useChatStore((s) => s.users)

        if (recentlyJoined.length === 0) return null

        return (
                <div className="pointer-events-none absolute left-1/2 top-12 z-20 flex -translate-x-1/2 flex-col items-center gap-1">
                        {recentlyJoined.slice(-3).map((r) => {
                                const name = userDisplayName(users[r.userId])
                                return (
                                        <div
                                                key={`${r.userId}-${r.at}`}
                                                className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs text-white/90 backdrop-blur-sm"
                                        >
                                                <UserAvatar userId={r.userId} displayName={name} size="xs" />
                                                <span>
                                                        {t('chat.joinNotice.userJoined', '{name} đã tham gia cuộc gọi', { name: name || t('chat.incoming.someone', 'Ai đó') })}
                                                </span>
                                        </div>
                                )
                        })}
                </div>
        )
}
