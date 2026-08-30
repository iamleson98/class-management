/**
 * call-tile — one participant tile in the call grid.
 *
 * Shows the remote camera stream when the participant broadcasts video
 * (bound by origin session id), otherwise their avatar. Speaking state
 * (SFU VAD) highlights the border; overlays carry name, host tag, mute and
 * raised-hand indicators. The local participant renders the mirrored
 * self-preview from the client's local stream.
 */

'use client'

import { useEffect, useRef } from 'react'
import { Hand, MicOff, Star } from 'lucide-react'
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

	return (
		<div
			className={cn(
				'relative aspect-video rounded-xl overflow-hidden bg-white/5 flex items-center justify-center ring-1',
				session.voice ? 'ring-2 ring-emerald-500' : 'ring-white/10',
			)}
			data-speaking={session.voice || undefined}
		>
			{showVideo ? (
				<video
					ref={videoRef}
					autoPlay
					playsInline
					muted={isSelf}
					className={cn('w-full h-full object-cover', mirror && 'scale-x-[-1]')}
				/>
			) : (
				<UserAvatar userId={session.userId} displayName={displayName || '?'} size="2xl" />
			)}

			{/* Overlays */}
			<div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 text-white text-xs">
				<span className="bg-black/60 px-1.5 py-0.5 rounded max-w-[70%] truncate backdrop-blur-sm">
					{displayName || (isSelf ? t('chat.you', 'Bạn') : '')}
				</span>
				<div className="flex items-center gap-1.5 shrink-0">
					{session.isHost && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" aria-label={t('chat.host', 'chủ trì')} />}
					{!session.unmuted && <MicOff className="h-3.5 w-3.5" />}
					{session.raisedHand > 0 && <Hand className="h-3.5 w-3.5 text-amber-400" />}
				</div>
			</div>
		</div>
	)
}
