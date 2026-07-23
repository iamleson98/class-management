import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import fs from 'node:fs'
import path from 'node:path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Set it in local .env and in Vercel Project Settings > Environment Variables.')
}

function isGeneratedClientEngineTypeClient(): boolean {
  try {
    const generatedSchemaPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client', 'schema.prisma')
    const generatedSchema = fs.readFileSync(generatedSchemaPath, 'utf8')
    return generatedSchema.includes('engineType = "client"')
  } catch {
    return false
  }
}

export const db =
  globalForPrisma.prisma ??
  (() => {
    // If generated client uses engineType=client, provide a pg driver adapter to avoid P2038.
    if (isGeneratedClientEngineTypeClient()) {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL })
      const adapter = new PrismaPg(pool)
      return new PrismaClient({
        adapter,
        log: [],
      })
    }

    return new PrismaClient({
      log: [],
    })
  })()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db