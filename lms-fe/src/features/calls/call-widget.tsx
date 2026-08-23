/**
 * CallWidget — the full-screen call UI for the active channel's call.
 *
 * Layout (mirrors the Mattermost Calls expanded view, restyled to lms-fe):
 *   ┌ header: title · participants · timer · connection state · error ┐
 *   │ screen stage (when someone shares) — dominant view + sharer tag  │
 *   │ participant grid (auto columns ≤3, scrollable)                   │
 *   └ controls: mute · camera · share · hand · host menu · leave ┘
 *
 * Subscribes to the calls store only; media plumbing lives in the client.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { Users, AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { useLMSStore } from '@/store/lms-store'
import { useChatStore } from '@/lib/chat/store'
import { callsClient } from './calls-client'
import { useCallsStore } from './calls-store'
import { CallTimer } from './call-timer'
import { CallTile } from './call-tile'
import { CallControls } from './call-controls'
import { bindCallsWebSocket } from './calls-events'

export function CallWidget({ channelId }: { channelId: string }) {
        const { t } = useTranslation()

        const status = useCallsStore((s) => s.status)
        const sessions = useCallsStore((s) => s.sessions)
        const sessionOrder = useCallsStore((s) => s.sessionOrder)
        const startAt = useCallsStore((s) => s.startAt)
        const videoStreams = useCallsStore((s) => s.videoStreams)
        const screenStream = useCallsStore((s) => s.screenStream)
        const cameraEnabled = useCallsStore((s) => s.cameraEnabled)
        const error = useCallsStore((s) => s.error)

        const users = useChatStore((s) => s.users)
        const authUserId = useLMSStore((s) => s.authUser?.id)

        // Keep the call bound to the websocket for the app's lifetime.
        useEffect(() => {
                bindCallsWebSocket()
        }, [])

        // Self-preview stream (the client owns the local MediaStream). Derived
        // from the camera flag without an effect: the stream exists once the
        // client acquired it at join/enable time.
        const localStream = cameraEnabled ? callsClient.getLocalStream() : null

        const screenVideoRef = useRef<HTMLVideoElement>(null)
        useEffect(() => {
                if (screenVideoRef.current && screenStream) {
                        screenVideoRef.current.srcObject = screenStream.stream
                }
        }, [screenStream])

        const participants = sessionOrder
                .map((id) => sessions[id])
                .filter((s): s is NonNullable<typeof s> => !!s)

        const nameFor = (userId: string): string => {
                const u = users[userId] as Record<string, any> | undefined
                if (!u) return ''
                const first = u.firstname ?? u.first_name ?? ''
                const last = u.lastname ?? u.last_name ?? ''
                return `${first} ${last}`.trim() || u.username || ''
        }

        const connecting = status === 'connecting' || status === 'reconnecting'

        return (
                <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-white/10 shrink-0">
                                <div className="flex items-center gap-2 text-white/90 min-w-0">
                                        <Users className="h-4 w-4 shrink-0" />
                                        <span className="text-sm font-medium truncate">
                                                {t('chat.callInProgress', 'Cuộc gọi')} · {participants.length}
                                        </span>
                                        <CallTimer startAt={startAt} />
                                        {connecting && (
                                                <span className="text-xs text-amber-400 ml-1">
                                                        {status === 'connecting' ? t('chat.connecting', 'Đang kết nối…') : t('chat.reconnecting', 'Đang kết nối lại…')}
                                                </span>
                                        )}
                                </div>
                                {error && (
                                        <span className="flex items-center gap-1 text-xs text-red-400 truncate max-w-[50%]">
                                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{error.message}</span>
                                        </span>
                                )}
                        </div>

                        {/* Screen stage */}
                        {screenStream && (
                                <div className="relative bg-black flex items-center justify-center min-h-0 flex-[3] p-2">
                                        <video
                                                ref={screenVideoRef}
                                                autoPlay
                                                playsInline
                                                className="max-w-full max-h-full rounded-lg object-contain"
                                        />
                                        <span className="absolute top-4 left-4 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm max-w-[60%] truncate">
                                                {t('chat.screenShareBy', 'Màn hình của')} {nameFor(sessions[screenStream.sessionId]?.userId ?? '') || '?'}
                                        </span>
                                </div>
                        )}

                        {/* Participants grid */}
                        <div className={`overflow-auto p-4 min-h-0 ${screenStream ? 'flex-1' : 'flex-1 flex items-center'}`}>
                                <div
                                        className="grid gap-3 w-full"
                                        style={{
                                                gridTemplateColumns: `repeat(${Math.min(participants.length || 1, 3)}, minmax(0, 1fr))`,
                                                maxWidth: participants.length > 3 ? undefined : 'min(100%, 720px)',
                                                margin: '0 auto',
                                                alignContent: 'center',
                                        }}
                                >
                                        {participants.length === 0 ? (
                                                <div className="col-span-full flex items-center justify-center text-white/50 text-sm py-12">
                                                        {t('chat.waitingForOthers', 'Đang chờ người khác tham gia…')}
                                                </div>
                                        ) : (
                                                participants.map((s) => (
                                                        <CallTile
                                                                key={s.sessionId}
                                                                session={s}
                                                                displayName={nameFor(s.userId)}
                                                                isSelf={s.userId === authUserId}
                                                                mirror={s.userId === authUserId}
                                                                stream={s.userId === authUserId ? undefined : videoStreams[s.sessionId]}
                                                                selfStream={s.userId === authUserId ? localStream : undefined}
                                                        />
                                                ))
                                        )}
                                </div>
                        </div>

                        {/* Controls */}
                        <CallControls />
                </div>
        )
}
