/**
 * CallPostCard — renders posts of type `custom_calls` (the call announcement
 * posts the native server creates on call start / end), porting the plugin
 * webapp's custom_post_types/post_type component:
 *
 *   - "Call started" state: animated call icon, start time, author, avatars of
 *     participants, and a Join call button (or Leave for participants).
 *   - "Call ended" state: ended time + duration + participant count.
 *
 * The card joins/leaves through the calls client, reusing the same events as
 * the channel header button.
 */

'use client'

import { useEffect, useState } from 'react'
import { PhoneCall, PhoneOff, Loader2 } from 'lucide-react'
import { Avatar } from '@/components/shared/avatar'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { useChatStore } from '@/lib/chat/store'
import { useCallsStore } from './calls-store'
import { callsClient } from './calls-client'
import { UserAvatar } from './user-avatar'
import { userDisplayName } from '@/lib/chat/types'

interface CallPostCardProps {
        post: {
                id: string
                channel_id: string
                user_id: string
                create_at: number
                props?: Record<string, unknown>
        }
}

export function CallPostCard({ post }: CallPostCardProps) {
        const { t } = useTranslation()
        const users = useChatStore((s) => s.users)
        const activeCall = useCallsStore((s) => s.activeCalls[post.channel_id])
        const myChannel = useCallsStore((s) => s.channelId)
        const status = useCallsStore((s) => s.status)
        const maxParticipants = useCallsStore((s) => s.config.maxParticipants)
        const [, force] = useState(0)

        // Live "started X ago" label.
        useEffect(() => {
                const timer = window.setInterval(() => force((n) => n + 1), 10_000)
                return () => window.clearInterval(timer)
        }, [])

        const props = post.props ?? {}
        const startAt = (props.start_at as number | undefined) ?? post.create_at
        const endAt = props.end_at as number | undefined
        const participantIds = (props.participants as string[] | undefined) ?? []

        // A call post is "live" when the same channel still has an in-progress call.
        const live = !!activeCall && !endAt
        const inThisCall = myChannel === post.channel_id && status !== 'disconnected' && status !== 'error'
        const atLimit = maxParticipants > 0 && participantIds.length >= maxParticipants

        const author = users[post.user_id]
        const authorName = author ? userDisplayName(author as never) : t('chat.call.someone', 'Ai đó')

        const avatars = participantIds

        const duration = endAt ? formatDuration(endAt - startAt) : ''

        return (
                <div className="my-2 flex gap-2.5" role="article" aria-label={endAt ? t('chat.callPost.endedA11y', 'Cuộc gọi đã kết thúc') : t('chat.callPost.startedA11y', 'Cuộc gọi đang diễn ra')}>
                        <Avatar name={authorName} size="sm" className="mt-0.5" />
                        <div className="flex flex-col items-start max-w-[85%]">
                                <div className="flex items-baseline gap-2 mb-0.5">
                                        <span className="text-xs font-semibold">{authorName}</span>
                                </div>
                                <div
                                        className={`rounded-2xl px-3.5 py-2.5 text-sm w-full border ${
                                                endAt ? 'bg-muted/60 border-border text-muted-foreground' : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                                        } rounded-bl-sm`}
                                >
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                                {endAt ? (
                                                        <PhoneOff className="h-4 w-4 shrink-0" aria-hidden />
                                                ) : (
                                                        <PhoneCall className="h-4 w-4 shrink-0 animate-pulse" aria-hidden />
                                                )}
                                                <span className="font-medium">
                                                        {endAt
                                                                ? t('chat.callPost.ended', 'Cuộc gọi đã kết thúc')
                                                                : t('chat.callPost.startedBy', 'Đã bắt đầu một cuộc gọi')}
                                                </span>
                                                <span className="text-xs opacity-70">
                                                        {t('chat.callPost.by', 'bởi')} {authorName}
                                                </span>
                                                {!endAt && activeCall?.startAt && (
                                                        <span className="text-xs opacity-70">{relative(activeCall.startAt)}</span>
                                                )}
                                                {endAt && duration && (
                                                        <span className="text-xs opacity-80">
                                                                {t('chat.callPost.endedAt', 'Kết thúc lúc')} {formatClock(endAt)} · {t('chat.callPost.lasted', 'kéo dài')} {duration}
                                                        </span>
                                                )}
                                        </div>
                                        {(avatars.length > 0 || live) && (
                                                <div className="mt-2 flex items-center gap-1.5">
                                                        {avatars.slice(0, 3).map((uid) => {
                                                                const u = users[uid] as Record<string, any> | undefined
                                                                const name = u
                                                                        ? `${u.firstname ?? u.first_name ?? ''} ${u.lastname ?? u.last_name ?? ''}`.trim() || u.username
                                                                        : '?'
                                                                return (
                                                                        <UserAvatar key={uid} userId={uid} displayName={name || '?'} size="xs" />
                                                                )
                                                        })}
                                                        {avatars.length > 3 && (
                                                                <span className="text-[11px] opacity-70">+{avatars.length - 3}</span>
                                                        )}
                                                </div>
                                        )}
                                        {live && (
                                                <Button
                                                        size="sm"
                                                        variant={inThisCall ? 'outline' : 'default'}
                                                        disabled={atLimit && !inThisCall}
                                                        className="mt-2 h-7"
                                                        onClick={() => {
                                                                if (inThisCall) {
                                                                        callsClient.leave()
                                                                } else {
                                                                        window.dispatchEvent(
                                                                                new CustomEvent('calls:join-channel', { detail: { channelId: post.channel_id } }),
                                                                        )
                                                                }
                                                        }}
                                                >
                                                        {inThisCall ? (
                                                                <>
                                                                        <PhoneOff className="mr-1 h-3 w-3" />
                                                                        {t('chat.callPost.leave', 'Rời cuộc gọi')}
                                                                </>
                                                        ) : (
                                                                <>
                                                                        <PhoneCall className="mr-1 h-3 w-3" />
                                                                        {status === 'connecting' ? (
                                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                        ) : (
                                                                                t('chat.callPost.join', 'Tham gia cuộc gọi')
                                                                        )}
                                                                </>
                                                        )}
                                                </Button>
                                        )}
                                </div>
                        </div>
                </div>
        )
}

function formatDuration(ms: number): string {
        const totalSec = Math.max(0, Math.floor(ms / 1000))
        const h = Math.floor(totalSec / 3600)
        const m = Math.floor((totalSec % 3600) / 60)
        const s = totalSec % 60
        if (h > 0) return `${h}h ${m}m`
        if (m > 0) return `${m}m ${s}s`
        return `${s}s`
}

function relative(startAt: number): string {
        const mins = Math.max(0, Math.floor((Date.now() - startAt) / 60_000))
        if (mins < 1) return 'vừa bắt đầu'
        if (mins < 60) return `${mins} phút trước`
        return `${Math.floor(mins / 60)} giờ trước`
}

/** "14:35" clock-time formatting for ended calls. */
function formatClock(at: number): string {
        try {
                return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } catch {
                return ''
        }
}
