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

import { callsClient } from './calls-client'
import { useCallsStore } from './calls-store'

// jsdom has no mediaDevices implementation — stub it with a controllable mock.
const getUserMediaMock = vi.fn()
// jsdom lacks mediaDevices entirely
Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: getUserMediaMock, getDisplayMedia: vi.fn() },
        configurable: true,
})

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
        addIceCandidate = vi.fn(async () => undefined)
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
})
