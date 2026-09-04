/**
 * Chat store tests — reaction hydration from post metadata.
 *
 * The server includes `metadata.reactions` on posts that have reactions
 * (channel post lists, thread fetches, WS posted events). Without seeding
 * `reactionsByPost` from that metadata, reactions only ever appeared via live
 * WebSocket events and disappeared after a reload — the exact bug this suite
 * guards against.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from './store'
import type { ChatPost, ChatReaction } from './types'

const CH = 'ch1'

type TestMetadata = { reactions?: ChatReaction[] }

function makePost(id: string, over: Record<string, unknown> = {}): ChatPost {
	return {
		id,
		channel_id: CH,
		user_id: 'u1',
		root_id: '',
		message: 'm',
		create_at: 1,
		update_at: 1,
		delete_at: 0,
		...over,
	} as unknown as ChatPost
}

function makeReaction(postId: string, emoji: string, userId = 'u2'): ChatReaction {
	return {
		user_id: userId,
		post_id: postId,
		emoji_name: emoji,
		create_at: 5,
		update_at: 5,
	} as ChatReaction
}

describe('reaction hydration from post metadata', () => {
	beforeEach(() => {
		useChatStore.getState().reset()
	})

	it('seeds reactionsByPost when setChannelPosts receives metadata.reactions', () => {
		const reactions = [makeReaction('p1', 'smile')]
		useChatStore.getState().setChannelPosts(CH, [makePost('p1', { metadata: { reactions } })], { reset: true })

		expect(useChatStore.getState().reactionsByPost['p1']).toEqual(reactions)
	})

	it('seeds reactions for prependPosts, appendPosts and upsertPost', () => {
		const viaPrepend = [makeReaction('p1', 'tada')]
		useChatStore.getState().prependPosts(CH, [makePost('p1', { metadata: { reactions: viaPrepend } as unknown as TestMetadata })])
		expect(useChatStore.getState().reactionsByPost['p1']).toEqual(viaPrepend)

		const viaAppend = [makeReaction('p2', 'rocket')]
		useChatStore.getState().appendPosts(CH, [makePost('p2', { metadata: { reactions: viaAppend } as unknown as TestMetadata })])
		expect(useChatStore.getState().reactionsByPost['p2']).toEqual(viaAppend)

		const viaUpsert = [makeReaction('p3', 'eyes')]
		useChatStore.getState().upsertPost(makePost('p3', { metadata: { reactions: viaUpsert } as unknown as TestMetadata }))
		expect(useChatStore.getState().reactionsByPost['p3']).toEqual(viaUpsert)
	})

	it('leaves existing reactions untouched when a post arrives without reaction metadata', () => {
		// Realtime WS state first (reaction_added event path).
		useChatStore.getState().addReaction(makeReaction('p1', 'smile'))

		// Then a post upsert without metadata (e.g. an edit) must not clear it.
		useChatStore.getState().upsertPost(makePost('p1', { metadata: {} as unknown as TestMetadata }))

		expect(useChatStore.getState().reactionsByPost['p1']).toHaveLength(1)
	})

	it('server truth (empty array) clears stale reactions on reload', () => {
		useChatStore.getState().addReaction(makeReaction('p1', 'smile'))

		// Server says the post has no reactions anymore (all were removed).
		useChatStore.getState().setChannelPosts(CH, [makePost('p1', { metadata: { reactions: [] } as unknown as TestMetadata })], { reset: true })

		expect(useChatStore.getState().reactionsByPost['p1']).toEqual([])
	})

	it('keeps WS-live reaction wins while a later fetch carries the same set', () => {
		const live = [makeReaction('p1', 'fire', 'u9')]
		useChatStore.getState().setChannelPosts(CH, [makePost('p1', { metadata: { reactions: live } as unknown as TestMetadata })], { reset: true })

		// A WS reaction_added for another user merges via the store action.
		useChatStore.getState().addReaction(makeReaction('p1', 'fire', 'u3'))

		expect(useChatStore.getState().reactionsByPost['p1']).toHaveLength(2)
	})
})
