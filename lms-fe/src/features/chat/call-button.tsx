'use client'

/**
 * CallButton — the channel-header control that starts or joins a call.
 *
 * Renders the call icon in the channel header. When clicked, it joins (or
 * starts) a call in the active channel via the CallsClient. The button label
 * reflects whether a call is already in progress in the channel.
 *
 * Ports the vendored channel_header_button's role: a single entry point into
 * the call experience for the active channel.
 */

import { Phone, PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { callsClient } from '@/features/calls/calls-client'
import { useCallsStore } from '@/features/calls/calls-store'

export function CallButton({ channelId, enableVideo }: { channelId: string; enableVideo?: boolean }) {
	const { t } = useTranslation()
	// In the call locally, or a call exists in the channel (joinable).
	const inCall = useCallsStore((s) => s.channelId === channelId)
	const callExists = useCallsStore((s) => !!s.activeCalls[channelId])

	const onClick = () => {
		if (inCall) return // already in this call; the widget handles the rest
		callsClient.join(channelId, { enableVideo })
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative h-8 w-8"
					onClick={onClick}
					aria-label={inCall ? t('chat.joinCall', 'Tham gia cuộc gọi') : t('chat.startCall', 'Bắt đầu cuộc gọi')}
				>
					{inCall ? <PhoneCall className="h-4 w-4 text-emerald-600" /> : <Phone className="h-4 w-4 text-muted-foreground" />}
					{inCall ? (
						<span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
					) : null}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{inCall || callExists ? t('chat.joinCall', 'Tham gia cuộc gọi') : t('chat.startCall', 'Bắt đầu cuộc gọi')}</TooltipContent>
		</Tooltip>
	)
}
