/**
 * Incoming call notifications — ports the plugin webapp's incoming_calls stack
 * (call_incoming.tsx + hooks). DM/GM calls the user is NOT in surface a green
 * card with Join/Ignore; ringing plays a WebAudio loop (max 30s) once per
 * call; a desktop notification fires when the tab is hidden.
 *
 * Mount once at the chat root (IncomingCallStack).
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { useLMSStore } from '@/store/lms-store'
import { useChatStore } from '@/lib/chat/store'
import { callsClient } from './calls-client'
import { useCallsStore, type IncomingCall } from './calls-store'
import { startRinging, type RingHandle } from './calls-sounds'
import { shouldRingFor, markRangFor, shouldNotifyFor, markNotifiedFor } from './calls-events'
import { UserAvatar } from './user-avatar'
import { userDisplayName } from '@/lib/chat/types'

export function IncomingCallStack({ onJoinRequested, onOpenChannel }: {
        onJoinRequested: (channelId: string) => void
        /** Navigate to the channel (card click / notification deep-link). */
        onOpenChannel: (channelId: string) => void
}) {
        const { t } = useTranslation()
        const incomingCalls = useCallsStore((s) => s.incomingCalls)
        const dismissIncomingCall = useCallsStore((s) => s.dismissIncomingCall)

        if (incomingCalls.length === 0) return null

        // Newest call expanded; older ones condensed.
        const [newest, ...rest] = [...incomingCalls].sort((a, b) => b.startAt - a.startAt)

        return (
                <div className="fixed bottom-6 left-6 z-[60] flex flex-col-reverse gap-2">
                        <IncomingCallCard
                                call={newest}
                                expanded
                                onJoin={(ch) => { onJoinRequested(ch); dismissIncomingCall(newest.callId) }}
                                onIgnore={() => dismissIncomingCall(newest.callId)}
                                onOpenChannel={onOpenChannel}
                        />
                        {rest.map((c) => (
                                <IncomingCallCondensed
                                        key={c.callId}
                                        call={c}
                                        onJoin={(ch) => { onJoinRequested(ch); dismissIncomingCall(c.callId) }}
                                        onIgnore={() => dismissIncomingCall(c.callId)}
                                        onOpenChannel={onOpenChannel}
                                />
                        ))}
                </div>
        )
}

function useRing(call: IncomingCall | null, enabled: boolean): void {
        const ringRef = useRef<RingHandle | null>(null)
        useEffect(() => {
                if (!call || !enabled) return
                // Ring once per call, forever (plugin parity: DID_RING_FOR_CALL) —
                // a remount or a re-broadcast must not restart the 30s loop.
                if (!shouldRingFor(call.callId)) return
                markRangFor(call.callId)
                ringRef.current = startRinging()
                return () => {
                        ringRef.current?.stop()
                        ringRef.current = null
                }
        }, [call?.callId, enabled])
}

function useDesktopNotification(call: IncomingCall | null, enabled: boolean, callerName: string, onOpenChannel: (channelId: string) => void): void {
        useEffect(() => {
                if (!call || !enabled) return
                if (!shouldNotifyFor(call.callId)) return
                if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') return
                markNotifiedFor(call.callId)
                try {
                        if ('Notification' in window && Notification.permission === 'default') {
                                void Notification.requestPermission()
                        }
                        if ('Notification' in window && Notification.permission === 'granted') {
                                const n = new Notification(callerName || 'Cuộc gọi đến', { body: `${callerName} đang mời bạn gọi` })
                                n.onclick = () => { window.focus(); onOpenChannel(call.channelId); n.close() }
                                setTimeout(() => { try { n.close() } catch { /* ignore */ } }, 6000)
                        }
                } catch {
                        // notifications blocked — ringing is the fallback
                }
        }, [call?.callId, enabled, callerName])
}

function IncomingCallCard({ call, expanded, onJoin, onIgnore, onOpenChannel }: {
        call: IncomingCall
        expanded?: boolean
        onJoin: (channelId: string) => void
        onIgnore: () => void
        onOpenChannel: (channelId: string) => void
}) {
        const { t } = useTranslation()
        const users = useChatStore((s) => s.users)
        const myId = useLMSStore((s) => s.authUser?.id)
        const inCall = useCallsStore((s) => s.status !== 'disconnected' && s.status !== 'error')
        const ringingEnabled = useCallsStore((s) => s.config.ringingEnabled)

        const caller = users[call.callerId]
        const callerName = caller ? userDisplayName(caller as never) : t('chat.incoming.someone', 'Ai đó')
        const channel = useChatStore.getState().channels[call.channelId] as { type?: string } | undefined
        const isGroup = channel?.type === 'G'

        useRing(call, !!expanded && ringingEnabled && !inCall)
        useDesktopNotification(call, !!expanded && ringingEnabled, callerName, onOpenChannel)


        return (
                <div
                        className="w-[280px] cursor-pointer rounded-xl bg-emerald-600 text-white p-3 shadow-2xl ring-1 ring-emerald-400/50 hover:bg-emerald-500"
                        role="alert"
                        aria-live="assertive"
                        onClick={() => onOpenChannel(call.channelId)}
                >
                        <div className="flex items-center gap-2.5">
                                <UserAvatar userId={call.callerId} displayName={callerName} size="md" className="border border-white/30" />
                                <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium truncate">
                                                {t('chat.incoming.inviting', '{name} đang mời bạn gọi', { name: callerName })}
                                        </div>
                                        <div className="text-xs text-emerald-100/90">
                                                {isGroup ? t('chat.incoming.groupHint', 'Cuộc gọi nhóm') : t('chat.incoming.joinNow', 'Tham gia ngay')}
                                        </div>
                                </div>
                        </div>
                        <div className="mt-2.5 flex gap-2">
                                <Button
                                        size="sm"
                                        className="flex-1 bg-white text-emerald-700 hover:bg-emerald-50"
                                        onClick={() => onJoin(call.channelId)}
                                >
                                        <Phone className="mr-1 h-3.5 w-3.5" />
                                        {t('chat.incoming.join', 'Tham gia')}
                                </Button>
                                <Button
                                        size="sm"
                                        variant="ghost"
                                        className="flex-1 text-white hover:bg-white/15"
                                        onClick={onIgnore}
                                >
                                        <PhoneOff className="mr-1 h-3.5 w-3.5" />
                                        {t('chat.incoming.ignore', 'Bỏ qua')}
                                </Button>
                        </div>
                        {myId === undefined ? null : null}
                </div>
        )
}

function IncomingCallCondensed({ call, onJoin, onIgnore, onOpenChannel }: {
        call: IncomingCall
        onJoin: (channelId: string) => void
        onIgnore: () => void
        onOpenChannel: (channelId: string) => void
}) {
        const { t } = useTranslation()
        const users = useChatStore((s) => s.users)
        const caller = users[call.callerId]
        const callerName = caller ? userDisplayName(caller as never) : t('chat.incoming.someone', 'Ai đó')
        const [hover, setHover] = useState(false)

        return (
                <div
                        className="flex w-[280px] cursor-pointer items-center gap-2 rounded-lg bg-emerald-700/90 text-white px-2.5 py-2 shadow-lg hover:bg-emerald-600"
                        onMouseEnter={() => setHover(true)}
                        onMouseLeave={() => setHover(false)}
                        onClick={() => onOpenChannel(call.channelId)}
                >
                        <UserAvatar userId={call.callerId} displayName={callerName} size="sm" />
                        <span className="min-w-0 flex-1 text-xs truncate">
                                {t('chat.incoming.from', 'Cuộc gọi từ {name}', { name: callerName })}
                        </span>
                        {hover ? (
                                <div className="flex gap-1">
                                        <Button size="sm" className="h-6 bg-white text-emerald-700 hover:bg-emerald-50 px-2" onClick={() => onJoin(call.channelId)}>
                                                <Phone className="h-3 w-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-white hover:bg-white/15" onClick={onIgnore}>
                                                <PhoneOff className="h-3 w-3" />
                                        </Button>
                                </div>
                        ) : (
                                <Phone className="h-3.5 w-3.5 animate-pulse" />
                        )}
                </div>
        )
}
