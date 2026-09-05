/**
 * WebSocket dispatcher tests for the user_updated profile-refresh path.
 *
 * The server publishes user_updated on every profile change (avatar
 * upload/removal, name/position updates) with the sanitized user object.
 * The dispatcher upserts it into the chat store so `last_picture_update`
 * changes — which every avatar <img> uses as its cache-buster — reach all
 * subscribed components live.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

const sendMock = vi.fn()
vi.mock('@/lib/chat/client', () => ({
        wsClient: {
                sendMessage: (action: string, data?: Record<string, unknown>) => sendMock(action, data),
                addMessageListener: vi.fn(),
                addReconnectListener: vi.fn(),
                addMissedMessageListener: vi.fn(),
                addFirstConnectListener: vi.fn(),
                addCloseListener: vi.fn(),
                initialize: vi.fn(),
        },
        client4: {},
}))

import { wsClient } from '@/lib/chat/client'
import { useChatStore } from './store'
import { bindChatWebSocket } from './websocket-events'
import type { WebSocketMessage } from '@mattermost/client'

/** The raw server payload: lowercase-concatenated keys, like model.User JSON. */
const userUpdatedEvent = (user: Record<string, unknown>): WebSocketMessage =>
        ({
                event: 'user_updated',
                data: { user },
                broadcast: {},
        }) as unknown as WebSocketMessage

describe('user_updated handling', () => {
        let handler: (msg: WebSocketMessage) => void

        // bindChatWebSocket binds only once per module lifetime (listenerBound
        // flag), so capture the dispatcher exactly once; it reads the store via
        // getState() at event time, so per-test store resets are honored.
        beforeAll(() => {
                bindChatWebSocket()
                const add = wsClient.addMessageListener as unknown as ReturnType<typeof vi.fn>
                handler = add.mock.calls[0]?.[0] as (msg: WebSocketMessage) => void
                expect(handler).toBeTypeOf('function')
        })

        beforeEach(() => {
                useChatStore.setState({ users: {} })
        })

        it('upserts the user with normalized keys (last_picture_update)', () => {
                handler(
                        userUpdatedEvent({
                                id: 'u1',
                                username: 'alice',
                                firstname: 'Alice',
                                lastpictureupdate: 1730000000000,
                        }),
                )

                const u = useChatStore.getState().users.u1 as Record<string, unknown>
                expect(u).toBeDefined()
                expect(u.last_picture_update).toBe(1730000000000)
                expect(u.first_name).toBe('Alice')
        })

        it('updates an existing user in place (avatar change refresh)', () => {
                useChatStore.getState().upsertUsers([{ id: 'u1', username: 'alice' } as never])

                handler(userUpdatedEvent({ id: 'u1', username: 'alice', lastpictureupdate: 42 }))

                const u = useChatStore.getState().users.u1 as Record<string, unknown>
                expect(u.last_picture_update).toBe(42)
                expect(useChatStore.getState().users.u1?.username).toBe('alice')
        })

        it('ignores malformed payloads without crashing', () => {
                expect(() => handler({ event: 'user_updated', data: {}, broadcast: {} } as never)).not.toThrow()
                expect(() => handler(userUpdatedEvent('nope' as unknown as Record<string, unknown>))).not.toThrow()
                expect(useChatStore.getState().users.u1).toBeUndefined()
        })
})
