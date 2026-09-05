/**
 * CallWidget — the full-screen call UI for the active channel's call (the
 * "expanded view" in Mattermost Calls terms).
 *
 * Layout (restyled after mainstream call software — Zoom/Meet organization):
 *   ┌ header (glass): participants · timer · quality · state · error      ┐
 *   │ stage: presentation | speaker+filmstrip | grid  (see call-stage.tsx) │
 *   │ overlays: alerts · host notices · reactions                          │
 *   │ right panels: participants (host controls) · in-call chat            │
 *   └ controls (floating pill, see call-controls.tsx)                      ┘
 *
 * Keyboard (plugin parity): ctrl+shift+space mute, ctrl+shift+y hand,
 * ctrl+shift+e screen, alt+p participants, ctrl+shift+l leave; holding SPACE
 * is push-to-talk while muted.
 *
 * Subscribes to the calls store only; media plumbing lives in the client.
 */

'use client'

import { useEffect } from 'react'
import {
        AlertTriangle, Crown, Hand, Maximize2, Mic, MicOff, Minimize2, MonitorUp, PhoneOff, Signal, UserMinus, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { useLMSStore } from '@/store/lms-store'
import { useChatStore } from '@/lib/chat/store'
import { callsClient } from './calls-client'
import { useCallsStore } from './calls-store'
import { useCallsConfig } from './calls-config'
import { CallErrorBoundary } from './call-error-boundary'
import { CallTimer } from './call-timer'
import { CallStage } from './call-stage'
import { CallControls } from './call-controls'
import { bindCallsWebSocket } from './calls-events'
import { CallAlertBanners, JoinNotification, RecentlyJoinedToasts } from './call-alerts'
import { UserAvatar } from './user-avatar'
import { userDisplayName } from '@/lib/chat/types'
import { ParticipantsPanel } from './participants-panel'
import { CallChatPanel } from './call-chat-panel'
import type { CallQuality } from './calls-store'

/** Quality indicator glyph + color. */
function QualityBadge({ quality }: { quality: CallQuality }) {
        const { t } = useTranslation()
        const map: Record<CallQuality, { bars: number; color: string; label: string }> = {
                good: { bars: 3, color: 'text-emerald-400', label: t('chat.quality.good', 'Chất lượng tốt') },
                fair: { bars: 2, color: 'text-amber-400', label: t('chat.quality.fair', 'Chất lượng khá') },
                poor: { bars: 1, color: 'text-red-400', label: t('chat.quality.poor', 'Chất lượng kém') },
                unknown: { bars: 0, color: 'text-white/40', label: t('chat.quality.unknown', 'Không rõ chất lượng') },
        }
        const q = map[quality]
        return (
                <span
                        className={cn('flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1', q.color)}
                        title={q.label}
                        aria-label={q.label}
                >
                        <Signal className="h-3 w-3" />
                        <span className="text-[10px] font-semibold leading-none">{q.bars > 0 ? '●'.repeat(q.bars) : '–'}</span>
                </span>
        )
}

export function CallWidget({ channelId }: { channelId: string }) {
        const { t } = useTranslation()
        useCallsConfig()

        const status = useCallsStore((s) => s.status)
        const sessions = useCallsStore((s) => s.sessions)
        const sessionOrder = useCallsStore((s) => s.sessionOrder)
        const startAt = useCallsStore((s) => s.startAt)
        const screenStream = useCallsStore((s) => s.screenStream)
        const error = useCallsStore((s) => s.error)
        const quality = useCallsStore((s) => s.quality)
        const qualityAlert = useCallsStore((s) => s.qualityAlert)
        const minimized = useCallsStore((s) => s.minimized)
        const setMinimized = useCallsStore((s) => s.setMinimized)
        const participantsOpen = useCallsStore((s) => s.participantsOpen)
        const chatOpen = useCallsStore((s) => s.chatOpen)
        const micEnabled = useCallsStore((s) => s.micEnabled)

        const users = useChatStore((s) => s.users)
        const authUserId = useLMSStore((s) => s.authUser?.id)

        // Keep the call bound to the websocket for the app's lifetime.
        useEffect(() => {
                bindCallsWebSocket()
                callsClient.restoreDeviceSelections()
                void callsClient.updateDevices()
        }, [])

        // ── Keyboard shortcuts (plugin parity) ──────────────────────────
        useEffect(() => {
                const isTyping = (target: EventTarget | null): boolean => {
                        const el = target as HTMLElement | null
                        return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
                }

                const onKeyDown = (ev: KeyboardEvent) => {
                        if (isTyping(ev.target)) return
                        const mod = ev.ctrlKey || ev.metaKey
                        if (mod && ev.shiftKey && ev.code === 'Space') {
                                ev.preventDefault()
                                if (useCallsStore.getState().micEnabled) callsClient.mute()
                                else callsClient.unmute()
                        } else if (mod && ev.shiftKey && ev.key.toLowerCase() === 'y') {
                                ev.preventDefault()
                                if (useCallsStore.getState().handRaised) callsClient.lowerHand()
                                else callsClient.raiseHand()
                        } else if (mod && ev.shiftKey && ev.key.toLowerCase() === 'e') {
                                ev.preventDefault()
                                const s = useCallsStore.getState()
                                if (s.screenSharing) callsClient.stopScreenShare()
                                else void callsClient.startScreenShare().catch(() => void 0)
                        } else if ((ev.altKey && ev.key.toLowerCase() === 'p') || (mod && ev.shiftKey && ev.key.toLowerCase() === 'p')) {
                                ev.preventDefault()
                                useCallsStore.getState().toggleParticipants()
                        } else if (mod && ev.shiftKey && ev.key.toLowerCase() === 'l') {
                                ev.preventDefault()
                                callsClient.leave()
                        } else if (ev.code === 'Space' && !ev.repeat) {
                                // Push-to-talk while muted.
                                if (!useCallsStore.getState().micEnabled) {
                                        ev.preventDefault()
                                        callsClient.pushToTalk(true)
                                }
                        }
                }
                const onKeyUp = (ev: KeyboardEvent) => {
                        if (ev.code === 'Space') callsClient.pushToTalk(false)
                }
                const onBlur = () => callsClient.pushToTalk(false)

                window.addEventListener('keydown', onKeyDown)
                window.addEventListener('keyup', onKeyUp)
                window.addEventListener('blur', onBlur)
                return () => {
                        window.removeEventListener('keydown', onKeyDown)
                        window.removeEventListener('keyup', onKeyUp)
                        window.removeEventListener('blur', onBlur)
                }
        }, [])

        const nameFor = (userId: string): string => userDisplayName(users[userId] as never)
        const connecting = status === 'connecting' || status === 'reconnecting'
        const participants = sessionOrder.map((id) => sessions[id]).filter(Boolean)
        const currentSpeaker = participants.find((s) => s.voice) ?? null
        const speakerName = currentSpeaker && currentSpeaker.userId !== authUserId ? nameFor(currentSpeaker.userId) : ''

        if (minimized) {
                return (
                        <CallErrorBoundary>
                                <CompactCallBar onExpand={() => setMinimized(false)} nameFor={nameFor} />
                        </CallErrorBoundary>
                )
        }

        return (
                <CallErrorBoundary>
                        <div
                                className="fixed inset-0 z-50 flex flex-col bg-[#0b0f14] text-white"
                                style={{
                                        backgroundImage:
                                                'radial-gradient(1200px 500px at 50% -10%, rgba(56,189,248,0.06), transparent 60%), radial-gradient(900px 500px at 85% 110%, rgba(16,185,129,0.05), transparent 55%)',
                                }}
                        >
                                <div className="flex min-h-0 flex-1">
                                        <div className="flex min-w-0 flex-1 flex-col">
                                                {/* Header (glass) */}
                                                <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-black/30 px-4 backdrop-blur-xl">
                                                        <div className="flex min-w-0 items-center gap-2 text-white/90">
                                                                <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-sm font-medium">
                                                                        <Users className="h-3.5 w-3.5 text-white/60" />
                                                                        {participants.length}
                                                                </span>
                                                                <CallTimer startAt={startAt} />
                                                                <QualityBadge quality={quality} />
                                                                {connecting && (
                                                                        <span className="ml-1 flex items-center gap-1.5 text-xs text-amber-300">
                                                                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                                                                                {status === 'connecting'
                                                                                        ? t('chat.connecting', 'Đang kết nối…')
                                                                                        : t('chat.reconnecting', 'Đang kết nối lại…')}
                                                                        </span>
                                                                )}
                                                                {speakerName && !connecting && (
                                                                        <span className="ml-1 hidden max-w-[220px] truncate text-xs text-emerald-300/90 sm:inline">
                                                                                {t('chat.speaking', '{name} đang nói…', { name: speakerName })}
                                                                        </span>
                                                                )}
                                                        </div>
                                                        {error && (
                                                                <span className="flex max-w-[40%] items-center gap-1 truncate text-xs text-red-400">
                                                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                                        <span className="truncate">{error.message}</span>
                                                                </span>
                                                        )}
                                                        <div className="flex shrink-0 items-center gap-1">
                                                                <IconButton
                                                                        onClick={() => setMinimized(true)}
                                                                        label={t('chat.minimizeCall', 'Thu nhỏ cuộc gọi')}
                                                                >
                                                                        <Minimize2 className="h-4 w-4" />
                                                                </IconButton>
                                                        </div>
                                                </header>

                                                {/* Device/permission alert banners + degraded quality banner */}
                                                <CallAlertBanners />
                                                {qualityAlert && (
                                                        <div className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-300">
                                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                                {t('chat.quality.degraded', 'Chất lượng kết nối đang kém — âm thanh/video có thể bị giật.')}
                                                                <button
                                                                        type="button"
                                                                        className="underline underline-offset-2 hover:text-amber-200"
                                                                        onClick={() => useCallsStore.getState().setQualityAlert(false)}
                                                                >
                                                                        {t('common.dismiss', 'Bỏ qua')}
                                                                </button>
                                                        </div>
                                                )}

                                                {/* Stage */}
                                                <main className="relative flex min-h-0 flex-1 flex-col">
                                                        <CallStage />

                                                        {/* Overlays */}
                                                        <JoinNotification />
                                                        <RecentlyJoinedToasts />
                                                        <HostNotices />
                                                </main>

                                                {/* Controls (floating pill) */}
                                                <CallControls />
                                        </div>

                                        {/* Right panels */}
                                        {participantsOpen && <ParticipantsPanel />}
                                        {chatOpen && <CallChatPanel />}
                                </div>

                                {/* Muted hint while push-to-talk is available */}
                                {!micEnabled && (
                                        <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3.5 py-1.5 text-xs text-white/85 shadow-lg backdrop-blur-md">
                                                {t('chat.pushToTalkHint', 'Giữ Space để tạm bật tiếng')}
                                        </div>
                                )}
                        </div>
                </CallErrorBoundary>
        )
}

/** Small ghost header icon button. */
function IconButton({
        onClick,
        label,
        children,
}: {
        onClick: () => void
        label: string
        children: React.ReactNode
}) {
        return (
                <button
                        type="button"
                        onClick={onClick}
                        aria-label={label}
                        title={label}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                >
                        {children}
                </button>
        )
}

/** Transient host-control notices (top-right, auto-expiring). */
function HostNotices() {
        const { t } = useTranslation()
        const notices = useCallsStore((s) => s.notices)
        const users = useChatStore((s) => s.users)
        const hostUserId = useCallsStore((s) => s.hostUserId)
        const myUserId = useLMSStore((s) => s.authUser?.id)

        if (notices.length === 0) return null

        const nameFor = (userId: string): string => userDisplayName(users[userId] as never)

        return (
                <div className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col items-end gap-1.5">
                        {notices.slice(-4).map((n) => {
                                const actor = n.kind === 'host-changed' ? nameFor(n.actorUserId) : ''
                                let label: string | null = null
                                if (n.kind === 'host-changed') {
                                        label =
                                                n.mine || n.actorUserId === myUserId
                                                        ? t('chat.notices.youHost', 'Bạn là chủ trì mới')
                                                        : t('chat.notices.newHost', '{name} là chủ trì mới', { name: actor || '?' })
                                } else if (n.kind === 'lower-hand') {
                                        label = t('chat.notices.loweredHand', 'Chủ trì đã hạ tay của bạn')
                                } else if (n.kind === 'removed') {
                                        label = t('chat.notices.removed', '{name} đã bị mời ra khỏi cuộc gọi', { name: actor || '?' })
                                }
                                if (!label) return null
                                return (
                                        <div
                                                key={n.id}
                                                className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-900 shadow-lg animate-[fadeIn_150ms_ease-out]"
                                        >
                                                {n.kind === 'host-changed' ? <Crown className="h-3.5 w-3.5 text-amber-500" /> : null}
                                                {n.kind === 'lower-hand' ? <Hand className="h-3.5 w-3.5 text-amber-500" /> : null}
                                                {n.kind === 'removed' ? <UserMinus className="h-3.5 w-3.5 text-red-500" /> : null}
                                                <span className="max-w-[240px] truncate">{label}</span>
                                        </div>
                                )
                        })}
                        {/* hostUserId referenced to re-render on host changes */}
                        <span className="hidden">{hostUserId}</span>
                </div>
        )
}

/**
 * CompactCallBar — the minimized call UI (plugin parity: the call_widget's
 * collapsed state). A floating card at the bottom-right with the current
 * speaker's avatar + name, the call timer, presentation indicator, mic
 * toggle, expand, and leave, so the user can browse the app while staying in
 * the call.
 */
function CompactCallBar({ onExpand, nameFor }: { onExpand: () => void; nameFor: (userId: string) => string }) {
        const { t } = useTranslation()
        const sessions = useCallsStore((s) => s.sessions)
        const sessionOrder = useCallsStore((s) => s.sessionOrder)
        const startAt = useCallsStore((s) => s.startAt)
        const micEnabled = useCallsStore((s) => s.micEnabled)
        const status = useCallsStore((s) => s.status)
        const quality = useCallsStore((s) => s.quality)
        const screenStream = useCallsStore((s) => s.screenStream)
        const authUserId = useLMSStore((s) => s.authUser?.id)

        const participants = sessionOrder.map((id) => sessions[id]).filter((s): s is NonNullable<typeof s> => !!s)
        const speaker = participants.find((s) => s.voice) ?? participants.find((s) => s.userId !== authUserId) ?? participants[0]
        const speakerName = speaker ? nameFor(speaker.userId) : ''
        const connecting = status === 'connecting' || status === 'reconnecting'

        return (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-950/95 py-2.5 pl-3 pr-2.5 shadow-2xl backdrop-blur-xl">
                        {speaker && (
                                <UserAvatar
                                        userId={speaker.userId}
                                        displayName={speakerName || '?'}
                                        size="md"
                                        ringClassName={cn('rounded-full', speaker.voice && 'ring-2 ring-emerald-500 rounded-full')}
                                />
                        )}
                        <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                        <span className="max-w-[180px] truncate text-sm font-medium text-white/90">
                                                {connecting
                                                        ? t('chat.connecting', 'Đang kết nối…')
                                                        : speaker
                                                                ? t('chat.callWith', 'Cuộc gọi với {name}', { name: speakerName || '?' })
                                                                : t('chat.callInProgress', 'Cuộc gọi')}
                                        </span>
                                        {screenStream && (
                                                <span className="rounded-full bg-sky-500/20 p-1 text-sky-300" title={t('chat.presenting', 'Đang trình chiếu')}>
                                                        <MonitorUp className="h-3 w-3" />
                                                </span>
                                        )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-white/50">
                                        <CallTimer startAt={startAt} />
                                        <span>{participants.length}</span>
                                        <QualityBadge quality={quality} />
                                </div>
                        </div>
                        <div className="flex items-center gap-1">
                                <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={micEnabled ? t('chat.mute', 'Tắt tiếng') : t('chat.unmute', 'Bật tiếng')}
                                        onClick={() => (micEnabled ? callsClient.mute() : callsClient.unmute())}
                                        className="h-9 w-9 rounded-full text-white/80 hover:bg-white/10 hover:text-white"
                                >
                                        {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
                                </Button>
                                <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('chat.expandCall', 'Mở rộng cuộc gọi')}
                                        onClick={onExpand}
                                        className="h-9 w-9 rounded-full text-white/80 hover:bg-white/10 hover:text-white"
                                >
                                        <Maximize2 className="h-4 w-4" />
                                </Button>
                                <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('chat.leaveCall', 'Rời cuộc gọi')}
                                        onClick={() => callsClient.leave()}
                                        className="h-9 w-9 rounded-full text-red-400 hover:bg-red-500/15 hover:text-red-300"
                                >
                                        <PhoneOff className="h-4 w-4" />
                                </Button>
                        </div>
                </div>
        )
}
