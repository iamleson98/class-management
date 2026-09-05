/**
 * Calls client protocol tests — outbound action payloads and inbound
 * signaling handling, verified against the native server contract.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const sendMock = vi.fn()
vi.mock('@/lib/chat/client', () => ({
        wsClient: {
                sendMessage: (action: string, data?: Record<string, unknown>) => sendMock(action, data),
                addMessageListener: vi.fn(),
                addReconnectListener: vi.fn(),
                initialize: vi.fn(),
        },
}))

// Toast spy for the missing-devices UX (calls-client imports the module-level
// toast() so the no-hardware join surfaces as a user-visible notification).
const toastMock = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ toast: (arg: unknown) => toastMock(arg) }))

import { callsClient } from './calls-client'
import { useCallsStore } from './calls-store'

// jsdom has no mediaDevices implementation — stub it with a controllable mock.
const getUserMediaMock = vi.fn()
// jsdom lacks mediaDevices entirely
Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: getUserMediaMock, getDisplayMedia: vi.fn() },
        configurable: true,
})

// jsdom also lacks the MediaStream constructor; the client re-bundles the
// independently acquired audio/video tracks into one local stream.
class FakeMediaStream {
        id = 'local-stream'
        constructor(public tracks: MediaStreamTrack[] = []) {}
        getTracks = () => this.tracks
        getAudioTracks = () => this.tracks.filter((t) => t.kind === 'audio')
        getVideoTracks = () => this.tracks.filter((t) => t.kind === 'video')
        addTrack = vi.fn()
        removeTrack = vi.fn()
        addEventListener = vi.fn()
}
// @ts-expect-error inject stub
globalThis.MediaStream = FakeMediaStream

// The client instantiates RTCPeerConnection in handleJoinAck; jsdom lacks a
// real implementation, so stub a controllable one.
class FakePC {
        onnegotiationneeded: (() => void) | null = null
        onicecandidate: ((ev: { candidate: unknown }) => void) | null = null
        onconnectionstatechange: (() => void) | null = null
        ontrack: ((ev: { track: MediaStreamTrack; streams: MediaStream[] }) => void) | null = null

        signalingState = 'stable'
        remoteDescription: { type?: string } | null = null
        localDescription: { type: string; sdp: string } | null = null

        addTrack = vi.fn()
        addTransceiver = vi.fn(() => ({ sender: { replaceTrack: vi.fn(async () => undefined) } }))
        setLocalDescription = vi.fn(async () => {
                this.localDescription = { type: 'offer', sdp: 'v=0 fake' }
        })
        setRemoteDescription = vi.fn(async (d: { type: string }) => {
                this.remoteDescription = { type: d.type }
        })
        addIceCandidate = vi.fn(async (_init: unknown) => undefined)
        restartIce = vi.fn()
        close = vi.fn()
        getSenders = vi.fn(() => [])
}

// Every FakePC the client creates, newest last.
const pcInstances: FakePC[] = []
// @ts-expect-error inject stub
globalThis.RTCPeerConnection = class extends FakePC {
        constructor() {
                super()
                pcInstances.push(this)
        }
}
/** The most recently created peer connection. */
const lastPC = () => pcInstances[pcInstances.length - 1]

// A fake track: kind/id/enabled + stop() (teardown stops every track).
const fakeTrack = (kind: string, id: string, enabled = true) =>
        ({ kind, id, enabled, stop: vi.fn(), addEventListener: vi.fn() }) as unknown as MediaStreamTrack

const mediaStream = (tracks: MediaStreamTrack[]) =>
        ({
                id: 'stream-1',
                getTracks: () => tracks,
                getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
                getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
                addTrack: vi.fn(),
                addEventListener: vi.fn(),
        }) as unknown as MediaStream

describe('callsClient', () => {
        beforeEach(async () => {
                vi.clearAllMocks()
                sendMock.mockClear()
                getUserMediaMock.mockReset()
                useCallsStore.getState().reset()
                // Reset the singleton between tests (join() is a no-op when in a call).
                await callsClient.leave()
                sendMock.mockClear()
        })

        it('join sends the join action with the channel id', async () => {
                const media = mediaStream([fakeTrack('audio', 'a1')])
                getUserMediaMock.mockResolvedValue(media as MediaStream)

                await callsClient.join('ch1')

                expect(sendMock).toHaveBeenCalledWith('custom_calls_join', { channelID: 'ch1' })
                expect(useCallsStore.getState().status).toBe('connecting')
        })

        it('join with no devices still joins (voice-only) and toasts', async () => {
                getUserMediaMock.mockRejectedValue(Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' }))

                await callsClient.join('ch1', { enableVideo: true })

                // Non-fatal: the join action still goes out.
                expect(sendMock).toHaveBeenCalledWith('custom_calls_join', { channelID: 'ch1' })
                expect(useCallsStore.getState().status).toBe('connecting')
                // The missing-device alert banner is up.
                expect(useCallsStore.getState().alerts.some((a) => a.kind === 'audio-input-missing')).toBe(true)
                expect(useCallsStore.getState().alerts.some((a) => a.kind === 'video-input-missing')).toBe(true)
        })

        it('join with a missing camera keeps a working mic', async () => {
                const track = fakeTrack('audio', 'a1')
                getUserMediaMock.mockImplementation(async (c: { video?: unknown }) => {
                        if (c.video) {
                                throw Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' })
                        }
                        return mediaStream([track])
                })

                await callsClient.join('ch1', { enableVideo: true })

                expect(sendMock).toHaveBeenCalledWith('custom_calls_join', { channelID: 'ch1' })
                expect(useCallsStore.getState().micEnabled).toBe(true)
                expect(useCallsStore.getState().cameraEnabled).toBe(false)
                expect(useCallsStore.getState().alerts.some((a) => a.kind === 'video-input-missing')).toBe(true)
        })

        it('handleJoinAck stores the session, creates the PC, and offers via sdp', async () => {
                const media = mediaStream([fakeTrack('audio', 'a1')])
                getUserMediaMock.mockResolvedValue(media as MediaStream)

                await callsClient.join('ch1')
                callsClient.handleJoinAck('sess-1', [{ urls: 'stun:h:3478' }])

                const s = useCallsStore.getState()
                expect(s.mySessionId).toBe('sess-1')
                expect(s.status).toBe('joined')
                // Local audio track was added to the PC.
                expect(lastPC().addTrack).toHaveBeenCalled()
        })

        it('signal feeds SDP/ICE to the peer connection', async () => {
                const media = mediaStream([fakeTrack('audio', 'a1')])
                getUserMediaMock.mockResolvedValue(media as MediaStream)
                await callsClient.join('ch1')
                callsClient.handleJoinAck('sess-1', [])

                await callsClient.signal(JSON.stringify({ type: 'answer', sdp: 'v=0 ans' }))
                expect(lastPC().setRemoteDescription).toHaveBeenCalled()

                await callsClient.signal(JSON.stringify({ candidate: 'c', sdpMid: '0', sdpMLineIndex: 0 }))
                // remoteDescription set by the answer → candidate goes straight in.
                expect(lastPC().addIceCandidate).toHaveBeenCalled()
        })

        it('signal accepts rtcd candidate ENVELOPE: {type:"candidate", candidate:{…}}', async () => {
                // The real SFU (rtcd/service/rtc/msg.go newICEMessage) wraps the
                // ICECandidateInit under a "candidate" key. Constructing from the
                // outer level instead throws "sdpMid and sdpMLineIndex are both
                // null" and drops every SFU candidate — the call then died when
                // the peer timed out (~30s). This pins the production wire shape.
                const media = mediaStream([fakeTrack('audio', 'a1')])
                getUserMediaMock.mockResolvedValue(media as MediaStream)
                await callsClient.join('ch1')
                callsClient.handleJoinAck('sess-1', [])

                // Remote description first so candidates apply immediately.
                await callsClient.signal(JSON.stringify({ type: 'answer', sdp: 'v=0 ans' }))
                lastPC().addIceCandidate.mockClear()

                await callsClient.signal(JSON.stringify({
                        type: 'candidate',
                        candidate: { candidate: 'candidate:1 1 udp 2130706431 192.168.1.4 54400 typ host generation 0', sdpMid: '0', sdpMLineIndex: 0 },
                }))

                expect(lastPC().addIceCandidate).toHaveBeenCalledTimes(1)
                const init = lastPC().addIceCandidate.mock.calls[0]?.[0] as RTCIceCandidate
                expect(init.candidate).toContain('typ host')
                expect(init.sdpMid).toBe('0')
                expect(init.sdpMLineIndex).toBe(0)
        })

        it('signal queues rtcd envelope candidates that arrive before the answer', async () => {
                // Trickle ICE ordering is not guaranteed: candidates may land
                // before the SDP answer. They must be buffered (and still
                // normalized), then flushed once the answer sets the remote.
                const media = mediaStream([fakeTrack('audio', 'a1')])
                getUserMediaMock.mockResolvedValue(media as MediaStream)
                await callsClient.join('ch1')
                callsClient.handleJoinAck('sess-1', [])
                lastPC().addIceCandidate.mockClear()

                await callsClient.signal(JSON.stringify({
                        type: 'candidate',
                        candidate: { candidate: 'candidate:2 1 udp 2130706431 10.0.0.7 54401 typ host generation 0', sdpMid: '0', sdpMLineIndex: 0 },
                }))
                // No remote description yet → buffered, not applied.
                expect(lastPC().addIceCandidate).not.toHaveBeenCalled()

                await callsClient.signal(JSON.stringify({ type: 'answer', sdp: 'v=0 ans' }))
                expect(lastPC().addIceCandidate).toHaveBeenCalledTimes(1)
                const init = lastPC().addIceCandidate.mock.calls[0]?.[0] as RTCIceCandidate
                expect(init.candidate).toContain('10.0.0.7')
        })

        it('signal defaults a null-mid candidate to the first m-line instead of throwing', async () => {
                // Defensive path: a relayed candidate carrying NEITHER sdpMid
                // NOR sdpMLineIndex must not crash the handler (the browser
                // constructor rejects both-null).
                const media = mediaStream([fakeTrack('audio', 'a1')])
                getUserMediaMock.mockResolvedValue(media as MediaStream)
                await callsClient.join('ch1')
                callsClient.handleJoinAck('sess-1', [])

                await callsClient.signal(JSON.stringify({ type: 'answer', sdp: 'v=0 ans' }))
                lastPC().addIceCandidate.mockClear()

                await callsClient.signal(JSON.stringify({
                        type: 'candidate',
                        candidate: { candidate: 'candidate:3 1 udp 2130706431 172.17.0.2 54402 typ host generation 0' },
                }))

                expect(lastPC().addIceCandidate).toHaveBeenCalledTimes(1)
                const init = lastPC().addIceCandidate.mock.calls[0]?.[0] as RTCIceCandidate
                expect(init.sdpMLineIndex).toBe(0)
        })

        it('mute toggles the track and sends the verb', async () => {
                const track = fakeTrack('audio', 'a1')
                const media = mediaStream([track])
                getUserMediaMock.mockResolvedValue(media as MediaStream)
                await callsClient.join('ch1')

                callsClient.mute()
                expect(track.enabled).toBe(false)
                expect(sendMock).toHaveBeenCalledWith('custom_calls_mute', {})
                expect(useCallsStore.getState().micEnabled).toBe(false)

                callsClient.unmute()
                expect(track.enabled).toBe(true)
                expect(sendMock).toHaveBeenCalledWith('custom_calls_unmute', {})
        })

        it('hand verbs toggle the local flag and send the action', () => {
                callsClient.raiseHand()
                expect(sendMock).toHaveBeenCalledWith('custom_calls_raise_hand', {})
                expect(useCallsStore.getState().handRaised).toBe(true)

                callsClient.lowerHand()
                expect(sendMock).toHaveBeenCalledWith('custom_calls_unraise_hand', {})
                expect(useCallsStore.getState().handRaised).toBe(false)
        })

        it('ws reconnect sends the reconnect registration with the stable session id', async () => {
                const media = mediaStream([fakeTrack('audio', 'a1')])
                getUserMediaMock.mockResolvedValue(media as MediaStream)
                await callsClient.join('ch1')
                callsClient.handleJoinAck('stable-1', [])

                callsClient.handleWSReconnect()
                expect(sendMock).toHaveBeenCalledWith('custom_calls_reconnect', {
                        channelID: 'ch1',
                        originalConnID: 'stable-1',
                        prevConnID: 'stable-1',
                })
        })

        it('leave sends the leave action and resets the store', async () => {
                const media = mediaStream([fakeTrack('audio', 'a1')])
                getUserMediaMock.mockResolvedValue(media as MediaStream)
                await callsClient.join('ch1')
                callsClient.handleJoinAck('sess-1', [])

                callsClient.leave()
                expect(sendMock).toHaveBeenCalledWith('custom_calls_leave', { channelID: 'ch1' })
                expect(useCallsStore.getState().channelId).toBeNull()
                expect(useCallsStore.getState().status).toBe('disconnected')
        })

        it('missing capture hardware joins voice-only with a banner AND a toast', async () => {
                getUserMediaMock.mockRejectedValue(
                        Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' }),
                )

                await callsClient.join('ch1')

                // Still joins (the join action is sent — voice-only).
                expect(sendMock).toHaveBeenCalledWith('custom_calls_join', { channelID: 'ch1' })
                // In-call alert banner for the missing mic.
                expect(useCallsStore.getState().alerts.some((a) => a.kind === 'audio-input-missing')).toBe(true)
                // User-facing toast naming the missing devices (falls back to
                // "both missing" when enumerateDevices is unavailable, as in jsdom).
                await vi.waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
                const arg = toastMock.mock.calls[0][0] as { title: string; variant?: string }
                expect(arg.title).toContain('Không tìm thấy')
                expect(arg.variant).toBe('destructive')
        })

        it('permission-denied media failures toast NOT (banner only)', async () => {
                getUserMediaMock.mockRejectedValue(
                        Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }),
                )

                await callsClient.join('ch2')
                await new Promise((r) => setTimeout(r, 0))

                expect(useCallsStore.getState().alerts.some((a) => a.kind === 'audio-input-permissions')).toBe(true)
                expect(toastMock).not.toHaveBeenCalled()
        })

        it('unsatisfiable preferred constraints fall back to relaxed ones (camera still works)', async () => {
                // Regression for "joins voice-only although my laptop has both
                // devices": an external camera that cannot satisfy facingMode /
                // a stale stored deviceId rejects the FIRST attempt, but the
                // ladder retries without those constraints and succeeds.
                const audioTrack = fakeTrack('audio', 'a1')
                const videoTrack = fakeTrack('video', 'v1')
                const attempts: Array<MediaStreamConstraints> = []
                getUserMediaMock.mockImplementation(async (c: MediaStreamConstraints) => {
                        attempts.push(c)
                        const video = c.video as MediaTrackConstraints | undefined
                        const preferred = !!video && ('facingMode' in video || 'deviceId' in video)
                        if (video && preferred) {
                                throw Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' })
                        }
                        return mediaStream(c.audio ? [audioTrack] : [videoTrack])
                })

                await callsClient.join('ch1', { enableVideo: true })
                await new Promise((r) => setTimeout(r, 0))

                // Video acquisition retried with relaxed constraints.
                expect(attempts.filter((c) => c.video).length).toBeGreaterThanOrEqual(2)
                // The camera actually works: enabled, no missing-video banner,
                // no missing-device toast.
                expect(useCallsStore.getState().cameraEnabled).toBe(true)
                expect(useCallsStore.getState().micEnabled).toBe(true)
                expect(useCallsStore.getState().alerts.some((a) => a.kind === 'video-input-missing')).toBe(false)
                expect(toastMock).not.toHaveBeenCalled()
        })

        it('join without a server ack times out into the rtc-timeout error (re-joinable)', async () => {
                // Regression for "stuck on connecting forever": a silently
                // dropped join (WS blip, permission gate, server restart)
                // previously left the call screen spinning with no error.
                vi.useFakeTimers()
                try {
                        const media = mediaStream([fakeTrack('audio', 'a1')])
                        getUserMediaMock.mockResolvedValue(media as MediaStream)

                        await callsClient.join('ch1')
                        expect(useCallsStore.getState().status).toBe('connecting')

                        vi.advanceTimersByTime(15_000)

                        const s = useCallsStore.getState()
                        expect(s.status).toBe('error')
                        expect(s.error?.kind).toBe('rtc-timeout')
                        // The channel survives on the error for the re-join button.
                        expect(s.error?.channelId).toBe('ch1')
                        expect(sendMock).toHaveBeenCalledWith('custom_calls_leave', { channelID: 'ch1' })
                } finally {
                        vi.useRealTimers()
                }
        })

        it('handleJoinAck cancels the join watchdog', async () => {
                vi.useFakeTimers()
                try {
                        const media = mediaStream([fakeTrack('audio', 'a1')])
                        getUserMediaMock.mockResolvedValue(media as MediaStream)

                        await callsClient.join('ch1')
                        callsClient.handleJoinAck('sess-1', [])

                        vi.advanceTimersByTime(15_000)

                        // No ack-timeout error: the watchdog was cleared by the ack.
                        const s = useCallsStore.getState()
                        expect(s.error).toBeNull()
                        expect(s.status).toBe('joined')
                } finally {
                        vi.useRealTimers()
                }
        })
})
