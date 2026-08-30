/**
 * Participants panel — ports the plugin webapp's expanded_view participants
 * RHS: the roster of everyone in the call with mute/hand/host indicators and,
 * for the host, the per-participant host controls (mute, lower hand, make
 * host, remove) plus "Mute others".
 */

'use client'

import { useState } from 'react'
import { Crown, Hand, MicOff, UserMinus, VolumeX, Star, MonitorX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { useLMSStore } from '@/store/lms-store'
import { useChatStore } from '@/lib/chat/store'
import { useToast } from '@/hooks/use-toast'
import { useCallsStore, type CallSession } from './calls-store'
import { userDisplayName } from '@/lib/chat/types'
import { UserAvatar } from './user-avatar'
import { ConfirmRemoveDialog } from './call-controls'

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

export function ParticipantsPanel() {
	const { t } = useTranslation()
	const { toast } = useToast()
	const authUserId = useLMSStore((s) => s.authUser?.id)
	const users = useChatStore((s) => s.users)

	const callId = useCallsStore((s) => s.callId)
	const sessions = useCallsStore((s) => s.sessions)
	const sessionOrder = useCallsStore((s) => s.sessionOrder)
	const hostUserId = useCallsStore((s) => s.hostUserId)
	const hostControlsAllowed = useCallsStore((s) => s.config.hostControlsAllowed)
	const setParticipantsOpen = useCallsStore((s) => s.setParticipantsOpen)

	const [busy, setBusy] = useState<string | null>(null)
	const [confirmRemove, setConfirmRemove] = useState<CallSession | null>(null)
	const isHost = !!authUserId && hostUserId === authUserId && hostControlsAllowed

	const nameFor = (userId: string): string => userDisplayName(users[userId] as never)

	const runHost = async (action: string, key: string, body?: Record<string, unknown>) => {
		if (!callId) return
		setBusy(key)
		try {
			await hostAction(callId, action, body)
		} catch (e) {
			toast({ title: t('chat.call.error', 'Lỗi cuộc gọi'), description: (e as Error).message, variant: 'destructive' })
		} finally {
			setBusy(null)
		}
	}

	const participants = sessionOrder.map((id) => sessions[id]).filter((s): s is CallSession => !!s)

	const renderRow = (s: CallSession) => {
		const isSelf = s.userId === authUserId
		const name = nameFor(s.userId) || (isSelf ? t('chat.you', 'Bạn') : s.sessionId.slice(0, 8))
		return (
			<div
				key={s.sessionId}
				className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
			>
									<div className="relative shrink-0">
					<UserAvatar userId={s.userId} displayName={name} size="sm" />
					{s.voice && (
						<span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-neutral-950" />
					)}
					</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1.5 text-sm text-white/90 truncate">
						<span className="truncate">{name}{isSelf ? ` (${t('chat.you', 'Bạn')})` : ''}</span>
						{s.isHost && <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" aria-label={t('chat.host', 'chủ trì')} />}
					</div>
					<div className="flex items-center gap-1.5 text-[11px] text-white/50">
						{!s.unmuted && (
							<span className="flex items-center gap-0.5">
								<MicOff className="h-3 w-3" />
								{t('chat.muted', 'Đã tắt tiếng')}
							</span>
						)}
						{s.raisedHand > 0 && (
							<span className="flex items-center gap-0.5 text-amber-400/90">
								<Hand className="h-3 w-3" />
								{t('chat.handRaised', 'Giơ tay')}
							</span>
						)}
						{s.video && <span>{t('chat.cameraOn', 'Đang bật camera')}</span>}
					{s.screenOn && <span>{t('chat.sharingScreen', 'Đang chia sẻ')}</span>}
					</div>
				</div>
				{isHost && !isSelf && (
					<div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
						<IconButton
							label={t('chat.mute', 'Tắt tiếng')}
							busy={busy === `mute-${s.sessionId}`}
							onClick={() => runHost('mute', `mute-${s.sessionId}`, { sessionID: s.sessionId })}
						>
							<MicOff className="h-3.5 w-3.5" />
						</IconButton>
						{s.screenOn && (
							<IconButton
								label={t('chat.stopShare', 'Dừng chia sẻ')}
								busy={busy === `screen-${s.sessionId}`}
								onClick={() => runHost('screen-off', `screen-${s.sessionId}`, { sessionID: s.sessionId })}
							>
								<MonitorX className="h-3.5 w-3.5" />
							</IconButton>
						)}
						{s.raisedHand > 0 && (
							<IconButton
								label={t('chat.lowerHand', 'Hạ tay')}
								busy={busy === `hand-${s.sessionId}`}
								onClick={() => runHost('lower-hand', `hand-${s.sessionId}`, { sessionID: s.sessionId })}
							>
								<Hand className="h-3.5 w-3.5" />
							</IconButton>
						)}
						<IconButton
							label={t('chat.makeHost', 'Chuyển chủ trì')}
							busy={busy === `host-${s.sessionId}`}
							onClick={() => runHost('make', `host-${s.sessionId}`, { newHostID: s.userId })}
						>
							<Crown className="h-3.5 w-3.5" />
						</IconButton>
						<IconButton
							label={t('chat.remove', 'Mời ra')}
							busy={busy === `rm-${s.sessionId}`}
							onClick={() => setConfirmRemove(s)}
						>
							<UserMinus className="h-3.5 w-3.5" />
						</IconButton>
					</div>
				)}
			</div>
		)
	}

	return (
		<aside className="flex h-full w-[280px] shrink-0 flex-col border-l border-white/10 bg-neutral-950/80">
			<div className="flex items-center justify-between px-3 h-12 border-b border-white/10 shrink-0">
				<span className="text-sm font-medium text-white/90">
					{t('chat.participants', 'Thành viên')} ({participants.length})
				</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-white/70 hover:bg-white/10"
					onClick={() => setParticipantsOpen(false)}
					aria-label={t('chat.close', 'Đóng')}
				>
					{t('chat.close', 'Đóng')}
				</Button>
			</div>
			<div className="flex-1 overflow-y-auto p-2">{participants.map(renderRow)}</div>
			{isHost && participants.length > 1 && (
				<div className="border-t border-white/10 p-2 shrink-0">
					<Button
						variant="outline"
						size="sm"
						className="w-full border-white/15 bg-transparent text-white/80 hover:bg-white/10 hover:text-white"
						onClick={() => runHost('mute-others', 'mute-others')}
					>
						<VolumeX className="mr-1.5 h-4 w-4" />
						{t('chat.muteOthers', 'Tắt tiếng tất cả')}
					</Button>
				</div>
			)}
						<ConfirmRemoveDialog
					target={confirmRemove ? { ...confirmRemove, displayName: nameFor(confirmRemove.userId) || confirmRemove.sessionId.slice(0, 8) } : null}
					onCancel={() => setConfirmRemove(null)}
					onConfirm={() => confirmRemove && runHost('remove', `rm-${confirmRemove.sessionId}`, { sessionID: confirmRemove.sessionId })}
				/>
</aside>
	)
}

function IconButton({
	label, onClick, busy, children,
}: {
	label: string
	onClick: () => void
	busy?: boolean
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			disabled={busy}
			onClick={(e) => { e.stopPropagation(); onClick() }}
			className={cn(
				'h-6 w-6 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40',
			)}
		>
			{children}
		</button>
	)
}
