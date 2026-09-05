/**
 * Shared visual language for chat message rows (used by the channel list,
 * thread pane, and RHS post lists).
 *
 * Design tokens follow the 2025 team-chat convention (Slack / Discord /
 * Teams Fluent 2): flat full-width rows with an avatar gutter, grouped
 * consecutive messages from one sender, per-user deterministic name colors,
 * and a 13/15px type scale. See the "Aurora" palette in globals.css for the
 * underlying surface colors — the classes below reference semantic tokens so
 * both themes stay in sync.
 */

/** Same message grouping window as Slack: consecutive same-sender posts
 *  merge into one group unless the gap exceeds this. */
export const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000

/**
 * Deterministic per-user name color. A stable hash of the user id maps onto
 * the same palette used for avatars so a user's name always renders in the
 * same hue (the "colored usernames, not colored bubbles" rule).
 */
const NAME_COLOR_CLASSES = [
	'text-rose-600 dark:text-rose-400',
	'text-amber-600 dark:text-amber-400',
	'text-lime-700 dark:text-lime-400',
	'text-teal-700 dark:text-teal-400',
	'text-sky-700 dark:text-sky-400',
	'text-indigo-600 dark:text-indigo-400',
	'text-violet-600 dark:text-violet-400',
	'text-fuchsia-600 dark:text-fuchsia-400',
] as const

function hashString(str: string): number {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash)
	}
	return Math.abs(hash)
}

export function nameColorClass(userId: string | undefined): string {
	if (!userId) return ''
	return NAME_COLOR_CLASSES[hashString(userId) % NAME_COLOR_CLASSES.length]
}

/** Whether `post` starts a new visual group after `prev` (same channel). */
export function startsMessageGroup(
	prev: { user_id: string; create_at: number } | null | undefined,
	post: { user_id: string; create_at: number },
): boolean {
	if (!prev) return true
	return prev.user_id !== post.user_id || post.create_at - prev.create_at > MESSAGE_GROUP_WINDOW_MS
}
