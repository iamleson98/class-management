'use client'

/**
 * CallButton — the channel-header control that starts or joins a call.
 *
 * Renders the call icon in the channel header. When clicked, it joins (or
 * starts) a call in the active channel via the CallsClient. The button label
 * reflects whether a call is already in progress in the channel.
 *
 * Ports the vendored channel_header_button's role plus its gating: hidden
 * when the calls config disables the feature or group calls are disallowed
 * for a non-DM channel; disabled at the participant limit; shows a spinner
 * while connecting.
 */

import { Loader2, Phone, PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { useCallsConfig } from '@/features/calls/calls-config'
import { callsClient } from '@/features/calls/calls-client'
import { useCallsStore } from '@/features/calls/calls-store'

export function CallButton({
	channelId,
	channelType,
	enableVideo,
}: {
	channelId: string
	/** Channel type ('O' | 'P' | 'D' | 'G') for config gating. */
	channelType?: string
	enableVideo?: boolean
}) {
	const { t } = useTranslation()
	useCallsConfig()
	// In the call locally, or a call exists in the channel (joinable).
	const inCall = useCallsStore((s) => s.channelId === channelId)
	const callExists = useCallsStore((s) => !!s.activeCalls[channelId])
	const enabled = useCallsStore((s) => s.config.enabled)
	const groupCallsAllowed = useCallsStore((s) => s.config.groupCallsAllowed)
	const maxParticipants = useCallsStore((s) => s.config.maxParticipants)
	const participantCount = useCallsStore((s) => s.sessionOrder.length)
	const status = useCallsStore((s) => s.status)

	const isDM = channelType === 'D' || channelType === 'G'
	if (!enabled) return null
	// Group-calls disabled: only DM/GM channels may call.
	if (!groupCallsAllowed && !isDM) return null

	const connectingHere = !inCall && (status === 'connecting' || status === 'reconnecting')
	// Limit gating applies when joining an existing call (the count is only
	// known for the active call, which is also the limit-checked one).
	const atLimit = maxParticipants > 0 && callExists && !inCall && participantCount >= maxParticipants

	const onClick = () => {
		if (inCall || atLimit) return // already in this call; the widget handles the rest
		window.dispatchEvent(new CustomEvent('calls:join-channel', { detail: { channelId } }))
		void callsClient.join(channelId, { enableVideo })
	}

	const label = atLimit
		? t('chat.call.limitReached', 'Cuộc gọi đã đủ số người')
		: inCall || callExists
			? t('chat.joinCall', 'Tham gia cuộc gọi')
			: t('chat.startCall', 'Bắt đầu cuộc gọi')

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative h-8 w-8"
					onClick={onClick}
					disabled={connectingHere || atLimit}
					aria-label={label}
				>
					{connectingHere ? (
						<Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
					) : inCall ? (
						<PhoneCall className="h-4 w-4 text-emerald-600" />
					) : (
						<Phone className={`h-4 w-4 ${atLimit ? 'text-muted-foreground/40' : 'text-muted-foreground'}`} />
					)}
					{inCall ? (
						<span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
					) : null}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	)
}
