/**
 * In-call chat panel — ports the expanded view's chat toggle: a right-hand
 * pane inside the call overlay showing the channel's posts and a composer, so
 * participants never leave the call to talk in text.
 *
 * Reuses the chat feature's PostList + PostComposer (they are keyed purely by
 * channelId, so they bind the same store data).
 */

'use client'

import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { useChatStore } from '@/lib/chat/store'
import { PostList } from '@/features/chat/post-list'
import { PostComposer } from '@/features/chat/post-composer'
import { useCallsStore } from './calls-store'

export function CallChatPanel() {
	const { t } = useTranslation()
	const channelId = useCallsStore((s) => s.channelId)
	const setChatOpen = useCallsStore((s) => s.setChatOpen)
	const channel = useChatStore((s) => (channelId ? s.channels[channelId] : undefined))

	if (!channelId || !channel) return null

	return (
		<aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-white/10 bg-neutral-950/80">
			<div className="flex items-center justify-between px-3 h-12 border-b border-white/10 shrink-0">
				<span className="flex items-center gap-1.5 text-sm font-medium text-white/90 truncate">
					<MessageSquare className="h-3.5 w-3.5 shrink-0" />
					<span className="truncate">{channel.display_name || t('chat.chat', 'Trò chuyện')}</span>
				</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-white/70 hover:bg-white/10"
					onClick={() => setChatOpen(false)}
					aria-label={t('chat.close', 'Đóng')}
				>
					{t('chat.close', 'Đóng')}
				</Button>
			</div>
			<div className="flex-1 min-h-0 overflow-hidden">
				<PostList
					channelId={channelId}
					onOpenThread={() => setChatOpen(true)}
				/>
			</div>
			<div className="border-t border-white/10 p-2 shrink-0">
				<PostComposer channelId={channelId} />
			</div>
		</aside>
	)
}
