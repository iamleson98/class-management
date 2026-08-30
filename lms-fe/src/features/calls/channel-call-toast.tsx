/**
 * Channel call toast — ports the plugin webapp's channel_call_toast: when the
 * channel the user is VIEWING has an in-progress call they are not in, a green
 * toast sits at the top of the message list with the elapsed time, up to two
 * participant avatars and a Join button (dismissable).
 *
 * Participant avatars resolve through the native REST API (GET /calls/{id});
 * while that is in flight the toast renders without them.
 */

'use client'

import { useEffect, useState } from 'react'
import { Phone } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { useChatStore } from '@/lib/chat/store'
import { useCallsStore } from './calls-store'

interface ToastCallState {
	sessions?: Array<{ user_id?: string }>
}

export function ChannelCallToast({ channelId }: { channelId: string }) {
	const { t } = useTranslation()
	const users = useChatStore((s) => s.users)
	const active = useCallsStore((s) => s.activeCalls[channelId])
	const inThisCall = useCallsStore((s) => s.channelId === channelId)
	const inAnyCall = useCallsStore((s) => s.status !== 'disconnected' && s.status !== 'error')
	const maxParticipants = useCallsStore((s) => s.config.maxParticipants)
	/** The call id the user dismissed (null = nothing dismissed). */
	const [dismissedFor, setDismissedFor] = useState<string | null>(null)
	const [participants, setParticipants] = useState<string[]>([])
	const [, force] = useState(0)

	// Resolve participant user ids through the REST API (the WS sessions map
	// only covers the call we are personally in).
	useEffect(() => {
		if (!active?.callId || inThisCall) return
		let cancelled = false
		const load = async () => {
			try {
				const res = await fetch(`/api/v4/calls/${active.callId}`, {
					credentials: 'include',
					headers: { 'X-Requested-With': 'XMLHttpRequest' },
				})
				if (!res.ok) return
				const state = (await res.json()) as ToastCallState
				if (cancelled) return
				setParticipants((state.sessions ?? []).map((s) => s.user_id ?? '').filter(Boolean))
			} catch {
				// best-effort only
			}
		}
		void load()
		const timer = window.setInterval(load, 15_000)
		return () => {
			cancelled = true
			window.clearInterval(timer)
		}
	}, [active?.callId, inThisCall])

	// Refresh the elapsed label every 5s (plugin parity).
	useEffect(() => {
		if (!active) return
		const timer = window.setInterval(() => force((n) => n + 1), 5_000)
		return () => window.clearInterval(timer)
	}, [active?.callId])

	if (!active || inThisCall || dismissedFor === active.callId) return null

	// Hide at the participant limit (nothing to join).
	if (maxParticipants > 0 && participants.length >= maxParticipants) return null

	const elapsed = active.startAt ? formatElapsed(Date.now() - active.startAt) : ''
	const joinableLabel = inAnyCall ? t('chat.callToast.switch', 'Chuyển sang cuộc gọi') : t('chat.callToast.join', 'Tham gia cuộc gọi')

	return (
		<div className="sticky top-0 z-20 flex items-center justify-center px-4 pt-3 pointer-events-none">
			<div
				className="pointer-events-auto flex items-center gap-3 rounded-full bg-emerald-600/95 text-white pl-3 pr-2 py-1.5 shadow-xl ring-1 ring-emerald-400/40"
				role="status"
			>
				<Phone className="h-4 w-4 animate-pulse shrink-0" aria-hidden />
				{participants.length > 0 && (
					<div className="flex items-center -space-x-1.5 shrink-0">
						{participants.slice(0, 2).map((uid) => {
							const u = users[uid] as Record<string, any> | undefined
							const name = u
								? `${u.firstname ?? u.first_name ?? ''} ${u.lastname ?? u.last_name ?? ''}`.trim() || u.username
								: '?'
							return (
								<Avatar key={uid} className="h-5 w-5 border border-emerald-600">
									<AvatarFallback className="bg-emerald-800/60 text-[9px] text-white">
										{name.slice(0, 1).toUpperCase()}
									</AvatarFallback>
								</Avatar>
							)
						})}
					</div>
				)}
				<span className="text-sm font-medium whitespace-nowrap">
					{joinableLabel}
					{elapsed && <span className="opacity-80 font-normal"> · {elapsed}</span>}
				</span>
				<Button
					size="sm"
					className="h-7 rounded-full bg-white text-emerald-700 hover:bg-emerald-50 px-3"
					onClick={() => {
						window.dispatchEvent(new CustomEvent('calls:join-channel', { detail: { channelId } }))
					}}
				>
					{t('chat.callToast.joinButton', 'Vào')}
				</Button>
				<button
					type="button"
					aria-label={t('chat.callToast.dismiss', 'Ẩn')}
					onClick={() => setDismissedFor(active.callId)}
					className="h-6 w-6 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors"
				>
					×
				</button>
			</div>
		</div>
	)
}

function formatElapsed(ms: number): string {
	const mins = Math.max(0, Math.floor(ms / 60_000))
	if (mins < 1) return 'vừa bắt đầu'
	if (mins < 60) return `${mins} phút`
	const hours = Math.floor(mins / 60)
	return `${hours} giờ`
}
