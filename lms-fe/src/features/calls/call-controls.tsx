/**
 * call-controls — the bottom control bar.
 *
 * Mute / camera / screen share / raise hand / leave, plus a host menu
 * (make host, mute one, mute all, lower hand, remove, end call) calling the
 * native host-control REST API.
 */

'use client'

import { useState } from 'react'
import {
	Hand, Mic, MicOff, Monitor, MonitorOff, PhoneOff, Video, VideoOff,
	Crown, UserMinus, VolumeX, MonitorX, LogOut, MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslation } from '@/lib/i18n'
import { useLMSStore } from '@/store/lms-store'
import { useChatStore } from '@/lib/chat/store'
import { callsClient } from './calls-client'
import { useCallsStore, type CallSession } from './calls-store'

/** POST a host-control action against the native calls REST API. */
async function hostAction(callId: string, action: string, body?: Record<string, unknown>): Promise<void> {
	const res = await fetch(`/api/v4/calls/${callId}/host/${action}`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
		body: JSON.stringify(body ?? {}),
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({}))
		throw new Error(err.message || err.error || 'host action failed')
	}
}

function ControlButton({
	active, onClick, on, off, label, destructive,
}: {
	active: boolean
	onClick: () => void
	on: React.ReactNode
	off: React.ReactNode
	label: string
	destructive?: boolean
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-pressed={active}
					aria-label={label}
					onClick={onClick}
					className={`h-11 w-11 rounded-full transition-colors ${
						active
							? 'bg-white/15 text-white hover:bg-white/25'
							: destructive
								? 'bg-red-500/90 text-white hover:bg-red-500'
								: 'bg-white/5 text-white/70 hover:bg-white/15'
					}`}
				>
					{active ? on : off}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	)
}

/** Small icon button used inside a participant row of the host menu. */
function RowButton({
	onClick, label, children,
}: {
	onClick: () => void
	label: string
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			onClick={(e) => { e.stopPropagation(); onClick() }}
			className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
		>
			{children}
		</button>
	)
}

export function CallControls() {
	const { t } = useTranslation()
	const authUserId = useLMSStore((s) => s.authUser?.id)
	const users = useChatStore((s) => s.users)

	const callId = useCallsStore((s) => s.callId)
	const micEnabled = useCallsStore((s) => s.micEnabled)
	const cameraEnabled = useCallsStore((s) => s.cameraEnabled)
	const screenSharing = useCallsStore((s) => s.screenSharing)
	const handRaised = useCallsStore((s) => s.handRaised)
	const hostUserId = useCallsStore((s) => s.hostUserId)
	const sessions = useCallsStore((s) => s.sessions)
	const setError = useCallsStore((s) => s.setError)

	const [menuOpen, setMenuOpen] = useState(false)
	const isHost = !!authUserId && hostUserId === authUserId

	/** Run a host action, surfacing failures as a call-level error. */
	const runHost = (action: string, body?: Record<string, unknown>) => {
		if (!callId) return
		hostAction(callId, action, body).catch((err: Error) => setError({ message: err.message }))
	}

	/** Other participants (host menu targets), with resolved display names. */
	const others: Array<CallSession & { displayName: string }> = Object.values(sessions)
		.filter((s) => s.userId !== authUserId)
		.map((s) => {
			const u = users[s.userId] as Record<string, any> | undefined
			const first = u ? (u.firstname ?? u.first_name ?? '') : ''
			const last = u ? (u.lastname ?? u.last_name ?? '') : ''
			return {
				...s,
				displayName: u ? `${first} ${last}`.trim() || u.username : s.sessionId.slice(0, 8),
			}
		})

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

	return (
		<div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-white/10 shrink-0">
			<ControlButton
				active={micEnabled}
				onClick={onToggleMute}
				on={<Mic className="h-5 w-5" />}
				off={<MicOff className="h-5 w-5" />}
				label={micEnabled ? t('chat.mute', 'Tắt tiếng') : t('chat.unmute', 'Bật tiếng')}
			/>
			<ControlButton
				active={cameraEnabled}
				onClick={onToggleVideo}
				on={<Video className="h-5 w-5" />}
				off={<VideoOff className="h-5 w-5" />}
				label={cameraEnabled ? t('chat.stopVideo', 'Tắt camera') : t('chat.startVideo', 'Bật camera')}
			/>
			<ControlButton
				active={screenSharing}
				onClick={onToggleScreen}
				on={<Monitor className="h-5 w-5" />}
				off={<MonitorOff className="h-5 w-5" />}
				label={screenSharing ? t('chat.stopShare', 'Dừng chia sẻ') : t('chat.shareScreen', 'Chia sẻ màn hình')}
			/>
			<ControlButton
				active={handRaised}
				onClick={onToggleHand}
				on={<Hand className="h-5 w-5 text-amber-400" />}
				off={<Hand className="h-5 w-5" />}
				label={handRaised ? t('chat.lowerHand', 'Hạ tay') : t('chat.raiseHand', 'Giơ tay')}
			/>

			{/* Host / more menu */}
			<Popover open={menuOpen} onOpenChange={setMenuOpen}>
				<Tooltip>
					<PopoverTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							aria-label={t('chat.callMenu', 'Tùy chọn cuộc gọi')}
							className="h-11 w-11 rounded-full bg-white/5 text-white/70 hover:bg-white/15"
						>
							<MoreVertical className="h-5 w-5" />
						</Button>
					</PopoverTrigger>
					<TooltipContent>{t('chat.callMenu', 'Tùy chọn cuộc gọi')}</TooltipContent>
				</Tooltip>
				<PopoverContent align="center" className="w-72 p-0">
					{isHost ? (
						<div className="p-1">
							<p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
								{t('chat.hostControls', 'Kiểm soát của chủ trì')}
							</p>
							<button
								type="button"
								disabled={others.length === 0}
								onClick={() => runHost('mute-others')}
								className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted/60 transition-colors disabled:opacity-50"
							>
								<VolumeX className="h-4 w-4" />
								{t('chat.muteOthers', 'Tắt tiếng tất cả')}
							</button>
							{screenSharing && (
								<button
									type="button"
									onClick={() => callsClient.stopScreenShare()}
									className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted/60 transition-colors"
								>
									<MonitorX className="h-4 w-4" />
									{t('chat.stopShare', 'Dừng chia sẻ')}
								</button>
							)}
							<button
								type="button"
								onClick={() => runHost('end')}
								className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-destructive/10 hover:text-destructive transition-colors"
							>
								<LogOut className="h-4 w-4" />
								{t('chat.endForAll', 'Kết thúc cho tất cả')}
							</button>

							{others.length > 0 && (
								<>
									<p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
										{t('chat.participants', 'Thành viên')}
									</p>
									{others.map((o) => (
										<div
											key={o.sessionId}
											className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40"
										>
											<span className="text-sm truncate flex-1">{o.displayName}</span>
											<div className="flex gap-0.5 shrink-0">
												<RowButton label={t('chat.mute', 'Tắt tiếng')} onClick={() => runHost('mute', { sessionID: o.sessionId })}>
													<MicOff className="h-3.5 w-3.5" />
												</RowButton>
												{o.raisedHand > 0 && (
													<RowButton label={t('chat.lowerHand', 'Hạ tay')} onClick={() => runHost('lower-hand', { sessionID: o.sessionId })}>
														<Hand className="h-3.5 w-3.5" />
													</RowButton>
												)}
												<RowButton label={t('chat.remove', 'Mời ra')} onClick={() => runHost('remove', { sessionID: o.sessionId })}>
													<UserMinus className="h-3.5 w-3.5" />
												</RowButton>
												<RowButton label={t('chat.makeHost', 'Chuyển chủ trì')} onClick={() => runHost('make', { newHostID: o.userId })}>
													<Crown className="h-3.5 w-3.5" />
												</RowButton>
											</div>
										</div>
									))}
								</>
							)}
						</div>
					) : (
						<div className="p-1">
							<p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
								{t('chat.callOptions', 'Tùy chọn')}
							</p>
							<button
								type="button"
								onClick={() => callsClient.requestCallState()}
								className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted/60 transition-colors"
							>
								{t('chat.refreshState', 'Làm mới trạng thái')}
							</button>
						</div>
					)}
				</PopoverContent>
			</Popover>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="destructive"
						size="icon"
						className="h-11 w-11 rounded-full ml-2"
						onClick={() => callsClient.leave()}
						aria-label={t('chat.leaveCall', 'Rời cuộc gọi')}
					>
						<PhoneOff className="h-5 w-5" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>{t('chat.leaveCall', 'Rời cuộc gọi')}</TooltipContent>
			</Tooltip>
		</div>
	)
}
