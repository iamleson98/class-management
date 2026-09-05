/**
 * Call error modal — ports the plugin webapp's call_error_modal: when the
 * calls client lands in an error state (connection failed/timeout, removed by
 * host, insecure context, no devices, limit reached), a modal explains what
 * happened and offers a re-join action where meaningful.
 */

'use client'

import { useEffect } from 'react'
import { AlertTriangle, LaptopMinimalCheck, PhoneOff, RefreshCw, ShieldAlert, Users, Video, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n'
import { callsClient } from './calls-client'
import { useCallsStore, type CallErrorKind } from './calls-store'

function artFor(kind: CallErrorKind) {
	switch (kind) {
		case 'host-removed':
			return <PhoneOff className="h-10 w-10 text-red-400" aria-hidden />
		case 'insecure-context':
			return <ShieldAlert className="h-10 w-10 text-amber-400" aria-hidden />
		case 'device-audio':
			return <VolumeX className="h-10 w-10 text-amber-400" aria-hidden />
		case 'device-video':
			return <Video className="h-10 w-10 text-amber-400" aria-hidden />
		case 'max-participants':
			return <Users className="h-10 w-10 text-sky-400" aria-hidden />
		case 'rtc-timeout':
		case 'rtc-failed':
			return <LaptopMinimalCheck className="h-10 w-10 text-sky-400" aria-hidden />
		default:
			return <AlertTriangle className="h-10 w-10 text-amber-400" aria-hidden />
	}
}

/**
 * The server's raw error string is worth showing when it adds information
 * beyond the canned copy — server-side failures ("no rtcd host available",
 * persist errors) are invisible in the browser console, so the modal was the
 * only place users could report them from and it used to swallow the reason.
 */
const sentinelsShown = new Set([
	'host-removed',
	'missing audio input permissions',
	'no audio input available',
	'missing video input permissions',
	'no video input available',
	'timed out waiting for rtc connection',
	'rtc peer close',
	'insecure context',
	'call error',
])

function shouldShowDetail(message: string): boolean {
	if (!message) return false
	return !sentinelsShown.has(message)
}

export function CallErrorModal() {
	const { t } = useTranslation()
	const error = useCallsStore((s) => s.error)
	const channelId = useCallsStore((s) => s.channelId)
	const clearError = useCallsStore((s) => s.clearError)

	// Auto-clear the error state when the modal closes so a subsequent join
	// starts from a clean slate.
	useEffect(() => {
		if (!error) return
	}, [error])

	if (!error) return null

	const kind = error.kind
	const title = titles(t)[kind]
	const body = bodies(t)[kind]
	const rejoinChannel = error.channelId ?? channelId
	const rejoinable = (kind === 'rtc-timeout' || kind === 'rtc-failed' || kind === 'generic' || kind === 'disabled') && !!rejoinChannel
	const showDetail = shouldShowDetail(error.message)

	const onRejoin = () => {
		const ch = rejoinChannel
		clearError()
		if (ch) void callsClient.join(ch)
	}

	return (
		<Dialog open onOpenChange={(open) => { if (!open) clearError() }}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
						{artFor(kind)}
					</div>
					<DialogTitle className="text-center">{title}</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-muted-foreground text-center whitespace-pre-line">{body}</p>
				{showDetail && (
					<p className="mx-auto max-w-full truncate rounded-md bg-muted/60 px-3 py-1.5 font-mono text-[11px] text-muted-foreground/80" title={error.message}>
						{error.message}
					</p>
				)}
				<DialogFooter className="mt-2 sm:justify-center gap-2">
					{rejoinable && (
						<Button onClick={onRejoin}>
							<RefreshCw className="mr-1.5 h-4 w-4" />
							{t('chat.callError.rejoin', 'Tham gia lại')}
						</Button>
					)}
					<Button variant={rejoinable ? 'outline' : 'default'} onClick={() => clearError()}>
						{t('chat.callError.close', 'Đóng')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function titles(t: (k: string, f?: string) => string): Record<CallErrorKind, string> {
	return {
		generic: t('chat.callError.genericTitle', 'Đã xảy ra sự cố với cuộc gọi'),
		'rtc-timeout': t('chat.callError.timeoutTitle', 'Không thể kết nối cuộc gọi'),
		'rtc-failed': t('chat.callError.failedTitle', 'Kết nối cuộc gọi bị ngắt'),
		'host-removed': t('chat.callError.removedTitle', 'Bạn đã bị mời ra khỏi cuộc gọi'),
		'insecure-context': t('chat.callError.insecureTitle', 'Cần kết nối bảo mật'),
		'device-audio': t('chat.callError.audioTitle', 'Không truy cập được micro'),
		'device-video': t('chat.callError.videoTitle', 'Không truy cập được camera'),
		'max-participants': t('chat.callError.limitTitle', 'Cuộc gọi đã đủ số người'),
		disabled: t('chat.callError.disabledTitle', 'Cuộc gọi không khả dụng'),
	}
}

function bodies(t: (k: string, f?: string) => string): Record<CallErrorKind, string> {
	return {
		generic: t('chat.callError.genericBody', 'Hãy thử tham gia lại. Nếu vấn đề tiếp diễn, hãy tải lại trang.'),
		'rtc-timeout': t('chat.callError.timeoutBody', 'Quá thời gian chờ kết nối. Vui lòng thử tham gia lại.'),
		'rtc-failed': t('chat.callError.failedBody', 'Đường truyền tới máy chủ cuộc gọi bị gián đoạn. Bạn có thể tham gia lại ngay bây giờ.'),
		'host-removed': t('chat.callError.removedBody', 'Chủ trì đã mời bạn ra khỏi cuộc gọi này.'),
		'insecure-context': t('chat.callError.insecureBody', 'Cuộc gọi yêu cầu HTTPS. Hãy truy cập bằng địa chỉ https:// hoặc localhost.'),
		'device-audio': t('chat.callError.audioBody', 'Không tìm thấy micro hoặc quyền truy cập bị từ chối. Bạn vẫn có thể tham gia để nghe; kiểm tra quyền của trình duyệt để nói.'),
		'device-video': t('chat.callError.videoBody', 'Không tìm thấy camera hoặc quyền truy cập bị từ chối. Kiểm tra quyền của trình duyệt rồi bật camera trong cuộc gọi.'),
		'max-participants': t('chat.callError.limitBody', 'Cuộc gọi đã đạt số người tham gia tối đa. Hãy thử lại sau hoặc liên hệ quản trị viên.'),
		disabled: t('chat.callError.disabledBody', 'Tính năng cuộc gọi chưa được bật trên máy chủ hoặc dịch vụ hội nghị chưa sẵn sàng. Máy chủ sẽ tự khôi phục — hãy thử lại sau ít phút.'),
	}
}
