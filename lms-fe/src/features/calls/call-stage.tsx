/**
 * call-stage — the call's video area (below the header, above the controls).
 *
 * Three layouts, matching the organization of mainstream call software:
 *
 *   presentation : someone is sharing a screen → the shared surface fills the
 *                  stage in a framed container (fit/fill toggle, fullscreen,
 *                  presenter chip) with a filmstrip of every participant.
 *   speaker      : viewMode === 'speaker' → one large focal tile (the pinned
 *                  participant when set, else the active speaker) with a
 *                  filmstrip of everyone else.
 *   grid         : adaptive tile grid (1 col solo · 2 cols ≤4 · 3 cols ≤9 ·
 *                  4 cols beyond), centered with a capped width.
 *
 * Pinning: hovering a tile reveals a pin toggle; the pinned participant
 * becomes the speaker-view focus until unpinned or they leave. Pinning is
 * hidden while a presentation is live (the stage belongs to the screen).
 */

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Expand, Maximize2, Minimize, MonitorX, Presentation } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { useLMSStore } from '@/store/lms-store'
import { useChatStore } from '@/lib/chat/store'
import { callsClient } from './calls-client'
import { useCallsStore, type CallSession } from './calls-store'
import { CallTile } from './call-tile'
import { ReactionStream } from './reaction-stream'
import { userDisplayName } from '@/lib/chat/types'

export function CallStage() {
        const { t } = useTranslation()
        const sessions = useCallsStore((s) => s.sessions)
        const sessionOrder = useCallsStore((s) => s.sessionOrder)
        const videoStreams = useCallsStore((s) => s.videoStreams)
        const remoteScreen = useCallsStore((s) => s.screenStream)
        const localScreen = useCallsStore((s) => s.localScreenStream)
        const screenSharing = useCallsStore((s) => s.screenSharing)
        const cameraEnabled = useCallsStore((s) => s.cameraEnabled)
        const viewMode = useCallsStore((s) => s.viewMode)
        const mirrorVideo = useCallsStore((s) => s.mirrorVideo)
        const mySessionId = useCallsStore((s) => s.mySessionId)
        const status = useCallsStore((s) => s.status)

        const users = useChatStore((s) => s.users)
        const authUserId = useLMSStore((s) => s.authUser?.id)

        const [pinnedId, setPinnedId] = useState<string | null>(null)
        // Derived (not state-reset-in-effect): a pin on a participant who left is
        // simply ignored until it is toggled again.
        const pinned = pinnedId && sessions[pinnedId] ? pinnedId : null
        const togglePin = (sessionId: string) => setPinnedId((cur) => (cur === sessionId ? null : sessionId))

        const participants = useMemo(
                () => sessionOrder.map((id) => sessions[id]).filter((s): s is CallSession => !!s),
                [sessionOrder, sessions],
        )
        const nameFor = (userId: string): string => userDisplayName(users[userId] as never)

        const localStream = cameraEnabled ? callsClient.getLocalStream() : null
        const connecting = status === 'connecting' || status === 'reconnecting'

        const tileProps = (s: CallSession) => ({
                session: s,
                displayName: nameFor(s.userId),
                isSelf: s.userId === authUserId,
                mirror: s.userId === authUserId && mirrorVideo,
                stream: s.userId === authUserId ? undefined : videoStreams[s.sessionId],
                selfStream: s.userId === authUserId ? localStream : undefined,
                connecting: connecting && s.userId === authUserId,
        })

        // Presentation surface: the remote share when someone else presents,
        // else the local capture while this participant shares (the SFU never
        // loops the sharer's own track back, so the presenter views their own
        // share locally — same presentation stage layout).
        const screenStream = remoteScreen ?? (localScreen ? { sessionId: mySessionId ?? '', stream: localScreen } : null)
        const selfSharing = !!screenSharing && !!screenStream && (!remoteScreen || screenStream.sessionId === mySessionId)

        if (screenStream) {
                return (
                        <ScreenStage
                                screenStream={screenStream}
                                selfSharing={selfSharing}
                                presenterName={
                                        selfSharing || screenStream.sessionId === mySessionId
                                                ? t('chat.you', 'Bạn')
                                                : nameFor(sessions[screenStream.sessionId]?.userId ?? '')
                                }
                                participants={participants}
                                tileProps={tileProps}
                                presenterSessionId={screenStream.sessionId}
                        />
                )
        }

        return (
                <VideoStage
                        participants={participants}
                        viewMode={viewMode}
                        pinnedId={pinned}
                        togglePin={togglePin}
                        tileProps={tileProps}
                        authUserId={authUserId}
                        hasVideo={(s: CallSession) => (s.userId === authUserId ? cameraEnabled : s.video || !!videoStreams[s.sessionId])}
                />
        )
}

type TilePropsFn = (s: CallSession) => {
        session: CallSession
        displayName: string
        isSelf: boolean
        mirror: boolean
        stream?: MediaStream
        selfStream?: MediaStream | null
        connecting: boolean
}

/** ─── Presentation (screen share) ─────────────────────────────────── */

function ScreenStage({
        screenStream,
        selfSharing,
        presenterName,
        participants,
        tileProps,
        presenterSessionId,
}: {
        screenStream: { sessionId: string; stream: MediaStream }
        selfSharing: boolean
        presenterName: string
        participants: CallSession[]
        tileProps: TilePropsFn
        presenterSessionId: string
}) {
        const { t } = useTranslation()
        const videoRef = useRef<HTMLVideoElement>(null)
        const frameRef = useRef<HTMLDivElement>(null)
        const [fill, setFill] = useState(false)

        useEffect(() => {
                if (videoRef.current) videoRef.current.srcObject = screenStream.stream
        }, [screenStream])

        const toggleFullscreen = () => {
                const el = frameRef.current
                if (!el) return
                if (document.fullscreenElement) void document.exitFullscreen()
                else void el.requestFullscreen?.().catch(() => void 0)
        }

        return (
                <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
                        {/* Shared surface in a framed container */}
                        <div
                                ref={frameRef}
                                className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
                        >
                                <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        className={cn('h-full w-full', fill ? 'object-cover' : 'object-contain')}
                                />

                                {/* Presenter chip + stage tools */}
                                <div className="absolute left-3 top-3 flex items-center gap-1.5">
                                        <span className="flex max-w-[60%] items-center gap-1.5 rounded-full bg-black/60 py-1 pl-2 pr-3 text-xs text-white backdrop-blur-md">
                                                <Presentation className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                                                <span className="truncate">
                                                        {selfSharing
                                                                ? t('chat.sharingYourScreen', 'Bạn đang chia sẻ màn hình')
                                                                : `${t('chat.screenShareBy', 'Màn hình của')} ${presenterName || '?'}`}
                                                </span>
                                        </span>
                                </div>
                                <div className="absolute right-3 top-3 flex items-center gap-1.5">
                                        <button
                                                type="button"
                                                onClick={() => setFill((f) => !f)}
                                                aria-pressed={fill}
                                                aria-label={fill ? t('chat.screenFit', 'Vừa khung') : t('chat.screenFill', 'Phóng đầy')}
                                                title={fill ? t('chat.screenFit', 'Vừa khung') : t('chat.screenFill', 'Phóng đầy')}
                                                className="rounded-md bg-black/60 p-1.5 text-white/80 backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white"
                                        >
                                                {fill ? <Minimize className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
                                        </button>
                                        <button
                                                type="button"
                                                onClick={toggleFullscreen}
                                                aria-label={t('chat.fullscreen', 'Toàn màn hình')}
                                                title={t('chat.fullscreen', 'Toàn màn hình')}
                                                className="rounded-md bg-black/60 p-1.5 text-white/80 backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white"
                                        >
                                                <Maximize2 className="h-3.5 w-3.5" />
                                        </button>
                                </div>

                                {selfSharing && (
                                        <button
                                                type="button"
                                                onClick={() => callsClient.stopScreenShare()}
                                                className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-red-500/95 px-4 py-2 text-xs font-medium text-white shadow-lg transition-colors hover:bg-red-500"
                                        >
                                                <MonitorX className="h-4 w-4" />
                                                {t('chat.stopSharing', 'Dừng chia sẻ')}
                                        </button>
                                )}

                                {/* Reactions float over the shared surface, above the filmstrip. */}
                                <ReactionStream />
                        </div>

                        {/* Filmstrip: everyone, the presenter highlighted */}
                        <Filmstrip>
                                {participants.map((s) => (
                                        <div key={s.sessionId} className="w-40 shrink-0 sm:w-44">
                                                <CallTile {...tileProps(s)} size="thumb" presenting={s.sessionId === presenterSessionId} />
                                        </div>
                                ))}
                        </Filmstrip>
                </div>
        )
}

/** ─── Speaker view + grid ─────────────────────────────────────────── */

function VideoStage({
        participants,
        viewMode,
        pinnedId,
        togglePin,
        tileProps,
        authUserId,
        hasVideo,
}: {
        participants: CallSession[]
        viewMode: 'grid' | 'speaker'
        pinnedId: string | null
        togglePin: (sessionId: string) => void
        tileProps: TilePropsFn
        authUserId?: string
        hasVideo: (s: CallSession) => boolean
}) {
        const { t } = useTranslation()
        const videoParticipants = participants.filter(hasVideo)

        const activeSpeaker =
                participants.find((s) => s.voice && s.userId !== authUserId) ??
                videoParticipants.find((s) => s.userId !== authUserId) ??
                participants.find((s) => s.userId !== authUserId) ??
                participants[0]
        const focal = (pinnedId && participants.find((s) => s.sessionId === pinnedId)) || activeSpeaker
        const showSpeakerView =
                viewMode === 'speaker' && videoParticipants.length > 0 && participants.length > 1

        if (participants.length <= 1) {
                return <WaitingRoom self={participants[0] ? tileProps(participants[0]) : null} />
        }

        if (showSpeakerView && focal) {
                const rest = participants.filter((s) => s.sessionId !== focal.sessionId)
                return (
                        <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
                                <div className="relative flex min-h-0 flex-1 items-center justify-center">
                                        <div className="h-full max-h-full" style={{ aspectRatio: '16 / 9', maxWidth: '100%' }}>
                                                <CallTile {...tileProps(focal)} pinned={pinnedId === focal.sessionId} onTogglePin={togglePin} />
                                        </div>
                                        {/* Reactions float over the focal tile, never over the filmstrip. */}
                                        <ReactionStream />
                                </div>
                                <Filmstrip>
                                        {rest.map((s) => (
                                                <div key={s.sessionId} className="w-40 shrink-0 sm:w-44">
                                                        <CallTile
                                                                {...tileProps(s)}
                                                                size="thumb"
                                                                pinned={pinnedId === s.sessionId}
                                                                onTogglePin={togglePin}
                                                        />
                                                </div>
                                        ))}
                                </Filmstrip>
                        </div>
                )
        }

        // Grid: 1 col solo · 2 cols ≤4 · 3 cols ≤9 · 4 cols beyond (Zoom-like).
        const n = participants.length
        const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4
        const maxWidth = { 1: 640, 2: 960, 3: 1280, 4: 1600 }[cols]

        return (
                <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
                        <div
                                className="grid max-h-full w-full gap-2.5 overflow-y-auto"
                                style={{
                                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                                        maxWidth: `min(100%, ${maxWidth}px)`,
                                        alignContent: 'center',
                                }}
                        >
                                {participants.map((s) => (
                                        <CallTile key={s.sessionId} {...tileProps(s)} onTogglePin={togglePin} pinned={pinnedId === s.sessionId} />
                                ))}
                        </div>
                        <ReactionStream />
                </div>
        )
}

/** ─── Filmstrip + waiting room ────────────────────────────────────── */

function Filmstrip({ children }: { children: React.ReactNode }) {
        // The inner row is min-w-max + mx-auto: centered when it fits, and
        // naturally scrollable (left edge reachable) when it overflows.
        return (
                <div className="shrink-0 overflow-x-auto pb-0.5" role="list" aria-label="participants">
                        <div className="mx-auto flex min-w-max snap-x items-center gap-2.5">
                                {children}
                        </div>
                </div>
        )
}

/** Solo participant: a calm, centered waiting room. */
function WaitingRoom({ self }: { self: ReturnType<TilePropsFn> | null }) {
        const { t } = useTranslation()
        if (!self) {
                return (
                        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
                                <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
                        </div>
                )
        }
        return (
                <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6">
                        <div className="relative">
                                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
                                <div className="relative">
                                        <CallTile {...self} />
                                </div>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center">
                                <p className="text-sm font-medium text-white/85">{t('chat.waitingForOthers', 'Đang chờ người khác tham gia…')}</p>
                                <p className="max-w-sm text-xs text-white/45">
                                        {t('chat.waitingSub', 'Cuộc gọi sẽ bắt đầu ngay khi có người khác tham gia. Bạn có thể bật camera hoặc chia sẻ màn hình trong lúc chờ.')}
                                </p>
                        </div>
                        <ReactionStream />
                </div>
        )
}
