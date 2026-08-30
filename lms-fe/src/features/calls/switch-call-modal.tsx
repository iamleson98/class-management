/**
 * Switch call modal — ports the plugin webapp's switch_call_modal: joining a
 * call in another channel while connected shows a confirmation ("leave the
 * current call and join the new one?") instead of silently dropping.
 */

'use client'

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { useChatStore } from '@/lib/chat/store'
import { callsClient } from './calls-client'
import { useCallsStore } from './calls-store'

export interface SwitchCallTarget {
        channelId: string
        callId: string
}

export function SwitchCallModal({
        target,
        onCancel,
}: {
        target: SwitchCallTarget | null
        onCancel: () => void
}) {
        const { t } = useTranslation()
        const currentChannelId = useCallsStore((s) => s.channelId)
        const inCall = useCallsStore((s) => s.status !== 'disconnected' && s.status !== 'error')
        const channels = useChatStore((s) => s.channels)
        const users = useChatStore((s) => s.users)

        if (!target || !inCall || !currentChannelId || target.channelId === currentChannelId) return null

        const nameForChannel = (channelId: string): string => {
                const ch = channels[channelId] as { display_name?: string; type?: string; name?: string } | undefined
                if (!ch) return ''
                if (ch.display_name) return ch.display_name
                if (ch.type === 'D' && ch.name) {
                        // DM channel names are "userId1__userId2" — resolve the other user.
                        const otherId = ch.name.split('__').find((id) => id && users[id])
                        const u = otherId ? (users[otherId] as Record<string, any> | undefined) : undefined
                        if (u) {
                                const first = u.firstname ?? u.first_name ?? ''
                                const last = u.lastname ?? u.last_name ?? ''
                                return `${first} ${last}`.trim() || u.username || ''
                        }
                }
                return channelId
        }

        const currentName = nameForChannel(currentChannelId)
        const targetName = nameForChannel(target.channelId)

        const onSwitch = () => {
                const ch = target.channelId
                onCancel()
                callsClient.leave()
                void callsClient.join(ch)
        }

        return (
                <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
                        <DialogContent className="max-w-md">
                                <DialogHeader>
                                        <DialogTitle>{t('chat.switchCall.title', 'Tham gia cuộc gọi khác?')}</DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-muted-foreground">
                                        {t(
                                                'chat.switchCall.body',
                                                'Bạn đang trong cuộc gọi với {current}. Bạn có muốn rời cuộc gọi đó và tham gia cuộc gọi với {target} không?',
                                                { current: currentName || t('chat.unknownChannel', 'một kênh khác'), target: targetName || t('chat.unknownChannel', 'một kênh khác') },
                                        )}
                                </p>
                                <DialogFooter className="mt-2 gap-2">
                                        <Button variant="outline" onClick={onCancel}>
                                                {t('chat.switchCall.cancel', 'Hủy')}
                                        </Button>
                                        <Button onClick={onSwitch}>
                                                {t('chat.switchCall.join', 'Rời và tham gia')}
                                        </Button>
                                </DialogFooter>
                        </DialogContent>
                </Dialog>
        )
}
