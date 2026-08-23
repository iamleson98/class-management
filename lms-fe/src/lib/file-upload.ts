/**
 * LMS file uploads.
 *
 * Files are uploaded through the Mattermost file API (`POST /api/v4/files`,
 * multipart: `channel_id` + `files`) — NOT `/api/v4/uploads`, which is the
 * resumable upload-SESSION API and expects a JSON body.
 *
 * The handler requires a channel the uploader belongs to. LMS uploads are not
 * tied to a chat post, so we reuse the user's self direct-message channel
 * (created on demand, idempotent, private to the uploader) as the upload
 * target. The resulting FileInfo.id is what LMS rows (homework.file_id,
 * materials.file_id, submissions.file_id, …) reference; no post is created.
 */

export interface LmsUploadResult {
  /** Mattermost FileInfo id — store on LMS rows as file_id. */
  fileId: string
  fileName: string
  /** MIME/extension-derived type label (e.g. 'pdf', 'image'). */
  fileType: string
  /** Same-origin authenticated URL for <img src>/downloads. */
  fileUrl: string
}

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

/**
 * Upload a file for LMS use and get back its FileInfo id + display URL.
 * Same-origin (cookie auth); returns `fileId` for LMS payloads and `fileUrl`
 * for previews/downloads.
 */
export async function uploadLmsFile(file: File): Promise<LmsUploadResult> {
  const channelId = await getSelfChannelId()

  const formData = new FormData()
  formData.append('channel_id', channelId)
  formData.append('files', file)

  const res = await fetch('/api/v4/files', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error || 'Tải lên thất bại')
  }

  const json = await res.json()
  const info = json.file_infos?.[0]
  if (!info?.id) throw new Error('Tải lên thất bại')

  return {
    fileId: info.id as string,
    fileName: (info.name as string) || file.name,
    fileType: fileTypeFromName(info.name || file.name),
    fileUrl: `/api/v4/files/${info.id}/${encodeURIComponent(info.name || file.name)}`,
  }
}

/**
 * Back-compat wrapper for legacy call sites that only need display metadata.
 * Prefer `uploadLmsFile` (it also returns the fileId LMS payloads require).
 */
export async function uploadFile(file: File): Promise<{ fileName: string; fileType: string; fileUrl: string }> {
  const result = await uploadLmsFile(file)
  return { fileName: result.fileName, fileType: result.fileType, fileUrl: result.fileUrl }
}
