/**
 * RTC connection-quality monitor — ports the plugin webapp's RTCMonitor
 * (`mos` events → quality indicator + degraded banner). Polls
 * RTCPeerConnection.getStats() every 10s and derives a coarse quality level
 * from round-trip time, jitter and packet loss; a hidden/dying monitor never
 * throws.
 */

import type { CallQuality } from './calls-store'

export interface QualitySample {
	quality: CallQuality
	/** Round-trip time in ms (best candidate pair), or null. */
	rtt: number | null
	/** Jitter in ms, or null. */
	jitter: number | null
	/** Inbound packet loss fraction 0..1, or null. */
	loss: number | null
}

const MONITOR_INTERVAL_MS = 10_000

export class RTCQualityMonitor {
	private timer: number | null = null
	private lastLoss: { lost: number; received: number } | null = null

	constructor(
		private getPC: () => RTCPeerConnection | null,
		private onUpdate: (sample: QualitySample) => void,
	) {}

	start(): void {
		this.stop()
		this.timer = window.setInterval(() => this.poll(), MONITOR_INTERVAL_MS)
		// Seed as unknown immediately so the UI can render the baseline state.
		this.onUpdate({ quality: 'unknown', rtt: null, jitter: null, loss: null })
	}

	stop(): void {
		if (this.timer !== null) {
			window.clearInterval(this.timer)
			this.timer = null
		}
		this.lastLoss = null
	}

	private async poll(): Promise<void> {
		const pc = this.getPC()
		if (!pc) {
			this.onUpdate({ quality: 'unknown', rtt: null, jitter: null, loss: null })
			return
		}
		try {
			const stats = await pc.getStats()
			let rtt: number | null = null
			let jitter: number | null = null
			let loss: number | null = null
			let selected: RTCIceCandidatePairStats | null = null

			stats.forEach((report) => {
				const r = report as unknown as Record<string, unknown>
				if (r.type === 'candidate-pair' && (r.selected === true || (r.nominated === true && r.state === 'succeeded'))) {
					if (typeof r.currentRoundTripTime === 'number') {
						rtt = r.currentRoundTripTime * 1000
					}
					selected = report as unknown as RTCIceCandidatePairStats
				}
				if (r.type === 'inbound-rtp') {
					if (typeof r.jitter === 'number') {
						jitter = r.jitter * 1000
					}
					const lost = (r.packetsLost as number | undefined) ?? 0
					const received = (r.packetsReceived as number | undefined) ?? 0
					if (received > 0) {
						if (this.lastLoss) {
							const dLost = lost - this.lastLoss.lost
							const dRecv = received - this.lastLoss.received
							if (dRecv > 0) loss = Math.min(1, Math.max(0, dLost / (dLost + dRecv)))
						}
						this.lastLoss = { lost, received }
					}
				}
			})

			// Fallback: derive RTT from the selected pair's requests if needed.
			if (rtt === null && selected) {
				const r = selected as unknown as Record<string, unknown>
				if (typeof r.currentRoundTripTime === 'number') rtt = r.currentRoundTripTime * 1000
			}

			this.onUpdate({ quality: classify(rtt, jitter, loss), rtt, jitter, loss })
		} catch {
			this.onUpdate({ quality: 'unknown', rtt: null, jitter: null, loss: null })
		}
	}
}

/** Map raw stats to a coarse quality level (good/fair/poor). */
export function classify(rtt: number | null, jitter: number | null, loss: number | null): CallQuality {
	let score = 5
	if (rtt !== null) score -= Math.max(0, (rtt - 150) / 150) * 1.2
	if (jitter !== null) score -= Math.max(0, (jitter - 20) / 40) * 1.0
	if (loss !== null) score -= Math.max(0, loss - 0.02) * 30
	if (score >= 4) return 'good'
	if (score >= 3) return 'fair'
	return 'poor'
}

/** Whether the degraded-quality banner should be re-armable (20s lock). */
export const QUALITY_ALERT_REARM_MS = 20_000
