/**
 * Tests for the Mattermost-style LMS file upload helpers.
 *
 * The >5MB upload-session path is exercised end-to-end with a mocked fetch:
 * session creation, 5MB chunking, 204-continue semantics, final FileInfo
 * response, and the canonical /api/v4/lms/media/{id} display URL.
 * (The ≤5MB simple path uses XHR, which is browser-only.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { uploadLmsFile, lmsMediaSrc } from './file-upload'

type FetchMock = ReturnType<typeof vi.fn>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status })
}

/** Route table keyed by "METHOD url"; last matching call wins via queue. */
function installFetchMock(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): FetchMock {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    return handler(url, init)
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

const ME_ID = 'user1111111111111111111111111'
const CHANNEL_ID = 'chan111111111111111111111111'
const SESSION_ID = 'upld111111111111111111111111'
const FILE_ID = 'file1111111111111111111111111'

describe('lmsMediaSrc', () => {
  it('prefers the canonical LMS media route when a fileId exists (fixes legacy rows)', () => {
    expect(lmsMediaSrc({ fileId: FILE_ID, fileUrl: `/api/v4/files/${FILE_ID}/old.jpg` }))
      .toBe(`/api/v4/lms/media/${FILE_ID}`)
  })

  it('falls back to the stored URL when there is no fileId', () => {
    expect(lmsMediaSrc({ fileUrl: 'https://cdn.example.com/pic.jpg' })).toBe('https://cdn.example.com/pic.jpg')
    expect(lmsMediaSrc({})).toBe('')
  })
})

describe('uploadLmsFile (upload-session path, >5MB)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a session, sends 5MB chunks, and returns the LMS media URL', async () => {
    const size = 12 * 1024 * 1024 // 12MB → 5 + 5 + 2 MB chunks
    const file = new File([new Uint8Array(size)], 'video.mp4', { type: 'video/mp4' })

    const calls: Array<{ url: string; init?: RequestInit }> = []
    const mock = installFetchMock((url, init) => {
      calls.push({ url, init })
      if (url === '/api/v4/users/me') return jsonResponse({ id: ME_ID })
      if (url === '/api/v4/channels/direct') return jsonResponse({ id: CHANNEL_ID })
      if (url === '/api/v4/uploads') return jsonResponse({ id: SESSION_ID, file_offset: 0, file_size: size }, 201)
      if (url === `/api/v4/uploads/${SESSION_ID}`) {
        // Two 204 "continue" responses then the final FileInfo.
        const dataCalls = calls.filter((c) => c.url === `/api/v4/uploads/${SESSION_ID}` && c.init?.method === 'POST')
        if (dataCalls.length < 3) return emptyResponse(204)
        return jsonResponse({ id: FILE_ID, name: 'video.mp4', size })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const progress: number[] = []
    const result = await uploadLmsFile(file, (p) => progress.push(p.percent))

    expect(result.fileId).toBe(FILE_ID)
    expect(result.fileUrl).toBe(`/api/v4/lms/media/${FILE_ID}`)
    expect(result.selfUrl).toBe(`/api/v4/files/${FILE_ID}`)
    expect(result.fileType).toBe('video')

    // Session created with the right body.
    const create = calls.find((c) => c.url === '/api/v4/uploads')
    expect(JSON.parse(String(create?.init?.body))).toEqual({
      channel_id: CHANNEL_ID,
      filename: 'video.mp4',
      file_size: size,
    })

    // Exactly three data chunks, 5MB + 5MB + 2MB.
    const chunks = calls.filter((c) => c.url === `/api/v4/uploads/${SESSION_ID}` && c.init?.method === 'POST')
    expect(chunks).toHaveLength(3)
    expect((chunks[0]?.init?.body as Blob).size).toBe(5 * 1024 * 1024)
    expect((chunks[1]?.init?.body as Blob).size).toBe(5 * 1024 * 1024)
    expect((chunks[2]?.init?.body as Blob).size).toBe(2 * 1024 * 1024)
    expect(chunks[0]?.init?.headers).toHaveProperty('X-Requested-With', 'XMLHttpRequest')

    // Progress is server-confirmed and monotonic, ending at 100.
    expect(progress.at(-1)).toBe(100)
    expect(progress).toEqual([...progress].sort((a, b) => a - b))

    expect(mock).toHaveBeenCalled()
  })

  it('resumes from the server-confirmed offset after a chunk fails', async () => {
    const size = 11 * 1024 * 1024 // 5 + 5 + 1
    const file = new File([new Uint8Array(size)], 'big.jpg', { type: 'image/jpeg' })

    let failedOnce = false
    let serverOffset = 0
    const calls: Array<{ url: string; init?: RequestInit }> = []
    installFetchMock((url, init) => {
      calls.push({ url, init })
      if (url === '/api/v4/users/me') return jsonResponse({ id: ME_ID })
      if (url === '/api/v4/channels/direct') return jsonResponse({ id: CHANNEL_ID })
      if (url === '/api/v4/uploads') return jsonResponse({ id: SESSION_ID, file_offset: 0, file_size: size }, 201)
      const method = init?.method ?? 'GET' // fetch defaults to GET when unset
      if (url === `/api/v4/uploads/${SESSION_ID}` && method === 'GET') {
        // The server persisted whatever it consumed of the failed attempt; here
        // the first chunk never landed, so the authoritative offset stays 0.
        return jsonResponse({ id: SESSION_ID, file_offset: serverOffset, file_size: size })
      }
      if (url === `/api/v4/uploads/${SESSION_ID}` && method === 'POST') {
        const body = init?.body as Blob
        if (!failedOnce) {
          failedOnce = true
          // First chunk attempt dies with a network error (not an HTTP error).
          return Promise.reject(new TypeError('network dropped'))
        }
        serverOffset += body.size
        if (serverOffset >= size) return jsonResponse({ id: FILE_ID, name: 'big.jpg', size })
        return emptyResponse(204)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await uploadLmsFile(file)
    expect(result.fileId).toBe(FILE_ID)
    // The retry consulted the session for the authoritative offset (implicit GET).
    expect(calls.some((c) => c.url === `/api/v4/uploads/${SESSION_ID}` && (c.init?.method ?? 'GET') === 'GET')).toBe(true)
  })

  it('surfaces a server error from session creation (e.g. file too large)', async () => {
    const size = 6 * 1024 * 1024
    const file = new File([new Uint8Array(size)], 'huge.png', { type: 'image/png' })
    installFetchMock((url) => {
      if (url === '/api/v4/users/me') return jsonResponse({ id: ME_ID })
      if (url === '/api/v4/channels/direct') return jsonResponse({ id: CHANNEL_ID })
      if (url === '/api/v4/uploads') {
        return jsonResponse({ id: 'createUpload', message: 'File is too large', status_code: 413 }, 413)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    await expect(uploadLmsFile(file)).rejects.toThrow(/too large|413/i)
  })
})
