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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { useLMSStore } from '@/store/lms-store'
import { useChatStore } from '@/lib/chat/store'
import { callsClient } from './calls-client'
import { useCallsStore, type IncomingCall } from './calls-store'
import { startRinging, type RingHandle } from './calls-sounds'

export function IncomingCallStack({ onJoinRequested }: { onJoinRequested: (channelId: string) => void }) {
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
                        />
                        {rest.map((c) => (
                                <IncomingCallCondensed
                                        key={c.callId}
                                        call={c}
                                        onJoin={(ch) => { onJoinRequested(ch); dismissIncomingCall(c.callId) }}
                                        onIgnore={() => dismissIncomingCall(c.callId)}
                                />
                        ))}
                </div>
        )
}

function useRing(call: IncomingCall | null, enabled: boolean): void {
        const ringRef = useRef<RingHandle | null>(null)
        useEffect(() => {
                if (!call || !enabled) return
                ringRef.current = startRinging()
                return () => {
                        ringRef.current?.stop()
                        ringRef.current = null
                }
        }, [call?.callId, enabled])
}

function useDesktopNotification(call: IncomingCall | null, enabled: boolean, callerName: string): void {
        const notifiedRef = useRef<string>('')
        useEffect(() => {
                if (!call || !enabled || notifiedRef.current === call.callId) return
                if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') return
                notifiedRef.current = call.callId
                try {
                        if ('Notification' in window && Notification.permission === 'default') {
                                void Notification.requestPermission()
                        }
                        if ('Notification' in window && Notification.permission === 'granted') {
                                const n = new Notification('Cuộc gọi đến', { body: `${callerName} đang mời bạn gọi` })
                                n.onclick = () => { window.focus(); n.close() }
                                setTimeout(() => { try { n.close() } catch { /* ignore */ } }, 6000)
                        }
                } catch {
                        // notifications blocked — ringing is the fallback
                }
        }, [call?.callId, enabled, callerName])
}

function IncomingCallCard({ call, expanded, onJoin, onIgnore }: {
        call: IncomingCall
        expanded?: boolean
        onJoin: (channelId: string) => void
        onIgnore: () => void
}) {
        const { t } = useTranslation()
        const users = useChatStore((s) => s.users)
        const myId = useLMSStore((s) => s.authUser?.id)
        const inCall = useCallsStore((s) => s.status !== 'disconnected' && s.status !== 'error')
        const ringingEnabled = useCallsStore((s) => s.config.ringingEnabled)

        const caller = users[call.callerId] as Record<string, any> | undefined
        const callerName = caller
                ? `${caller.firstname ?? caller.first_name ?? ''} ${caller.lastname ?? caller.last_name ?? ''}`.trim() || caller.username
                : t('chat.incoming.someone', 'Ai đó')

        useRing(call, !!expanded && ringingEnabled && !inCall)
        useDesktopNotification(call, !!expanded && ringingEnabled, callerName)

        const initials = callerName.slice(0, 2).toUpperCase() || '?'

        return (
                <div
                        className="w-[280px] rounded-xl bg-emerald-600 text-white p-3 shadow-2xl ring-1 ring-emerald-400/50"
                        role="alert"
                        aria-live="assertive"
                >
                        <div className="flex items-center gap-2.5">
                                <Avatar className="h-9 w-9 border border-white/30">
                                        <AvatarFallback className="bg-emerald-800/60 text-white">{initials}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium truncate">
                                                {t('chat.incoming.inviting', '{name} đang mời bạn gọi', { name: callerName })}
                                        </div>
                                        <div className="text-xs text-emerald-100/90">{t('chat.incoming.joinNow', 'Tham gia ngay')}</div>
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

function IncomingCallCondensed({ call, onJoin, onIgnore }: {
        call: IncomingCall
        onJoin: (channelId: string) => void
        onIgnore: () => void
}) {
        const { t } = useTranslation()
        const users = useChatStore((s) => s.users)
        const caller = users[call.callerId] as Record<string, any> | undefined
        const callerName = caller
                ? `${caller.firstname ?? caller.first_name ?? ''} ${caller.lastname ?? caller.last_name ?? ''}`.trim() || caller.username
                : t('chat.incoming.someone', 'Ai đó')
        const initials = callerName.slice(0, 2).toUpperCase() || '?'
        const [hover, setHover] = useState(false)

        return (
                <div
                        className="flex w-[280px] items-center gap-2 rounded-lg bg-emerald-700/90 text-white px-2.5 py-2 shadow-lg"
                        onMouseEnter={() => setHover(true)}
                        onMouseLeave={() => setHover(false)}
                >
                        <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-emerald-800/60 text-white text-xs">{initials}</AvatarFallback>
                        </Avatar>
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
