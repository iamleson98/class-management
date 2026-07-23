export async function uploadFile(file: File, folder: string = 'posts'): Promise<{ fileName: string; fileType: string; fileUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const res = await fetch('/api/v4/uploads/', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error || json.message || 'Upload failed')
  }

  const json = await res.json()
  return json.data || json
}
