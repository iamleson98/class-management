/**
 * UserAvatar — a participant avatar that renders the user's real profile
 * image (GET /api/v4/users/{id}/image, session-cookie authenticated) and
 * falls back to colored initials like the rest of the app when the image is
 * missing/blocked. Ports the plugin webapp's avatar usage across the calls UI.
 */

'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/lib/chat/store'

const AVATAR_COLORS = [
	'bg-sky-500',
	'bg-teal-500',
	'bg-violet-500',
	'bg-amber-500',
	'bg-rose-500',
	'bg-cyan-500',
	'bg-orange-500',
	'bg-pink-500',
	'bg-lime-500',
	'bg-fuchsia-500',
]

function hashString(str: string): number {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash)
	}
	return Math.abs(hash)
}

const SIZE_CLASSES = {
	xs: 'h-6 w-6 text-[10px]',
	sm: 'h-8 w-8 text-xs',
	md: 'h-10 w-10 text-sm',
	lg: 'h-12 w-12 text-base',
	xl: 'h-14 w-14 text-lg',
	'2xl': 'h-16 w-16 text-lg',
} as const

export function UserAvatar({
	userId,
	displayName,
	size = 'sm',
	className,
	ringClassName,
}: {
	userId: string
	displayName: string
	size?: keyof typeof SIZE_CLASSES
	className?: string
	/** Extra classes applied to the outer wrapper (e.g. speaking ring). */
	ringClassName?: string
}) {
	const [failed, setFailed] = useState(false)
	// The profile image endpoint sends Cache-Control: max-age=86400 and the
	// URL never changes when a user re-uploads their picture, so a bare URL
	// pins the STALE avatar for a day. last_picture_update (bumped server-side
	// on every picture change) is the canonical cache-buster; it flows through
	// the normalized chat store users. The selector returns a number
	// (primitive), so the useSyncExternalStore snapshot stays stable.
	const picVersion = useChatStore((s) => {
		const u = s.users[userId] as { last_picture_update?: number } | undefined
		return u?.last_picture_update ?? 0
	})

	// A new picture version should retry the <img> even if an earlier fetch
	// failed (e.g. a user uploads their first avatar).
	useEffect(() => {
		setFailed(false)
	}, [picVersion])

	const initials = displayName
		.split(' ')
		.map((w) => w[0])
		.join('')
		.toUpperCase()
		.slice(0, 2) || '?'
	const color = AVATAR_COLORS[hashString(userId || displayName) % AVATAR_COLORS.length]

	return (
		<span className={cn('relative inline-flex shrink-0', ringClassName)}>
			{failed ? (
				<span
					data-testid="user-avatar-fallback"
					className={cn(
						'rounded-full flex items-center justify-center font-semibold text-white select-none',
						color,
						SIZE_CLASSES[size],
						className,
					)}
				>
					{initials}
				</span>
			) : (
				<img
					key={picVersion}
					src={`/api/v4/users/${userId}/image?_${picVersion}`}
					alt={displayName}
					data-testid="user-avatar-img"
					onError={() => setFailed(true)}
					className={cn('rounded-full object-cover bg-white/10', SIZE_CLASSES[size], className)}
				/>
			)}
		</span>
	)
}
