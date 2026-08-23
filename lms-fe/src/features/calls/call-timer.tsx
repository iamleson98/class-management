/**
 * call-timer — live elapsed-time readout for the call header.
 *
 * Mounts a single 1s interval while visible; renders mm:ss / h:mm:ss.
 */

'use client'

import { useEffect, useState } from 'react'

function format(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000))
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	const mm = String(m).padStart(2, '0')
	const ss = String(s).padStart(2, '0')
	return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function CallTimer({ startAt }: { startAt: number | null }) {
	const [now, setNow] = useState(() => Date.now())

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [])

	if (!startAt) return null
	return <span className="font-mono text-xs text-white/60 tabular-nums">{format(now - startAt)}</span>
}
