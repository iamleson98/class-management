/**
 * LMS file uploads — ports Mattermost's two upload paths, picking the right
 * one per file size (the same split Mattermost's own clients use):
 *
 * 1. SIMPLE upload (`POST /api/v4/files`, multipart: `channel_id` + `files`)
 *    for files up to 5MB. One atomic request; progress comes from the
 *    browser's XHR `upload.onprogress` events (bytes handed to the network).
 *    No resume — a failure restarts from zero, which is cheap at this size.
 *    This is what the Mattermost webapp uses for chat attachments.
 *
 * 2. UPLOAD SESSIONS (`POST /api/v4/uploads` → chunked `POST /api/v4/uploads/{id}`)
 *    for files larger than 5MB, the way Mattermost mobile uploads big files:
 *      - create a session: {channel_id, filename, file_size} → UploadSession
 *        (the server pre-checks MaxFileSize and the channel upload permission)
 *      - send 5MB raw-binary chunks; each 204 No Content means "stored, send
 *        more" (the server persists file_offset in the DB), and the final
 *        200 returns the completed FileInfo JSON.
 *      - progress is the SERVER-CONFIRMED offset, not just bytes sent.
 *      - if a chunk fails (network drop), `GET /api/v4/uploads/{id}` returns
 *        the session with the authoritative file_offset so we can RESUME
 *        from where the server actually stopped.
 *    (The server requires the first chunk to be ≥ 5MB — app/upload.go
 *    minFirstPartSize — which the 5MB chunk size satisfies exactly.)
 *
 * Both paths upload into the user's self direct-message channel (created on
 * demand, private to the uploader): LMS uploads are not tied to a chat post,
 * so there is no better Mattermost-native container. The resulting
 * FileInfo.id is what LMS rows (class_media.file_id, materials.file_id,
 * submissions.file_id, …) reference; no post is ever created.
 *
 * Display URLs:
 *   - fileUrl: /api/v4/lms/media/{fileId} — the canonical LMS media route
 *     (serves the bytes to any role holding PermissionLmsManageClassMedia,
 *     scoped to files referenced by a class_media row).
 *   - selfUrl: /api/v4/files/{fileId} — Mattermost's own route; readable
 *     only by the uploader (creator) or channel members.
 */

export interface LmsUploadResult {
  /** Mattermost FileInfo id — store on LMS rows as file_id. */
  fileId: string
  fileName: string
  /** MIME/extension-derived type label (e.g. 'pdf', 'image'). */
  fileType: string
  /**
   * Canonical LMS display URL (serves any class-media-permission holder).
   * Valid once an LMS row (e.g. class_media) references the fileId.
   */
  fileUrl: string
  /** Direct Mattermost file URL — readable by the uploader themselves. */
  selfUrl: string
}

export interface LmsUploadProgress {
  /** 0..100 — server-confirmed bytes for session uploads, sent bytes for XHR. */
  percent: number
  /** Bytes confirmed stored server-side (session path only; else bytes sent). */
  uploadedBytes: number
  totalBytes: number
}

export type LmsUploadOnProgress = (progress: LmsUploadProgress) => void

/** ≤ 5MB → simple multipart upload (matches Mattermost webapp behavior). */
const SIMPLE_UPLOAD_MAX = 5 * 1024 * 1024
/** Chunk size for upload sessions (Mattermost's own chunk size; the server
 *  requires the first chunk to be ≥ minFirstPartSize = 5MB). */
const CHUNK_SIZE = 5 * 1024 * 1024
/** Attempts per chunk before giving up (with linear backoff). */
const MAX_CHUNK_ATTEMPTS = 3

let selfChannelId: string | null = null

/** Get (creating on first use) the current user's self-DM channel id. */
async function getSelfChannelId(): Promise<string> {
  if (selfChannelId) return selfChannelId
  const meRes = await fetch('/api/v4/users/me', {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!meRes.ok) throw new Error('Chưa đăng nhập')
  const me = await meRes.json()
  const res = await fetch('/api/v4/channels/direct', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify([me.id, me.id]),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error || 'Không thể tạo kênh tải lên')
  }
  const channel = await res.json()
  selfChannelId = channel.id as string
  return selfChannelId
}

function fileTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video'
  return ext || 'file'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Parse a Mattermost API error body into a readable message. */
async function readApiError(res: Response): Promise<Error> {
  const err = await res.json().catch(() => ({}))
  const detail = err.message || err.error || err.detailed_error || ''
  return new Error(detail || `Tải lên thất bại (${res.status})`)
}

/** Read a Mattermost error from a non-OK XHR response text. */
function xhrError(xhr: XMLHttpRequest): Error {
  let detail = ''
  try {
    const body = JSON.parse(xhr.responseText || '{}')
    detail = body.message || body.error || body.detailed_error || ''
  } catch { /* ignore parse errors */ }
  return new Error(detail || `Tải lên thất bại (${xhr.status})`)
}

interface MmFileInfo {
  id: string
  name: string
  size?: number
}

function toResult(info: MmFileInfo, fallbackName: string): LmsUploadResult {
  return {
    fileId: info.id,
    fileName: info.name || fallbackName,
    fileType: fileTypeFromName(info.name || fallbackName),
    fileUrl: `/api/v4/lms/media/${info.id}`,
    selfUrl: `/api/v4/files/${info.id}`,
  }
}

/** ── Path 1: simple multipart upload (≤ 5MB), progress via XHR events. ── */
function uploadMultipart(channelId: string, file: File, onProgress?: LmsUploadOnProgress): Promise<LmsUploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('channel_id', channelId)
    formData.append('files', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/v4/files')
    xhr.withCredentials = true
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
    // Let the browser set Content-Type (multipart boundary).

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return
        onProgress({
          percent: Math.min(100, Math.round((e.loaded / e.total) * 100)),
          uploadedBytes: e.loaded,
          totalBytes: e.total,
        })
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText)
          const info = json.file_infos?.[0]
          if (!info?.id) {
            reject(new Error('Tải lên thất bại'))
            return
          }
          resolve(toResult(info, file.name))
        } catch {
          reject(new Error('Tải lên thất bại'))
        }
      } else {
        reject(xhrError(xhr))
      }
    }
    xhr.onerror = () => reject(new Error('Lỗi kết nối khi tải lên'))
    xhr.onabort = () => reject(new Error('Đã huỷ tải lên'))
    xhr.send(formData)
  })
}

/** ── Path 2: upload session (resumable, > 5MB), progress = server-confirmed offset. ── */

interface MmUploadSession {
  id: string
  file_offset: number
  file_size: number
}

/** Create the upload session (server pre-checks MaxFileSize + permissions). */
async function createUploadSession(channelId: string, file: File): Promise<MmUploadSession> {
  const res = await fetch('/api/v4/uploads', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({
      channel_id: channelId,
      filename: file.name,
      file_size: file.size,
    }),
  })
  if (!res.ok) throw await readApiError(res)
  return res.json()
}

/** Ask the server where the upload actually stopped (authoritative offset). */
async function getUploadSession(uploadId: string): Promise<MmUploadSession> {
  const res = await fetch(`/api/v4/uploads/${uploadId}`, {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!res.ok) throw await readApiError(res)
  return res.json()
}

/**
 * Send one chunk (raw binary body). Returns the completed FileInfo when the
 * server reports the upload finished, or null while more chunks are expected.
 * A chunk that is network-interrupted can be retried after re-reading the
 * session's file_offset — the server rejects only INCONSISTENT offsets.
 */
async function uploadChunk(uploadId: string, chunk: Blob): Promise<MmFileInfo | null> {
  const res = await fetch(`/api/v4/uploads/${uploadId}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Requested-With': 'XMLHttpRequest' },
    body: chunk,
  })
  if (!res.ok) throw await readApiError(res)
  if (res.status === 204) return null // upload incomplete — keep going
  const text = await res.text()
  if (!text) return null
  const info = JSON.parse(text)
  return info?.id ? (info as MmFileInfo) : null
}

async function uploadViaSession(channelId: string, file: File, onProgress?: LmsUploadOnProgress): Promise<LmsUploadResult> {
  const session = await createUploadSession(channelId, file)

  let offset = session.file_offset
  onProgress?.({
    percent: file.size > 0 ? Math.round((offset / file.size) * 100) : 0,
    uploadedBytes: offset,
    totalBytes: file.size,
  })

  let info: MmFileInfo | null = null
  let attempt = 0
  while (offset < file.size && !info) {
    const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size))
    try {
      info = await uploadChunk(session.id, chunk)
      offset += chunk.size
      attempt = 0 // a successful chunk resets the backoff
      onProgress?.({
        percent: file.size > 0 ? Math.min(100, Math.round((offset / file.size) * 100)) : 100,
        uploadedBytes: offset,
        totalBytes: file.size,
      })
    } catch (err) {
      attempt += 1
      if (attempt >= MAX_CHUNK_ATTEMPTS) throw err
      await sleep(attempt * 1000)
      // Resume from the server's authoritative offset after a failure —
      // this is the whole point of upload sessions (Mattermost mobile
      // does exactly this on network drops). The server rejects only
      // INCONSISTENT offsets, so re-slicing from its offset is safe.
      try {
        const fresh = await getUploadSession(session.id)
        if (fresh.file_offset > offset) attempt = 0 // partial progress resets the backoff
        offset = fresh.file_offset
      } catch { /* keep the local offset */ }
    }
  }

  if (!info) throw new Error('Tải lên thất bại')
  return toResult(info, file.name)
}

/**
 * Upload a file for LMS use and get back its FileInfo id + display URLs.
 * Same-origin (cookie auth). Files ≤ 5MB use the simple multipart upload;
 * larger files use Mattermost's resumable upload-session API with
 * server-confirmed progress and automatic resume after network failures.
 */
export async function uploadLmsFile(file: File, onProgress?: LmsUploadOnProgress): Promise<LmsUploadResult> {
  if (file.size === 0) throw new Error('File rỗng, không thể tải lên')
  const channelId = await getSelfChannelId()

  if (file.size <= SIMPLE_UPLOAD_MAX) {
    return uploadMultipart(channelId, file, onProgress)
  }
  return uploadViaSession(channelId, file, onProgress)
}

/**
 * Back-compat wrapper for legacy call sites that only need display metadata.
 * Prefer `uploadLmsFile` (it also returns the fileId LMS payloads require).
 */
export async function uploadFile(file: File): Promise<{ fileName: string; fileType: string; fileUrl: string }> {
  const result = await uploadLmsFile(file)
  return { fileName: result.fileName, fileType: result.fileType, fileUrl: result.fileUrl }
}

/**
 * Resolve the display URL for an LMS media row: rows with a fileId always use
 * the canonical LMS media route (fixes legacy rows whose file_url stored the
 * old, nonexistent `/api/v4/files/{id}/{name}` path); rows without one fall
 * back to their stored (external) URL.
 */
export function lmsMediaSrc(item: { fileId?: string; fileUrl?: string }): string {
  if (item.fileId) return `/api/v4/lms/media/${item.fileId}`
  return item.fileUrl ?? ''
}
