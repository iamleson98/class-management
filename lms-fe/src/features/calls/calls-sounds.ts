/**
 * In-call notification sounds, generated with the WebAudio API so no binary
 * assets are needed. Ports the plugin webapp's sounds (join_self, join_user,
 * leave_self) plus the incoming-call ring.
 *
 * Every entry point is safe to call before user gesture: the AudioContext is
 * created lazily and resumed on demand; when autoplay is blocked the sounds
 * simply don't play (they are transient feedback, never critical).
 */

type SoundName = 'join_self' | 'join_user' | 'leave_self' | 'ring' | 'ended'

let ctx: AudioContext | null = null

function audioCtx(): AudioContext | null {
	if (typeof window === 'undefined') return null
	try {
		if (!ctx) {
			const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
			if (!AC) return null
			ctx = new AC()
		}
		if (ctx.state === 'suspended') void ctx.resume().catch(() => void 0)
		return ctx
	} catch {
		return null
	}
}

/** One short tone with a soft attack/release envelope. */
function tone(
	start: number,
	duration: number,
	freq: number,
	gain = 0.08,
	type: OscillatorType = 'sine',
): void {
	const ac = audioCtx()
	if (!ac) return
	const osc = ac.createOscillator()
	const env = ac.createGain()
	osc.type = type
	osc.frequency.value = freq
	const t0 = ac.currentTime + start
	env.gain.setValueAtTime(0, t0)
	env.gain.linearRampToValueAtTime(gain, t0 + 0.012)
	env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
	osc.connect(env).connect(ac.destination)
	osc.start(t0)
	osc.stop(t0 + duration + 0.05)
}

/** A pleasant two-note "ding" (C5→G5). */
function ding(up = true): void {
	tone(0, 0.16, up ? 523.25 : 392.0)
	tone(0.09, 0.22, up ? 783.99 : 523.25)
}

/** Play a named call sound. */
export function playCallSound(name: SoundName): void {
	try {
		switch (name) {
			case 'join_self':
				// You joined the call.
				ding(true)
				break
			case 'join_user':
				// Someone else joined (played under the participant threshold).
				tone(0, 0.12, 659.25, 0.05)
				tone(0.08, 0.14, 880.0, 0.045)
				break
			case 'leave_self':
				// You left / the call ended.
				ding(false)
				break
			case 'ended':
				tone(0, 0.2, 440.0, 0.06)
				tone(0.18, 0.3, 349.23, 0.06)
				break
			case 'ring':
				// Incoming call ring-back (one burst; callers loop it).
				tone(0, 0.35, 587.33, 0.09, 'triangle')
				tone(0.45, 0.35, 587.33, 0.09, 'triangle')
				break
		}
	} catch {
		// Sounds must never break the call.
	}
}

/** Ring loop handle for incoming calls; stops after RING_LENGTH or on stop(). */
export interface RingHandle {
	stop: () => void
}

/** Start the incoming-call ring loop (auto-stops after `lengthMs`). */
export function startRinging(lengthMs = 30_000): RingHandle {
	const startedAt = Date.now()
	let stopped = false
	const loop = () => {
		if (stopped) return
		playCallSound('ring')
		if (Date.now() - startedAt < lengthMs) {
			timer = window.setTimeout(loop, 1400)
		}
	}
	let timer = window.setTimeout(loop, 0)
	return {
		stop: () => {
			stopped = true
			window.clearTimeout(timer)
		},
	}
}

/**
 * The participant count above which join sounds are silenced
 * (joinSoundParticipantsThreshold in the plugin; default 8).
 */
export const JOIN_SOUND_PARTICIPANTS_THRESHOLD = 8
