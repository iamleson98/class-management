/**
 * call-controls — the bottom control bar.
 *
 * Ports the plugin webapp's expanded-view controls: mute (with push-to-talk
 * hint), camera, screen share, raise hand + reactions, participants toggle,
 * chat toggle, speaker/grid view toggle, device settings (mic/camera/speaker
 * pickers + share-audio-with-screen), the host menu (make host, mute one,
 * mute all, lower hand, remove, end call) calling the native host-control REST
 * API, and leave.
 */

'use client'

import { useState } from 'react'
import {
        Hand, Mic, MicOff, Monitor, MonitorOff, PhoneOff, Video, VideoOff,
        Crown, UserMinus, VolumeX, MonitorX, LogOut, MoreVertical, Users,
        MessageSquare, LayoutGrid, GalleryVerticalEnd, Settings2, Check, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n'
import { useLMSStore } from '@/store/lms-store'
import { useChatStore } from '@/lib/chat/store'
import { callsClient, shareAudioWithScreen, setShareAudioWithScreen } from './calls-client'
import { useCallsStore, type CallSession, type CallDevice } from './calls-store'
import { ReactionButton } from './reaction-stream'
import { userDisplayName } from '@/lib/chat/types'

/** POST a host-control action against the native calls REST API. */
async function hostAction(callId: string, action: string, body?: Record<string, unknown>): Promise<void> {
        const res = await fetch(`/api/v4/calls/${callId}/host/${action}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify(body ?? {}),
        })
        if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.message || err.error || 'host action failed')
        }
}

function ControlButton({
        active, onClick, on, off, label, destructive, disabled,
}: {
        active: boolean
        onClick: () => void
        on: React.ReactNode
        off: React.ReactNode
        label: string
        destructive?: boolean
        disabled?: boolean
}) {
        return (
                <Tooltip>
                        <TooltipTrigger asChild>
                                <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-pressed={active}
                                        aria-label={label}
                                        onClick={onClick}
                                        disabled={disabled}
                                        className={`h-11 w-11 rounded-full transition-colors ${
                                                active
                                                        ? 'bg-white/15 text-white hover:bg-white/25'
                                                        : destructive
                                                                ? 'bg-red-500/90 text-white hover:bg-red-500'
                                                                : 'bg-white/5 text-white/70 hover:bg-white/15'
                                        }`}
                                >
                                        {active ? on : off}
                                </Button>
                        </TooltipTrigger>
                        <TooltipContent>{label}</TooltipContent>
                </Tooltip>
        )
}

/** Small icon button used inside a participant row of the host menu. */
function RowButton({
        onClick, label, children,
}: {
        onClick: () => void
        label: string
        children: React.ReactNode
}) {
        return (
                <button
                        type="button"
                        title={label}
                        aria-label={label}
                        onClick={(e) => { e.stopPropagation(); onClick() }}
                        className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                        {children}
                </button>
        )
}

/** One row in the device pickers. */
function DeviceRow({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
        return (
                <button
                        type="button"
                        onClick={onClick}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/60 transition-colors text-left"
                >
                        <span className="truncate">{label}</span>
                        {selected && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                </button>
        )
}

export function CallControls() {
        const { t } = useTranslation()
        const authUserId = useLMSStore((s) => s.authUser?.id)
        const users = useChatStore((s) => s.users)

        const callId = useCallsStore((s) => s.callId)
        const micEnabled = useCallsStore((s) => s.micEnabled)
        const cameraEnabled = useCallsStore((s) => s.cameraEnabled)
        const screenSharing = useCallsStore((s) => s.screenSharing)
        const handRaised = useCallsStore((s) => s.handRaised)
        const hostUserId = useCallsStore((s) => s.hostUserId)
        const sessions = useCallsStore((s) => s.sessions)
        const sessionOrder = useCallsStore((s) => s.sessionOrder)
        const setError = useCallsStore((s) => s.setError)
        const config = useCallsStore((s) => s.config)
        const devices = useCallsStore((s) => s.devices)
        const selectedDevices = useCallsStore((s) => s.selectedDevices)
        const viewMode = useCallsStore((s) => s.viewMode)
        const setViewMode = useCallsStore((s) => s.setViewMode)
        const screenStream = useCallsStore((s) => s.screenStream)
        const participantsOpen = useCallsStore((s) => s.participantsOpen)
        const toggleParticipants = useCallsStore((s) => s.toggleParticipants)
        const chatOpen = useCallsStore((s) => s.chatOpen)
        const toggleChat = useCallsStore((s) => s.toggleChat)

        const [menuOpen, setMenuOpen] = useState(false)
        const [settingsOpen, setSettingsOpen] = useState(false)
        const [confirmRemove, setConfirmRemove] = useState<(CallSession & { displayName: string }) | null>(null)
        const [leaveMenuOpen, setLeaveMenuOpen] = useState(false)
        const mirrorVideo = useCallsStore((s) => s.mirrorVideo)
        const setMirrorVideo = useCallsStore((s) => s.setMirrorVideo)
        const callChannelId = useCallsStore((s) => s.channelId)
        const chatUnread = useChatStore((s) => (callChannelId ? s.unreadByChannel[callChannelId] ?? 0 : 0))
        const chatMentions = useChatStore((s) => (callChannelId ? s.mentionByChannel[callChannelId] ?? 0 : 0))
        // Lazy initializer: reads the persisted preference once (client component).
        const [shareAudio, setShareAudio] = useState(() => shareAudioWithScreen())

        const isHost = !!authUserId && hostUserId === authUserId
        const someoneElseSharing = Object.values(sessions).some((s) => s.screenOn && s.userId !== authUserId)
        const anyVideoStreams = Object.values(sessions).some((s) => s.video) || cameraEnabled

        /** Run a host action, surfacing failures as a call-level error. */
        const runHost = (action: string, body?: Record<string, unknown>) => {
                if (!callId) return
                hostAction(callId, action, body).catch((err: Error) => setError({ message: err.message, kind: 'generic' }))
        }

        /** Other participants (host menu targets), with resolved display names. */
        const others: Array<CallSession & { displayName: string }> = Object.values(sessions)
                .filter((s) => s.userId !== authUserId)
                .map((s) => ({
                        ...s,
                        displayName: userDisplayName(users[s.userId] as never) || s.sessionId.slice(0, 8),
                }))

        const onToggleMute = () => (micEnabled ? callsClient.mute() : callsClient.unmute())
        const onToggleVideo = () => {
                if (cameraEnabled) {
                        callsClient.stopVideo()
                } else {
                        callsClient.startVideo().catch((e) => console.error('[calls] startVideo failed', e))
                }
        }
        const onToggleScreen = () => {
                if (screenSharing) {
                        callsClient.stopScreenShare()
                } else {
                        callsClient.startScreenShare().catch((e) => console.error('[calls] screen share failed', e))
                }
        }
        const onToggleHand = () => (handRaised ? callsClient.lowerHand() : callsClient.raiseHand())

        const pickDevice = (kind: 'audioInput' | 'audioOutput' | 'videoInput', device: CallDevice) => {
                if (kind === 'audioInput') void callsClient.setAudioInputDevice(device)
                else if (kind === 'videoInput') void callsClient.setVideoInputDevice(device)
                else void callsClient.setAudioOutputDevice(device)
        }

        const named = (list: CallDevice[]) => {
                if (list.length === 0) return [{ deviceId: '', label: t('chat.devices.none', 'Không có thiết bị') }]
                return list
        }

        return (
                <div className="flex items-center justify-center gap-1.5 px-4 py-3 border-t border-white/10 shrink-0 flex-wrap">
                        <ControlButton
                                active={micEnabled}
                                onClick={onToggleMute}
                                on={<Mic className="h-5 w-5" />}
                                off={<MicOff className="h-5 w-5" />}
                                label={micEnabled ? `${t('chat.mute', 'Tắt tiếng')} (${t('chat.pushToTalkHint', 'hoặc giữ Space')})` : t('chat.unmute', 'Bật tiếng')}
                        />

                        {config.enableVideo && (
                                <ControlButton
                                        active={cameraEnabled}
                                        onClick={onToggleVideo}
                                        on={<Video className="h-5 w-5" />}
                                        off={<VideoOff className="h-5 w-5" />}
                                        label={cameraEnabled ? t('chat.stopVideo', 'Tắt camera') : t('chat.startVideo', 'Bật camera')}
                                />
                        )}

                        {config.allowScreenSharing && (
                                <ControlButton
                                        active={screenSharing}
                                        disabled={!screenSharing && someoneElseSharing}
                                        onClick={onToggleScreen}
                                        on={<Monitor className="h-5 w-5" />}
                                        off={<MonitorOff className="h-5 w-5" />}
                                        label={
                                                screenSharing
                                                        ? t('chat.stopShare', 'Dừng chia sẻ')
                                                        : someoneElseSharing
                                                                ? t('chat.shareTaken', 'Người khác đang chia sẻ')
                                                                : t('chat.shareScreen', 'Chia sẻ màn hình')
                                        }
                                />
                        )}

                        <ControlButton
                                active={handRaised}
                                onClick={onToggleHand}
                                on={<Hand className="h-5 w-5 text-amber-400" />}
                                off={<Hand className="h-5 w-5" />}
                                label={handRaised ? t('chat.lowerHand', 'Hạ tay') : t('chat.raiseHand', 'Giơ tay')}
                        />

                        <ReactionButton />

                        {/* Participants toggle */}
                        <Tooltip>
                                <TooltipTrigger asChild>
                                        <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-pressed={participantsOpen}
                                                aria-label={t('chat.participants', 'Thành viên')}
                                                onClick={toggleParticipants}
                                                className={`h-11 w-11 rounded-full relative ${
                                                        participantsOpen ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-white/5 text-white/70 hover:bg-white/15'
                                                }`}
                                        >
                                                <Users className="h-5 w-5" />
                                                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-white/20 text-[10px] leading-4 text-white font-semibold">
                                                        {sessionOrder.length}
                                                </span>
                                        </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('chat.participants', 'Thành viên')} (Alt+P)</TooltipContent>
                        </Tooltip>

                        {/* Chat toggle */}
                        <Tooltip>
                                <TooltipTrigger asChild>
                                        <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-pressed={chatOpen}
                                                aria-label={t('chat.showChat', 'Xem trò chuyện')}
                                                onClick={toggleChat}
                                                className={`h-11 w-11 rounded-full ${
                                                        chatOpen ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-white/5 text-white/70 hover:bg-white/15'
                                                }`}
                                        >
                                                <MessageSquare className="h-5 w-5" />
                                                {chatOpen || (chatUnread === 0 && chatMentions === 0) ? null : (
                                                        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-sky-500 text-white text-[9px] font-semibold leading-4">
                                                                {chatMentions > 0 ? (chatMentions > 99 ? '99+' : chatMentions) : chatUnread > 99 ? '99+' : chatUnread}
                                                        </span>
                                                )}
                                        </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('chat.showChat', 'Xem trò chuyện')}</TooltipContent>
                        </Tooltip>

                        {/* Speaker / grid view toggle */}
                        {anyVideoStreams && !screenStream && sessionOrder.length > 1 && (
                                <Tooltip>
                                        <TooltipTrigger asChild>
                                                <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={viewMode === 'speaker' ? t('chat.viewGrid', 'Xem lưới') : t('chat.viewSpeaker', 'Xem người nói')}
                                                        onClick={() => setViewMode(viewMode === 'speaker' ? 'grid' : 'speaker')}
                                                        className="h-11 w-11 rounded-full bg-white/5 text-white/70 hover:bg-white/15"
                                                >
                                                        {viewMode === 'speaker' ? <LayoutGrid className="h-5 w-5" /> : <GalleryVerticalEnd className="h-5 w-5" />}
                                                </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{viewMode === 'speaker' ? t('chat.viewGrid', 'Xem lưới') : t('chat.viewSpeaker', 'Xem người nói')}</TooltipContent>
                                </Tooltip>
                        )}

                        {/* Device settings */}
                        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                                <Tooltip>
                                        <PopoverTrigger asChild>
                                                <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={t('chat.deviceSettings', 'Thiết bị âm thanh/video')}
                                                        className="h-11 w-11 rounded-full bg-white/5 text-white/70 hover:bg-white/15"
                                                >
                                                        <Settings2 className="h-5 w-5" />
                                                </Button>
                                        </PopoverTrigger>
                                        <TooltipContent>{t('chat.deviceSettings', 'Thiết bị âm thanh/video')}</TooltipContent>
                                </Tooltip>
                                <PopoverContent align="center" className="w-72 p-0 max-h-[60vh] overflow-y-auto">
                                        <div className="p-1">
                                                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                        {t('chat.devices.microphone', 'Micro')}
                                                </p>
                                                {named(devices.audioInputs).map((d) => (
                                                        <DeviceRow
                                                                key={d.deviceId || 'none'}
                                                                label={d.label}
                                                                selected={d.deviceId !== '' && d.deviceId === selectedDevices.audioInput}
                                                                onClick={() => d.deviceId && pickDevice('audioInput', d)}
                                                        />
                                                ))}
                                                {devices.audioOutputs.length > 0 && (
                                                        <>
                                                                <p className="px-2 pt-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                        {t('chat.devices.speaker', 'Loa')}
                                                                </p>
                                                                {devices.audioOutputs.map((d) => (
                                                                        <DeviceRow
                                                                                key={d.deviceId}
                                                                                label={d.label}
                                                                                selected={d.deviceId === selectedDevices.audioOutput}
                                                                                onClick={() => pickDevice('audioOutput', d)}
                                                                        />
                                                                ))}
                                                        </>
                                                )}
                                                {config.enableVideo && devices.videoInputs.length > 0 && (
                                                        <>
                                                                <p className="px-2 pt-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                        {t('chat.devices.camera', 'Camera')}
                                                                </p>
                                                                {devices.videoInputs.map((d) => (
                                                                        <DeviceRow
                                                                                key={d.deviceId}
                                                                                label={d.label}
                                                                                selected={d.deviceId === selectedDevices.videoInput}
                                                                                onClick={() => pickDevice('videoInput', d)}
                                                                        />
                                                                ))}
                                                        </>
                                                )}
                                                <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer hover:bg-muted/60">
                                                                        <span>{t('chat.mirrorVideo', 'Lật ảnh camera của bạn')}</span>
                                                                        <input
                                                                                type="checkbox"
                                                                                checked={mirrorVideo}
                                                                                onChange={(e) => setMirrorVideo(e.target.checked)}
                                                                                className="h-4 w-4 accent-emerald-600"
                                                                        />
                                                                </label>
                                                                {config.allowScreenSharing && (
                                                        <>
                                                                <div className="my-1 h-px bg-border" />
                                                                <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer hover:bg-muted/60">
                                                                        <span>{t('chat.shareAudio', 'Chia sẻ âm thanh hệ thống')}</span>
                                                                        <input
                                                                                type="checkbox"
                                                                                checked={shareAudio}
                                                                                onChange={(e) => {
                                                                                        setShareAudio(e.target.checked)
                                                                                        setShareAudioWithScreen(e.target.checked)
                                                                                }}
                                                                                className="h-4 w-4 accent-emerald-600"
                                                                        />
                                                                </label>
                                                        </>
                                                )}
                                        </div>
                                </PopoverContent>
                        </Popover>

                        {/* Host / more menu */}
                        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                                <Tooltip>
                                        <PopoverTrigger asChild>
                                                <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={t('chat.callMenu', 'Tùy chọn cuộc gọi')}
                                                        className="h-11 w-11 rounded-full bg-white/5 text-white/70 hover:bg-white/15"
                                                >
                                                        <MoreVertical className="h-5 w-5" />
                                                </Button>
                                        </PopoverTrigger>
                                        <TooltipContent>{t('chat.callMenu', 'Tùy chọn cuộc gọi')}</TooltipContent>
                                </Tooltip>
                                <PopoverContent align="center" className="w-72 p-0 max-h-[60vh] overflow-y-auto">
                                        {isHost && config.hostControlsAllowed ? (
                                                <div className="p-1">
                                                        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                {t('chat.hostControls', 'Kiểm soát của chủ trì')}
                                                        </p>
                                                        <button
                                                                type="button"
                                                                disabled={others.length === 0}
                                                                onClick={() => runHost('mute-others')}
                                                                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted/60 transition-colors disabled:opacity-50"
                                                        >
                                                                <VolumeX className="h-4 w-4" />
                                                                {t('chat.muteOthers', 'Tắt tiếng tất cả')}
                                                        </button>
                                                        {screenSharing && (
                                                                <button
                                                                        type="button"
                                                                        onClick={() => callsClient.stopScreenShare()}
                                                                        className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted/60 transition-colors"
                                                                >
                                                                        <MonitorX className="h-4 w-4" />
                                                                        {t('chat.stopShare', 'Dừng chia sẻ')}
                                                                </button>
                                                        )}
                                                        <button
                                                                type="button"
                                                                onClick={() => runHost('end')}
                                                                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                        >
                                                                <LogOut className="h-4 w-4" />
                                                                {t('chat.endForAll', 'Kết thúc cho tất cả')}
                                                        </button>

                                                        {others.length > 0 && (
                                                                <>
                                                                        <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                                {t('chat.participants', 'Thành viên')}
                                                                        </p>
                                                                        {others.map((o) => (
                                                                                <div
                                                                                        key={o.sessionId}
                                                                                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40"
                                                                                >
                                                                                        <span className="text-sm truncate flex-1">{o.displayName}</span>
                                                                                        <div className="flex gap-0.5 shrink-0">
                                                                                                <RowButton label={t('chat.mute', 'Tắt tiếng')} onClick={() => runHost('mute', { sessionID: o.sessionId })}>
                                                                                                        <MicOff className="h-3.5 w-3.5" />
                                                                                                </RowButton>
                                                                                                {o.raisedHand > 0 && (
                                                                                                        <RowButton label={t('chat.lowerHand', 'Hạ tay')} onClick={() => runHost('lower-hand', { sessionID: o.sessionId })}>
                                                                                                                <Hand className="h-3.5 w-3.5" />
                                                                                                        </RowButton>
                                                                                                )}
                                                                                                																																	{o.screenOn && (
																																		<RowButton label={t('chat.stopShare', 'Dừng chia sẻ')} onClick={() => runHost('screen-off', { sessionID: o.sessionId })}>
																																			<MonitorX className="h-3.5 w-3.5" />
																																		</RowButton>
																																	)}
																																	<RowButton label={t('chat.remove', 'Mời ra')} onClick={() => setConfirmRemove(o)}>
																																		<UserMinus className="h-3.5 w-3.5" />
																																	</RowButton>
                                                                                                <RowButton label={t('chat.makeHost', 'Chuyển chủ trì')} onClick={() => runHost('make', { newHostID: o.userId })}>
                                                                                                        <Crown className="h-3.5 w-3.5" />
                                                                                                </RowButton>
                                                                                        </div>
                                                                                </div>
                                                                        ))}
                                                                </>
                                                        )}
                                                </div>
                                        ) : (
                                                <div className="p-1">
                                                        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                {t('chat.callOptions', 'Tùy chọn')}
                                                        </p>
                                                        <button
                                                                type="button"
                                                                onClick={() => callsClient.requestCallState()}
                                                                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted/60 transition-colors"
                                                        >
                                                                {t('chat.refreshState', 'Làm mới trạng thái')}
                                                        </button>
                                                </div>
                                        )}
                                </PopoverContent>
                        </Popover>

                        <Popover open={leaveMenuOpen} onOpenChange={setLeaveMenuOpen}>
                                <Tooltip>
                                        <TooltipTrigger asChild>
                                                <PopoverTrigger asChild>
                                                        <Button
                                                                variant="destructive"
                                                                size="icon"
                                                                className="h-11 w-11 rounded-full ml-2"
                                                                aria-label={t('chat.leaveCall', 'Rời cuộc gọi')}
                                                        >
                                                                <PhoneOff className="h-5 w-5" />
                                                        </Button>
                                                </PopoverTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('chat.leaveCall', 'Rời cuộc gọi')} (Ctrl+Shift+L)</TooltipContent>
                                </Tooltip>
                                <PopoverContent align="end" className="w-56 p-1">
                                        <button
                                                type="button"
                                                onClick={() => { setLeaveMenuOpen(false); callsClient.leave() }}
                                                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted/60 transition-colors"
                                        >
                                                <LogOut className="h-4 w-4" />
                                                {t('chat.leaveCall', 'Rời cuộc gọi')}
                                        </button>
                                        {isHost && config.hostControlsAllowed && (
                                                <button
                                                        type="button"
                                                        onClick={() => { setLeaveMenuOpen(false); runHost('end') }}
                                                        className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
                                                >
                                                        <PhoneOff className="h-4 w-4" />
                                                        {t('chat.endForAll', 'Kết thúc cho tất cả')}
                                                </button>
                                        )}
                                </PopoverContent>
                        </Popover>

                        <ConfirmRemoveDialog
                                target={confirmRemove}
                                onCancel={() => setConfirmRemove(null)}
                                onConfirm={() => confirmRemove && runHost('remove', { sessionID: confirmRemove.sessionId })}
                        />
                </div>
        )
}

/** Confirmation for removing a participant (plugin parity: remove_confirmation). */
export function ConfirmRemoveDialog({
        target,
        onCancel,
        onConfirm,
}: {
        target: (CallSession & { displayName: string }) | null
        onCancel: () => void
        onConfirm: () => void
}) {
        const { t } = useTranslation()
        if (!target) return null
        return (
                <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
                        <DialogContent className="max-w-sm">
                                <DialogHeader>
                                        <DialogTitle>
                                                {t('chat.removeConfirm.title', 'Mời {name} ra khỏi cuộc gọi?', { name: target.displayName })}
                                        </DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-muted-foreground">
                                        {t('chat.removeConfirm.body', 'Họ có thể tham gia lại nếu được mời.')}
                                </p>
                                <DialogFooter className="mt-2 gap-2">
                                        <Button variant="outline" onClick={onCancel}>
                                                {t('common.cancel', 'Hủy')}
                                        </Button>
                                        <Button
                                                variant="destructive"
                                                onClick={() => { onConfirm(); onCancel() }}
                                        >
                                                {t('chat.removeConfirm.yes', 'Mời ra')}
                                        </Button>
                                </DialogFooter>
                        </DialogContent>
                </Dialog>
        )
}
