/**
 * UserAvatar — a participant avatar that renders the user's real profile
 * image (GET /api/v4/users/{id}/image, session-cookie authenticated) and
 * falls back to colored initials like the rest of the app when the image is
 * missing/blocked. Ports the plugin webapp's avatar usage across the calls UI.
 */

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

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
					src={`/api/v4/users/${userId}/image`}
					alt={displayName}
					data-testid="user-avatar-img"
					onError={() => setFailed(true)}
					className={cn('rounded-full object-cover bg-white/10', SIZE_CLASSES[size], className)}
				/>
			)}
		</span>
	)
}
