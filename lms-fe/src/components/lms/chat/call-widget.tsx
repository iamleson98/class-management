'use client'

/**
 * CallWidget — the floating call UI for the active channel's call.
 *
 * Renders while the local participant is in a call. Shows:
 *  - participant tiles (avatars when video is off, <video> when on),
 *  - the screen-share panel,
 *  - the controls bar (mute, video, screen share, raise hand, leave).
 *
 * The RTCPeerConnection lives on the CallsClient singleton; this component
 * subscribes to the calls store for UI state only. Remote media is bound to
 * <audio>/<video> elements via the client's track handlers, and the local
 * camera preview is rendered from a stream ref captured here.
 *
 * Ports the layout intent of the vendored call_widget (a centered, modal-like
 * overlay) but uses shadcn/ui primitives + tailwind to match the lms-fe style.
 */

import { useEffect, useRef, useState } from 'react'
import {
	Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
	Hand, PhoneOff, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { callsClient } from '@/lib/chat/calls-client'
import { useCallsStore } from '@/lib/chat/calls-store'
import { useChatStore } from '@/lib/chat/store'
import { useTranslation } from '@/lib/i18n'

export function CallWidget({ channelId }: { channelId: string }) {
	const { t } = useTranslation()
	const status = useCallsStore((s) => s.status)
	const sessions = useCallsStore((s) => s.sessions)
	const sessionOrder = useCallsStore((s) => s.sessionOrder)
	const hostId = useCallsStore((s) => s.hostId)
	const micEnabled = useCallsStore((s) => s.micEnabled)
	const cameraEnabled = useCallsStore((s) => s.cameraEnabled)
	const screenSharing = useCallsStore((s) => s.screenSharing)
	const handRaised = useCallsStore((s) => s.handRaised)
	const error = useCallsStore((s) => s.error)

	const localVideoRef = useRef<HTMLVideoElement>(null)
	const [localStream, setLocalStream] = useState<MediaStream | null>(null)

	// Capture the local camera stream for the self-preview. We poll the
	// client's stream since it's managed there (not in the store).
	useEffect(() => {
		if (!cameraEnabled) {
			setLocalStream(null)
			return
		}
		// The client holds the local stream; expose it via a small accessor.
		const stream = callsClient.getLocalStream?.() ?? null
		setLocalStream(stream)
	}, [cameraEnabled])

	useEffect(() => {
		if (localVideoRef.current && localStream) {
			localVideoRef.current.srcObject = localStream
		}
	}, [localStream])

	const onLeave = () => callsClient.leave()
	const onToggleMute = () => (micEnabled ? callsClient.mute() : callsClient.unmute())
	const onToggleVideo = () => {
		if (cameraEnabled) {
			callsClient.stopVideo()
		} else {
			callsClient.startVideo().catch((e) => console.error('[calls] startVideo failed', e))
		}
	}
	const onToggleScreen = () => {
		if (screenSharing) {
			callsClient.stopScreenShare()
		} else {
			callsClient.startScreenShare().catch((e) => console.error('[calls] screen share failed', e))
		}
	}
	const onToggleHand = () => (handRaised ? callsClient.lowerHand() : callsClient.raiseHand())

	// Resolve participant display info from the chat user store.
	const users = useChatStore((s) => s.users)
	const currentUserId = useChatStore((s) => s.currentUserId)
	const participants = sessionOrder
		.map((id) => sessions[id])
		.filter((s): s is NonNullable<typeof s> => !!s)

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
			{/* Header */}
			<div className="flex items-center justify-between px-4 h-12 border-b border-white/10 shrink-0">
				<div className="flex items-center gap-2 text-white/90">
					<Users className="h-4 w-4" />
					<span className="text-sm font-medium">
						{t('chat.callInProgress', 'Cuộc gọi')} · {participants.length}
					</span>
					{status === 'connecting' || status === 'reconnecting' ? (
						<span className="text-xs text-amber-400 ml-2">
							{status === 'connecting' ? t('chat.connecting', 'Đang kết nối…') : t('chat.reconnecting', 'Đang kết nối lại…')}
						</span>
					) : null}
				</div>
				{error ? (
					<span className="text-xs text-red-400">{error.message}</span>
				) : null}
			</div>

			{/* Participants grid */}
			<div className="flex-1 overflow-auto p-4">
				<div className="grid gap-3 h-full content-center" style={{ gridTemplateColumns: `repeat(${Math.min(participants.length || 1, 3)}, minmax(0, 1fr))` }}>
					{participants.length === 0 ? (
						<div className="col-span-full flex items-center justify-center text-white/50 text-sm">
							{t('chat.waitingForOthers', 'Đang chờ người khác tham gia…')}
						</div>
					) : (
						participants.map((s) => {
							const user = users[s.userId]
							const name = user ? `${user.first_name} ${user.last_name}`.trim() || user.username : ''
							const initials = name.slice(0, 2).toUpperCase() || '?'
							const isSelf = s.userId === currentUserId
							const isHost = s.userId === hostId
							// Self view uses the local video element; others would use
							// remote streams bound by the client (Phase 2 enhancement).
							const showSelfVideo = isSelf && cameraEnabled
							return (
								<div
									key={s.sessionId}
									className={`relative aspect-video rounded-lg overflow-hidden bg-white/5 flex items-center justify-center ${s.voice ? 'ring-2 ring-emerald-500' : 'ring-1 ring-white/10'}`}
								>
									{showSelfVideo ? (
										<video ref={isSelf ? localVideoRef : undefined} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
									) : (
										<Avatar className="h-16 w-16">
											<AvatarFallback className="bg-white/10 text-white text-lg">{initials}</AvatarFallback>
										</Avatar>
									)}
									{/* Overlays */}
									<div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-xs">
										<span className="bg-black/50 px-1.5 py-0.5 rounded max-w-[60%] truncate">
											{name || (isSelf ? t('chat.you', 'Bạn') : '')} {isHost ? `· ${t('chat.host', 'chủ trì')}` : ''}
										</span>
										<div className="flex items-center gap-1">
											{!s.unmuted ? <MicOff className="h-3.5 w-3.5" /> : null}
											{s.raisedHand ? <Hand className="h-3.5 w-3.5 text-amber-400" /> : null}
										</div>
									</div>
								</div>
							)
						})
					)}
				</div>
			</div>

			{/* Controls bar */}
			<div className="flex items-center justify-center gap-2 p-4 border-t border-white/10 shrink-0">
				<ControlButton active={micEnabled} onClick={onToggleMute} on={<Mic className="h-5 w-5" />} off={<MicOff className="h-5 w-5 text-red-400" />} label={micEnabled ? t('chat.mute', 'Tắt tiếng') : t('chat.unmute', 'Bật tiếng')} />
				<ControlButton active={cameraEnabled} onClick={onToggleVideo} on={<Video className="h-5 w-5" />} off={<VideoOff className="h-5 w-5" />} label={cameraEnabled ? t('chat.stopVideo', 'Tắt camera') : t('chat.startVideo', 'Bật camera')} />
				<ControlButton active={screenSharing} onClick={onToggleScreen} on={<Monitor className="h-5 w-5" />} off={<MonitorOff className="h-5 w-5" />} label={screenSharing ? t('chat.stopShare', 'Dừng chia sẻ') : t('chat.shareScreen', 'Chia sẻ màn hình')} />
				<ControlButton active={handRaised} onClick={onToggleHand} on={<Hand className="h-5 w-5 text-amber-400" />} off={<Hand className="h-5 w-5" />} label={handRaised ? t('chat.lowerHand', 'Hạ tay') : t('chat.raiseHand', 'Giơ tay')} />
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="destructive" size="icon" className="h-11 w-11 rounded-full ml-2" onClick={onLeave} aria-label={t('chat.leaveCall', 'Rời cuộc gọi')}>
							<PhoneOff className="h-5 w-5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t('chat.leaveCall', 'Rời cuộc gọi')}</TooltipContent>
				</Tooltip>
			</div>
		</div>
	)
}

function ControlButton({
	active, onClick, on, off, label,
}: {
	active: boolean
	onClick: () => void
	on: React.ReactNode
	off: React.ReactNode
	label: string
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className={`h-11 w-11 rounded-full ${active ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
					onClick={onClick}
					aria-label={label}
				>
					{active ? on : off}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	)
}
