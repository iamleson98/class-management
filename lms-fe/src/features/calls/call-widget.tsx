/**
 * CallWidget — the full-screen call UI for the active channel's call (the
 * "expanded view" in Mattermost Calls terms).
 *
 * Layout (mirrors the Mattermost Calls expanded view, restyled to lms-fe):
 *   ┌ header: title · participants · timer · quality · connection · error ┐
 *   │ screen stage (when someone shares) — dominant view + sharer tag      │
 *   │   + video stage: speaker view (large active speaker) or grid         │
 *   │   + participants grid (avatars when no video)                        │
 *   │ overlays: host notices · reaction stream · quality banner            │
 *   │ right panels: participants (host controls) · in-call chat            │
 *   └ controls: mute · camera · share · hand · react · participants · chat ┘
 *
 * Keyboard (plugin parity): ctrl+shift+space mute, ctrl+shift+y hand,
 * ctrl+shift+e screen, alt+p participants, ctrl+shift+l leave; holding SPACE
 * is push-to-talk while muted.
 *
 * Subscribes to the calls store only; media plumbing lives in the client.
 */

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
	Users, AlertTriangle, Signal, Maximize2, Minimize2, Hand, UserMinus, Crown, Mic, MicOff, Phone, PhoneOff, MonitorX,
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
import { CallTile } from './call-tile'
import { CallControls } from './call-controls'
import { bindCallsWebSocket } from './calls-events'
import { CallAlertBanners, JoinNotification, RecentlyJoinedToasts } from './call-alerts'
import { UserAvatar } from './user-avatar'
import { userDisplayName } from '@/lib/chat/types'
import { ReactionStream } from './reaction-stream'
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
		<span className={`flex items-center gap-1 ${q.color}`} title={q.label} aria-label={q.label}>
			<Signal className="h-3.5 w-3.5" />
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
	const videoStreams = useCallsStore((s) => s.videoStreams)
	const screenStream = useCallsStore((s) => s.screenStream)
	const cameraEnabled = useCallsStore((s) => s.cameraEnabled)
	const error = useCallsStore((s) => s.error)
	const notices = useCallsStore((s) => s.notices)
	const quality = useCallsStore((s) => s.quality)
	const qualityAlert = useCallsStore((s) => s.qualityAlert)
	const viewMode = useCallsStore((s) => s.viewMode)
	const minimized = useCallsStore((s) => s.minimized)
	const setMinimized = useCallsStore((s) => s.setMinimized)
	const mirrorVideo = useCallsStore((s) => s.mirrorVideo)
	const screenSharing = useCallsStore((s) => s.screenSharing)
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

	// Self-preview stream (the client owns the local MediaStream).
	const localStream = cameraEnabled ? callsClient.getLocalStream() : null

	const screenVideoRef = useRef<HTMLVideoElement>(null)
	const stageRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (screenVideoRef.current && screenStream) {
			screenVideoRef.current.srcObject = screenStream.stream
		}
	}, [screenStream])

	const participants = useMemo(
		() => sessionOrder.map((id) => sessions[id]).filter((s): s is NonNullable<typeof s> => !!s),
		[sessionOrder, sessions],
	)

	const nameFor = (userId: string): string => userDisplayName(users[userId] as never)

	const connecting = status === 'connecting' || status === 'reconnecting'

	// Speaker view: the active speaker (or the sharer / the sole other
	// participant / self), with a thumbnail strip of everyone else.
	const videoParticipants = participants.filter((s) => (s.userId === authUserId ? cameraEnabled : s.video || videoStreams[s.sessionId]))
	const activeSpeaker =
		participants.find((s) => s.voice && s.userId !== authUserId) ??
		videoParticipants.find((s) => s.userId !== authUserId) ??
		participants.find((s) => s.userId !== authUserId) ??
		participants[0]
	const showSpeakerView = viewMode === 'speaker' && !screenStream && videoParticipants.length > 0 && participants.length > 1
	const thumbs = showSpeakerView ? videoParticipants.filter((s) => s.sessionId !== activeSpeaker?.sessionId) : []

	// Current speaker readout (plugin parity: "X is talking…").
	const currentSpeaker = participants.find((s) => s.voice) ?? null
	const speakerName = currentSpeaker && currentSpeaker.userId !== authUserId ? nameFor(currentSpeaker.userId) : ''

	const toggleFullscreen = () => {
		const el = stageRef.current
		if (!el) return
		if (document.fullscreenElement) void document.exitFullscreen()
		else void el.requestFullscreen?.().catch(() => void 0)
	}

	if (minimized) {
		return (
			<CallErrorBoundary>
				<CompactCallBar onExpand={() => setMinimized(false)} nameFor={nameFor} />
			</CallErrorBoundary>
		)
	}

	return (
		<CallErrorBoundary>
		<div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
			<div className="flex min-h-0 flex-1">
				<div className="flex min-w-0 flex-1 flex-col">
					{/* Header */}
					<div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-white/10 shrink-0">
						<div className="flex items-center gap-2 text-white/90 min-w-0">
							<Users className="h-4 w-4 shrink-0" />
							<span className="text-sm font-medium truncate">
								{t('chat.callInProgress', 'Cuộc gọi')} · {participants.length}
							</span>
							<CallTimer startAt={startAt} />
							<QualityBadge quality={quality} />
							{connecting && (
								<span className="text-xs text-amber-400 ml-1">
									{status === 'connecting' ? t('chat.connecting', 'Đang kết nối…') : t('chat.reconnecting', 'Đang kết nối lại…')}
								</span>
							)}
							{speakerName && !connecting && (
								<span className="ml-1 max-w-[220px] truncate text-xs text-emerald-300">
									{t('chat.speaking', '{name} đang nói…', { name: speakerName })}
								</span>
							)}
						</div>
						{error && (
							<span className="flex items-center gap-1 text-xs text-red-400 truncate max-w-[40%]">
								<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
								<span className="truncate">{error.message}</span>
							</span>
						)}
						<div className="flex items-center gap-1 shrink-0">
							<button
								type="button"
								onClick={() => setMinimized(true)}
								aria-label={t('chat.minimizeCall', 'Thu nhỏ cuộc gọi')}
								title={t('chat.minimizeCall', 'Thu nhỏ cuộc gọi')}
								className="h-8 w-8 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
							>
								<Minimize2 className="h-4 w-4" />
							</button>
						</div>
					</div>

					{/* Device/permission alert banners */}
					<CallAlertBanners />

					{/* Degraded quality banner */}
					{qualityAlert && (
						<div className="flex items-center justify-center gap-2 bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-xs text-amber-300">
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
					<div ref={stageRef} className={`relative flex min-h-0 flex-1 flex-col bg-black ${screenStream ? '' : ''}`}>
						{/* Screen stage */}
						{screenStream && (
							<div className="relative flex flex-[3] items-center justify-center p-2 min-h-0">
								<video
									ref={screenVideoRef}
									autoPlay
									playsInline
									className="max-w-full max-h-full rounded-lg object-contain"
								/>
								<div className="absolute top-3 left-3 flex items-center gap-2">
									<span className="bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm max-w-[60%] truncate">
										{screenSharing && screenStream.sessionId === useCallsStore.getState().mySessionId
												? t('chat.sharingYourScreen', 'Bạn đang chia sẻ màn hình')
												: `${t('chat.screenShareBy', 'Màn hình của')} ${nameFor(sessions[screenStream.sessionId]?.userId ?? '') || '?'}`}
									</span>
									<button
										type="button"
										onClick={toggleFullscreen}
										aria-label={t('chat.fullscreen', 'Toàn màn hình')}
										className="bg-black/60 text-white/80 hover:text-white p-1.5 rounded backdrop-blur-sm"
									>
										<Maximize2 className="h-3.5 w-3.5" />
									</button>
									{screenSharing && (
										<button
											type="button"
											onClick={() => callsClient.stopScreenShare()}
											className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 transition-colors"
										>
											<MonitorX className="h-3.5 w-3.5" />
											{t('chat.stopSharing', 'Dừng chia sẻ')}
										</button>
									)}
								</div>
							</div>
						)}

						{/* Speaker view */}
						{showSpeakerView && activeSpeaker && (
							<div className="relative flex min-h-0 flex-1 flex-col">
								<div className="flex min-h-0 flex-1 items-center justify-center p-2">
									<CallTile
										session={activeSpeaker}
										displayName={nameFor(activeSpeaker.userId)}
										isSelf={activeSpeaker.userId === authUserId}
										mirror={activeSpeaker.userId === authUserId && mirrorVideo}
										stream={activeSpeaker.userId === authUserId ? undefined : videoStreams[activeSpeaker.sessionId]}
										selfStream={activeSpeaker.userId === authUserId ? localStream : undefined}
									/>
								</div>
								{thumbs.length > 0 && (
									<div className="flex shrink-0 items-center justify-center gap-2 overflow-x-auto px-3 pb-2">
										{thumbs.map((s) => (
											<div key={s.sessionId} className="w-40 shrink-0">
												<CallTile
													session={s}
													displayName={nameFor(s.userId)}
													isSelf={s.userId === authUserId}
													mirror={s.userId === authUserId && mirrorVideo}
													stream={s.userId === authUserId ? undefined : videoStreams[s.sessionId]}
													selfStream={s.userId === authUserId ? localStream : undefined}
												/>
											</div>
										))}
									</div>
								)}
							</div>
						)}

						{/* Participants grid (grid mode, no video, or screen-share sidebar) */}
						<div
							className={`overflow-auto p-4 min-h-0 ${
								screenStream || showSpeakerView ? 'flex-none max-h-[30vh]' : 'flex-1 flex items-center'
							}`}
						>
							<div
								className="grid gap-3 w-full"
								style={{
									gridTemplateColumns: `repeat(${Math.min(
										(showSpeakerView || screenStream ? Math.min(participants.length, 4) : participants.length) || 1,
										showSpeakerView || screenStream ? 4 : 3,
									)}, minmax(0, 1fr))`,
									maxWidth:
										!screenStream && !showSpeakerView && participants.length <= 3 ? 'min(100%, 720px)' : undefined,
									margin: '0 auto',
									alignContent: 'center',
								}}
							>
								{participants.length === 0 ? (
									<div className="col-span-full flex items-center justify-center text-white/50 text-sm py-12">
										{t('chat.waitingForOthers', 'Đang chờ người khác tham gia…')}
									</div>
								) : (
									participants
										.filter((s) => !(showSpeakerView && s.sessionId === activeSpeaker?.sessionId))
										.map((s) => (
											<CallTile
												key={s.sessionId}
												session={s}
												displayName={nameFor(s.userId)}
												isSelf={s.userId === authUserId}
												mirror={s.userId === authUserId && mirrorVideo}
												stream={s.userId === authUserId ? undefined : videoStreams[s.sessionId]}
												selfStream={s.userId === authUserId ? localStream : undefined}
											/>
										))
								)}
							</div>
						</div>

						{/* Overlays */}
						<JoinNotification />
						<RecentlyJoinedToasts />
						<HostNotices />
						<ReactionStream />
					</div>

					{/* Controls */}
					<CallControls />
				</div>

				{/* Right panels */}
				{participantsOpen && <ParticipantsPanel />}
				{chatOpen && <CallChatPanel />}
			</div>

			{/* Muted hint while push-to-talk is available */}
			{!micEnabled && (
				<div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
					{t('chat.pushToTalkHint', 'Giữ Space để tạm bật tiếng')}
				</div>
			)}
		</div>
		</CallErrorBoundary>
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
 * collapsed state). A floating bar at the bottom-left with the current
 * speaker's avatar + name, the call timer, mic toggle, expand, and leave, so
 * the user can browse the app while staying in the call.
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
	const users = useChatStore((s) => s.users)
	void users

	const participants = sessionOrder.map((id) => sessions[id]).filter((s): s is NonNullable<typeof s> => !!s)
	const speaker = participants.find((s) => s.voice) ?? participants.find((s) => s.userId !== authUserId) ?? participants[0]
	const speakerName = speaker ? nameFor(speaker.userId) : ''
	const connecting = status === 'connecting' || status === 'reconnecting'

	return (
		<div className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 rounded-2xl border border-white/15 bg-neutral-950/95 px-3 py-2.5 shadow-2xl backdrop-blur">
			{speaker && (
				<UserAvatar
					userId={speaker.userId}
					displayName={speakerName || '?'}
					size="md"
					ringClassName={cn('rounded-full', speaker.voice ? 'ring-2 ring-emerald-500 rounded-full' : '')}
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
					{screenStream && <MonitorX className="hidden h-3.5 w-3.5" aria-hidden />}
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
					{micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-amber-400" />}
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
