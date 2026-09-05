/**
 * CallErrorBoundary — keeps the call ALIVE when the call UI throws.
 *
 * The user-facing contract: clicking the call button must ALWAYS leave a
 * running call screen, no matter what. A render error inside the widget tree
 * (a broken tile, a malformed session, a future regression) must never
 * unmount the app and tear the call down with it — the WebRTC/media session
 * lives on the module-level CallsClient, so as long as this boundary catches,
 * audio keeps flowing and the user gets an explicit retry / leave choice.
 *
 * The boundary is keyed by channel id at the mount site (CallWidget) so a new
 * call starts with a clean slate; the fallback intentionally subscribes only
 * to primitive store values so it cannot itself loop.
 */

'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, PhoneOff, RotateCcw } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { callsClient } from './calls-client'
import { useCallsStore } from './calls-store'

interface CallErrorBoundaryProps {
        children: ReactNode
}

interface CallErrorBoundaryState {
        error: Error | null
}

export class CallErrorBoundary extends Component<CallErrorBoundaryProps, CallErrorBoundaryState> {
        state: CallErrorBoundaryState = { error: null }

        static getDerivedStateFromError(error: Error): CallErrorBoundaryState {
                return { error }
        }

        componentDidCatch(error: Error): void {
                // Loud on purpose: silent UI death was the original bug class.
                console.error('[calls] call view render failed — call kept running', error)
        }

        private retry = (): void => {
                this.setState({ error: null })
        }

        render(): ReactNode {
                if (this.state.error) {
                        return <CallViewCrashed onRetry={this.retry} />
                }
                return this.props.children
        }
}

/** Minimal, crash-proof fallback: primitive selectors only. */
function CallViewCrashed({ onRetry }: { onRetry: () => void }) {
        const { t } = useTranslation()
        const inCall = useCallsStore((s) => s.channelId != null && s.status !== 'disconnected' && s.status !== 'error')

        return (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/95 p-6 text-center backdrop-blur-sm">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                                <AlertTriangle className="h-7 w-7" />
                        </div>
                        <div className="max-w-md">
                                <h2 className="text-lg font-semibold text-white">
                                        {t('chat.call.uiCrashed', 'Lỗi hiển thị cuộc gọi')}
                                </h2>
                                <p className="mt-1 text-sm text-white/60">
                                        {inCall
                                                ? t('chat.call.uiCrashedInCall', 'Bạn vẫn đang trong cuộc gọi — âm thanh tiếp tục bình thường. Thử mở lại giao diện hoặc rời cuộc gọi.')
                                                : t('chat.call.uiCrashedHint', 'Giao diện cuộc gọi gặp lỗi. Thử mở lại hoặc rời cuộc gọi.')}
                                </p>
                        </div>
                        <div className="flex items-center gap-2">
                                <button
                                        type="button"
                                        onClick={onRetry}
                                        className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
                                >
                                        <RotateCcw className="h-4 w-4" />
                                        {t('chat.call.retryUi', 'Mở lại giao diện')}
                                </button>
                                <button
                                        type="button"
                                        onClick={() => callsClient.leave()}
                                        className="flex items-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
                                >
                                        <PhoneOff className="h-4 w-4" />
                                        {t('chat.call.leaveNow', 'Rời cuộc gọi')}
                                </button>
                        </div>
                </div>
        )
}
