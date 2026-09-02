/**
 * Vitest global setup — jsdom environment polyfills the components rely on.
 */

import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// matchMedia (used by Tailwind-responsive components + radix).
Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(), // legacy
                removeListener: vi.fn(), // legacy
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
        }),
})

// ResizeObserver (ScrollArea, radix popovers).
class ResizeObserverMock {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

// Element.scrollIntoView.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn()

// IntersectionObserver (virtualized lists).
class IntersectionObserverMock {
        root = null
        rootMargin = ''
        thresholds: number[] = []
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
        takeRecords = vi.fn()
}
globalThis.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver

// AudioContext (calls sounds module guards, but stub anyway).
class AudioContextMock {
        state = 'running'
        resume = vi.fn().mockResolvedValue(undefined)
        createOscillator = vi.fn(() => ({
                type: 'sine',
                frequency: { value: 0, setValueAtTime: vi.fn() },
                connect: vi.fn(() => ({ connect: vi.fn() })),
                start: vi.fn(),
                stop: vi.fn(),
        }))
        createGain = vi.fn(() => ({
                gain: {
                        setValueAtTime: vi.fn(),
                        linearRampToValueAtTime: vi.fn(),
                        exponentialRampToValueAtTime: vi.fn(),
                },
                connect: vi.fn(() => ({ connect: vi.fn() })),
        }))
        destination = {}
        close = vi.fn().mockResolvedValue(undefined)
}
Object.defineProperty(window, 'AudioContext', { writable: true, value: AudioContextMock })

// navigator.mediaDevices (calls client guards on it; provide an inert stub).
Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: {
                enumerateDevices: vi.fn().mockResolvedValue([]),
                getUserMedia: vi.fn().mockRejectedValue(new Error('no media in tests')),
                getDisplayMedia: vi.fn().mockRejectedValue(new Error('no display in tests')),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
        },
})

// requestAnimationFrame / cancelAnimationFrame.
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        window.setTimeout(() => cb(Date.now()), 16)) as typeof requestAnimationFrame
globalThis.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof cancelAnimationFrame

// RTC stubs (calls client signal path; jsdom has no WebRTC).
class RTCSessionDescriptionMock {
        type: string
        sdp: string
        constructor(init: { type: string; sdp?: string }) {
                this.type = init.type
                this.sdp = init.sdp ?? ''
        }
        toJSON() {
                return { type: this.type, sdp: this.sdp }
        }
}
// @ts-expect-error jsdom lacks WebRTC
globalThis.RTCSessionDescription = RTCSessionDescriptionMock
// @ts-expect-error jsdom lacks WebRTC
window.RTCSessionDescription = RTCSessionDescriptionMock

class RTCIceCandidateMock {
        candidate: string
        sdpMid: string | null
        sdpMLineIndex: number | null
        constructor(init: { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null }) {
                this.candidate = init.candidate ?? ''
                this.sdpMid = init.sdpMid ?? null
                this.sdpMLineIndex = init.sdpMLineIndex ?? null
        }
        toJSON() {
                return { candidate: this.candidate, sdpMid: this.sdpMid, sdpMLineIndex: this.sdpMLineIndex }
        }
}
// @ts-expect-error jsdom lacks WebRTC
globalThis.RTCIceCandidate = RTCIceCandidateMock
// @ts-expect-error jsdom lacks WebRTC
window.RTCIceCandidate = RTCIceCandidateMock
