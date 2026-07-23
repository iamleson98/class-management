import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import type { NextResponse } from 'next/server'

// ─── Password hashing ───────────────────────────────────────────
const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword)
}

// ─── JWT helpers ────────────────────────────────────────────────
// Using jose (Edge-compatible) with TextEncoder for secret handling

function getSecret(key: string): Uint8Array {
  const secret = process.env[key]
  if (!secret) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  return new TextEncoder().encode(secret)
}

export interface TokenPayload {
  sub: string   // userId
  role?: string
  email?: string
}

const ACCESS_EXPIRY = '15m'
const REFRESH_EXPIRY = '7d'

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRY)
    .sign(getSecret('JWT_SECRET'))
}

export async function signRefreshToken(payload: { sub: string }): Promise<string> {
  return new SignJWT({ sub: payload.sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRY)
    .sign(getSecret('REFRESH_SECRET'))
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret('JWT_SECRET'))
  return payload as unknown as TokenPayload
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, getSecret('REFRESH_SECRET'))
  return { sub: payload.sub as string }
}

// ─── Cookie helpers ──────────────────────────────────────────────
export const COOKIE_NAMES = {
  ACCESS: 'token',
  REFRESH: 'refresh-token',
} as const

// 15 minutes in seconds
const ACCESS_MAX_AGE = 15 * 60
// 7 days in seconds
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60

export function setTokenCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  const isProduction = process.env.NODE_ENV === 'production'

  response.cookies.set(COOKIE_NAMES.ACCESS, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_MAX_AGE,
    // Prevent cookie stripping during Vercel domain redirects
    domain: undefined,
  })

  response.cookies.set(COOKIE_NAMES.REFRESH, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: REFRESH_MAX_AGE,
    domain: undefined,
  })
}

export function clearTokenCookies(response: NextResponse) {
  const isProduction = process.env.NODE_ENV === 'production'

  response.cookies.set(COOKIE_NAMES.ACCESS, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    domain: undefined,
  })

  response.cookies.set(COOKIE_NAMES.REFRESH, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 0,
    domain: undefined,
  })
}

export function getAccessTokenFromCookies(cookieStore: { get: (name: string) => { value: string } | undefined }): string | undefined {
  return cookieStore.get(COOKIE_NAMES.ACCESS)?.value
}
