/**
 * Reaction stream + reaction button — ports the plugin webapp's
 * reaction_stream and reaction_button components.
 *
 * The stream renders the ephemeral overlay at the bottom of the expanded call
 * view: recent reactions float up as chips (emoji + author name, expiring
 * after 10s, capped at 50), with a highlighted "raised a hand" chip when
 * hands are up. The reaction button offers a curated quick-emoji row plus the
 * full chat emoji picker, sending reactions over the calls WebSocket.
 */

'use client'

import { useRef, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SmilePlus } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { useChatStore } from '@/lib/chat/store'
import { shortcodeToUnicode } from '@/lib/chat/emoji-data'
import { EmojiPicker } from '@/features/chat/emoji-picker'
import { callsClient } from './calls-client'
import { useCallsStore, selectRaisedHands } from './calls-store'

/** Curated quick reactions (first row of the popover). */
const QUICK_REACTIONS = ['thumbsup', 'thumbsdown', 'heart', 'clap', 'joy', 'tada', 'eyes', 'raising_hand'] as const

function nameFor(userId: string): string {
	const u = useChatStore.getState().users[userId] as Record<string, any> | undefined
	if (!u) return ''
	const first = u.firstname ?? u.first_name ?? ''
	const last = u.lastname ?? u.last_name ?? ''
	return `${first} ${last}`.trim() || u.username || ''
}

/** The floating reaction overlay (bottom-anchored, pointer-transparent). */
export function ReactionStream() {
	const { t } = useTranslation()
	const reactions = useCallsStore((s) => s.reactions)
	const sessions = useCallsStore((s) => s.sessions)
	const hands = useCallsStore(selectRaisedHands)

	if (reactions.length === 0 && hands.length === 0) return null

	const handNames = hands
		.map((h) => nameFor(h.userId))
		.filter(Boolean)
	const handLabel =
		handNames.length === 0
			? t('chat.reaction.someone', 'Ai đó')
			: handNames.length <= 2
				? handNames.join(', ')
				: `${handNames.slice(0, 2).join(', ')} +${handNames.length - 2}`

	return (
		<div className="pointer-events-none absolute bottom-4 left-0 right-0 z-20 flex flex-col items-center gap-1.5 px-4">
			{hands.length > 0 && (
				<div className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-neutral-900 shadow-lg">
					<span aria-hidden>✋</span>
					<span className="max-w-[280px] truncate">
						{t('chat.reaction.raisedHand', '{names} giơ tay', { names: handLabel })}
					</span>
				</div>
			)}
			<div className="flex max-h-40 flex-col-reverse items-center gap-1 overflow-hidden [mask-image:linear-gradient(to_top,black_70%,transparent)]">
				{reactions.slice(-12).map((r) => (
					<div
						key={r.id}
						className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white shadow backdrop-blur-sm"
					>
						<span className="text-base leading-none" aria-hidden>{r.emoji}</span>
						<span className="max-w-[160px] truncate opacity-90">{nameFor(r.userId) || t('chat.reaction.someone', 'Ai đó')}</span>
					</div>
				))}
			</div>
			{/* hidden a11y live region for screen readers */}
			<div className="sr-only" aria-live="polite">
				{reactions.map((r) => `${nameFor(r.userId)} ${t('chat.reaction.reacted', 'đã bày tỏ cảm xúc')} ${r.emoji}`).join('. ')}
				{hands.length > 0 ? `${handLabel} ${t('chat.reaction.raisedHandA11y', 'giơ tay')}.` : ''}
			</div>
			{/** sessions referenced for re-render on presence change */}
			<span className="hidden">{Object.keys(sessions).length}</span>
		</div>
	)
}

/** The reaction button (quick row + full picker). */
export function ReactionButton() {
	const { t } = useTranslation()
	const [open, setOpen] = useState(false)
	const [showFull, setShowFull] = useState(false)
	const enableReactions = useCallsStore((s) => s.config.enableReactions)
	const ref = useRef<HTMLButtonElement>(null)

	if (!enableReactions) return null

	// Reset the picker level when the popover closes (event handler, not effect).
	const onOpenChange = (next: boolean) => {
		setOpen(next)
		if (!next) setShowFull(false)
	}

	const send = (shortName: string) => {
		const literal = shortcodeToUnicode(shortName) ?? '👍'
		callsClient.sendReaction({ name: shortName, literal })
		setOpen(false)
	}

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<Tooltip>
				<PopoverTrigger asChild>
					<Button
						ref={ref}
						variant="ghost"
						size="icon"
						aria-label={t('chat.reaction.react', 'Bày tỏ cảm xúc')}
						aria-expanded={open}
						className="h-11 w-11 rounded-full bg-white/5 text-white/70 hover:bg-white/15"
					>
						<SmilePlus className="h-5 w-5" />
					</Button>
				</PopoverTrigger>
				<TooltipContent>{t('chat.reaction.react', 'Bày tỏ cảm xúc')}</TooltipContent>
			</Tooltip>
			<PopoverContent align="center" className="w-auto p-2">
				{!showFull ? (
					<div className="flex flex-col items-center gap-1">
						<div className="grid grid-cols-8 gap-0.5">
							{QUICK_REACTIONS.map((name) => (
								<button
									key={name}
									type="button"
									title={`:${name}:`}
									aria-label={`:${name}:`}
									onClick={() => send(name)}
									className="h-9 w-9 rounded-md text-xl leading-none hover:bg-muted/60 transition-colors flex items-center justify-center"
								>
									{shortcodeToUnicode(name) ?? '👍'}
								</button>
							))}
						</div>
						<button
							type="button"
							onClick={() => setShowFull(true)}
							className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							{t('chat.reaction.more', 'Xem thêm emoji…')}
						</button>
					</div>
				) : (
					<div className="w-[340px]">
						<EmojiPicker onSelect={send} onClose={() => setOpen(false)} />
					</div>
				)}
			</PopoverContent>
		</Popover>
	)
}
