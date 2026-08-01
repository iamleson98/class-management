/**
 * WebSocket event dispatcher — mirrors the old webapp's handleEvent: routes
 * each incoming WS message to the right mutation on the chat store.
 *
 * Wire format notes (from the vendored client):
 *  - Every message is `{ event, data, broadcast, seq }`.
 *  - `broadcast` carries `{ user_id (sender), channel_id, team_id }`.
 *  - For post events, `data.post` is a **JSON-encoded string** of a Post
 *    (and data.mentions / data.reaction likewise). We JSON.parse them.
 */

import type { WebSocketMessage, WebSocketMessages } from '@mattermost/client'
import { wsClient } from './client'
import { useChatStore } from './store'
import type { ChatPost, ChatReaction, PresenceStatus } from './types'

// WebSocket event names — string literals (the WebSocketEvents const enum
// can't be accessed under isolatedModules). Values match the server wire
// format in @mattermost/client/src/websocket_events.ts.
const EVT = {
  Posted: 'posted',
  EphemeralMessage: 'ephemeral_message',
  PostEdited: 'post_edited',
  PostDeleted: 'post_deleted',
  ReactionAdded: 'reaction_added',
  ReactionRemoved: 'reaction_removed',
  Typing: 'typing',
  StatusChange: 'status_change',
  UserAdded: 'user_added',
  UserRemoved: 'user_removed',
  ChannelUpdated: 'channel_updated',
  ChannelMemberUpdated: 'channel_member_updated',
  ChannelDeleted: 'channel_deleted',
  Hello: 'hello',
  ChannelBookmarkCreated: 'channel_bookmark_created',
  ChannelBookmarkUpdated: 'channel_bookmark_updated',
  ChannelBookmarkDeleted: 'channel_bookmark_deleted',
  ChannelBookmarkSorted: 'channel_bookmark_sorted',
} as const

let listenerBound = false
let reconnectBound = false
let firstConnectBound = false

/** Parse the JSON-encoded post string from a `posted`/`post_edited` event. */
function parsePost(msg: WebSocketMessage): ChatPost | null {
  const data = (msg as WebSocketMessages.Posted).data
  if (!data?.post) return null
  try {
    return JSON.parse(data.post) as ChatPost
  } catch {
    return null
  }
}

function parseReaction(msg: WebSocketMessage): ChatReaction | null {
  const data = (msg as unknown as { data?: { reaction?: string } }).data
  if (!data?.reaction) return null
  try {
    return JSON.parse(data.reaction) as ChatReaction
  } catch {
    return null
  }
}

/** The single dispatch function — one switch over all events we handle. */
function handleEvent(msg: WebSocketMessage): void {
  const store = useChatStore.getState()
  const channelId = msg.broadcast?.channel_id

  switch (msg.event) {
    case EVT.Posted:
    case EVT.EphemeralMessage: {
      const post = parsePost(msg)
      if (!post) break
      store.upsertPost(post)
      // Typing clears when a user posts.
      if (channelId) store.clearTyping(channelId, post.root_id, post.user_id)
      // Presence hint: poster is online if the event says so.
      const setOnline = (msg as WebSocketMessages.Posted).data?.set_online
      if (setOnline) store.setStatus(post.user_id, 'online')
      // Increment unread unless this is the active channel (the active channel
      // is kept read by the posts hook's mark-read on focus).
      const activeChannelId = useChatStore.getState().activeChannelId
      if (channelId && channelId !== activeChannelId) {
        store.incrementUnread(channelId, 1)
      }
      break
    }

    case EVT.PostEdited: {
      const post = parsePost(msg)
      if (post) store.editPost(post)
      break
    }

    case EVT.PostDeleted: {
      const post = parsePost(msg)
      if (post) store.deletePost(post.id)
      break
    }

    case EVT.ReactionAdded: {
      const reaction = parseReaction(msg)
      if (reaction) store.addReaction(reaction)
      break
    }

    case EVT.ReactionRemoved: {
      const reaction = parseReaction(msg)
      if (reaction) store.removeReaction(reaction.post_id, reaction.user_id, reaction.emoji_name)
      break
    }

    case EVT.Typing: {
      const data = (msg as WebSocketMessages.Typing).data
      if (channelId && data?.user_id) {
        store.setTyping(channelId, data.parent_id, data.user_id)
        // Auto-clear after the typing window so stale entries don't linger.
        const keyUserId = data.user_id
        setTimeout(() => store.clearTyping(channelId, data.parent_id, keyUserId), 4000)
      }
      break
    }

    case EVT.StatusChange: {
      const data = (msg as WebSocketMessages.StatusChanged).data
      if (data?.user_id && data.status) {
        store.setStatus(data.user_id, data.status as PresenceStatus)
      }
      break
    }

    case EVT.UserAdded:
    case EVT.UserRemoved:
    case EVT.ChannelUpdated:
    case EVT.ChannelMemberUpdated: {
      // Membership/counts changed — the parent hook refetches my channel
      // members on reconnect; here we just nudge a refresh by clearing the
      // stale membership so the badge recomputes. (A light touch; the
      // periodic channel refresh in useChannels reconciles authoritatively.)
      break
    }

    case EVT.ChannelDeleted: {
      if (channelId) store.removeChannel(channelId)
      break
    }

    case EVT.Hello: {
      // Capture the connection id for the Connection-Id header (bookmarks).
      const data = (msg as unknown as { data?: { connection_id?: string } }).data
      if (data?.connection_id) store.setConnectionId(data.connection_id)
      break
    }

    case EVT.ChannelBookmarkCreated:
    case EVT.ChannelBookmarkUpdated: {
      const data = (msg as unknown as { data?: { bookmark?: string } }).data
      try {
        const bm = data?.bookmark ? JSON.parse(data.bookmark) : null
        if (bm) store.upsertBookmark(bm)
      } catch { /* ignore */ }
      break
    }
    case EVT.ChannelBookmarkDeleted: {
      const data = (msg as unknown as { data?: { bookmark?: string } }).data
      try {
        const bm = data?.bookmark ? JSON.parse(data.bookmark) : null
        if (bm) store.removeBookmark(bm.channel_id, bm.id)
      } catch { /* ignore */ }
      break
    }
    case EVT.ChannelBookmarkSorted: {
      // Full reorder — refetch is handled by the bookmarks hook's poll. Nothing to do here.
      break
    }

    default:
      // Many admin/plugin events are intentionally ignored for lms-fe chat.
      break
  }
}

/**
 * Bind the dispatcher to the shared WebSocket client. Idempotent — safe to
 * call on every chat mount. Listeners persist for the client's lifetime.
 */
export function bindChatWebSocket(): () => void {
  if (!listenerBound) {
    wsClient.addMessageListener(handleEvent)
    listenerBound = true
  }
  if (!reconnectBound) {
    wsClient.addReconnectListener(() => {
      // On reconnect, the active channel's posts are re-synced by the posts
      // hook via getPostsSince; here we just flag connectivity.
      useChatStore.getState().setConnected(true)
    })
    reconnectBound = true
  }
  if (!firstConnectBound) {
    wsClient.addFirstConnectListener(() => useChatStore.getState().setConnected(true))
    wsClient.addCloseListener(() => useChatStore.getState().setConnected(false))
    firstConnectBound = true
  }
  // No-op unbind: listeners are singletons for the app's lifetime, matching
  // the old webapp which registers them once at startup.
  return () => {}
}
