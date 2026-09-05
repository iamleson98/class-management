/**
 * call-tile — one participant tile in the call grid / filmstrip.
 *
 * Shows the remote camera stream when the participant broadcasts video
 * (bound by origin session id), otherwise their avatar. Speaking state
 * (SFU VAD) highlights the border with an animated emerald ring; overlays
 * carry the name chip, host tag, mute and raised-hand indicators. The local
 * participant renders the mirrored self-preview from the client's local
 * stream.
 *
 * Interactions (video modes only): hovering reveals a pin toggle that asks
 * the stage to focus this participant (see call-stage.tsx).
 */

'use client'

import { useEffect, useRef } from 'react'
import { Hand, MicOff, Pin, PinOff, Presentation, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import type { CallSession } from './calls-store'
import { UserAvatar } from './user-avatar'

export function CallTile({
        session,
        displayName,
        isSelf,
        mirror,
        stream,
        selfStream,
        pinned = false,
        onTogglePin,
        presenting = false,
        connecting = false,
        size = 'full',
}: {
        session: CallSession
        displayName: string
        isSelf: boolean
        /** Mirror the video (self-view only). */
        mirror: boolean
        /** Remote video stream for this participant, when broadcasting. */
        stream?: MediaStream
        /** The local self-preview stream (used when isSelf). */
        selfStream?: MediaStream | null
        /** This tile is pinned as the stage focus (video modes). */
        pinned?: boolean
        /** Pin/unpin callback. Omitted in avatar-only contexts. */
        onTogglePin?: (sessionId: string) => void
        /** This participant is presenting their screen. */
        presenting?: boolean
        /** Show the connecting shimmer (self tile while joining). */
        connecting?: boolean
        /** full = grid/stage tiles, thumb = filmstrip tiles. */
        size?: 'full' | 'thumb'
}) {
        const { t } = useTranslation()
        const videoRef = useRef<HTMLVideoElement>(null)
        const activeStream = isSelf ? selfStream : stream

        useEffect(() => {
                if (videoRef.current && activeStream) {
                        videoRef.current.srcObject = activeStream
                }
        }, [activeStream])

        const showVideo = !!activeStream && (isSelf || session.video)
        const thumb = size === 'thumb'

        return (
                <div
                        className={cn(
                                'group relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] ring-1 transition-shadow duration-300',
                                thumb ? 'ring-white/10' : 'shadow-[0_4px_24px_rgba(0,0,0,0.35)]',
                                session.voice
                                        ? 'ring-2 ring-emerald-400/90 shadow-[0_0_0_4px_rgba(52,211,153,0.12),0_4px_24px_rgba(0,0,0,0.35)]'
                                        : presenting
                                                ? 'ring-2 ring-sky-400/80'
                                                : 'ring-white/10',
                                !thumb && pinned && 'ring-2 ring-white/40',
                        )}
                        data-speaking={session.voice || undefined}
                        data-presenting={presenting || undefined}
                >
                        {showVideo ? (
                                <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted={isSelf}
                                        className={cn('h-full w-full object-cover', mirror && 'scale-x-[-1]')}
                                />
                        ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                        <UserAvatar
                                                userId={session.userId}
                                                displayName={displayName || '?'}
                                                size={thumb ? 'lg' : '2xl'}
                                                ringClassName={cn('rounded-full', session.voice && 'ring-2 ring-emerald-400')}
                                        />
                                </div>
                        )}

                        {/* Connecting shimmer (self, while media negotiates). */}
                        {connecting && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
                                        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" role="status" aria-label={t('chat.connecting', 'Đang kết nối…')} />
                                </div>
                        )}

                        {/* Name chip + status icons */}
                        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 text-white">
                                <span
                                        className={cn(
                                                'max-w-[70%] truncate rounded-md bg-black/55 px-1.5 py-0.5 backdrop-blur-sm',
                                                thumb ? 'text-[10px]' : 'text-xs',
                                        )}
                                >
                                        {displayName || (isSelf ? t('chat.you', 'Bạn') : '')}
                                        {isSelf && displayName ? ` · ${t('chat.you', 'Bạn')}` : ''}
                                </span>
                                <div className="flex shrink-0 items-center gap-1.5">
                                        {presenting && (
                                                <span className="rounded-md bg-sky-500/90 p-1 text-white" title={t('chat.presenting', 'Đang trình chiếu')}>
                                                        <Presentation className={thumb ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                                                </span>
                                        )}
                                        {session.isHost && (
                                                <Star
                                                        className={cn('text-amber-400 fill-amber-400', thumb ? 'h-3 w-3' : 'h-3.5 w-3.5')}
                                                        aria-label={t('chat.host', 'chủ trì')}
                                                />
                                        )}
                                        {!session.unmuted && <MicOff className={cn('text-red-400', thumb ? 'h-3 w-3' : 'h-3.5 w-3.5')} aria-label={t('chat.muted', 'Đã tắt tiếng')} />}
                                        {session.raisedHand > 0 && (
                                                <Hand className={cn('animate-bounce text-amber-400', thumb ? 'h-3 w-3' : 'h-3.5 w-3.5')} aria-label={t('chat.handRaised', 'Giơ tay')} />
                                        )}
                                </div>
                        </div>

                        {/* Pin toggle (hover, video modes, not for the avatar fallback) */}
                        {onTogglePin && (
                                <button
                                        type="button"
                                        onClick={() => onTogglePin(session.sessionId)}
                                        aria-label={pinned ? t('chat.unpin', 'Bỏ ghim') : t('chat.pin', 'Ghim')}
                                        title={pinned ? t('chat.unpin', 'Bỏ ghim') : t('chat.pin', 'Ghim')}
                                        className={cn(
                                                'absolute right-2 top-2 rounded-md p-1.5 text-white/90 backdrop-blur-sm transition-all',
                                                pinned ? 'bg-white/25 opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100 hover:bg-black/70',
                                        )}
                                >
                                        {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                                </button>
                        )}
                </div>
        )
}
