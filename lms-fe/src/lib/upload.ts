import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function saveUploadedFile(file: File, folder: string = 'posts'): Promise<{ fileName: string; fileType: string; fileUrl: string }> {
  // Validate type
  const allAllowed = [...(ALLOWED_TYPES.image || []), ...(ALLOWED_TYPES.document || [])]
  if (!allAllowed.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed`)
  }

  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds 5MB limit`)
  }

  // Ensure directory exists
  const dir = path.join(UPLOAD_DIR, folder)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Generate unique filename
  const ext = file.name.split('.').pop() || 'bin'
  const fileName = `${crypto.randomUUID()}.${ext}`
  const filePath = path.join(dir, fileName)

  // Save file
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  fs.writeFileSync(filePath, buffer)

  return {
    fileName,
    fileType: file.type,
    fileUrl: `/uploads/${folder}/${fileName}`,
  }
}
