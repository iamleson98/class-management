import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/utils'

interface EndpointRateLimitRule {
  path: string
  windowMs: number
  maxRequests: number
  keyPrefix: string
  errorMessage: string
}

const ENDPOINT_RATE_LIMIT_RULES: EndpointRateLimitRule[] = [
  {
    path: '/api/v4/lms/public/forgot-password',
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'forgot-password',
    errorMessage: 'Quá nhiều lần yêu cầu. Thử lại sau.',
  },
  {
    path: '/api/v4/lms/public/reset-password',
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'reset-password',
    errorMessage: 'Quá nhiều lần đặt lại mật khẩu. Thử lại sau.',
  },
  {
    path: '/api/v4/lms/public/register',
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'public-register',
    errorMessage: 'Quá nhiều yêu cầu đăng ký. Thử lại sau.',
  },
  {
    path: '/api/v4/lms/public/contact',
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'public-contact',
    errorMessage: 'Quá nhiều yêu cầu. Thử lại sau.',
  },
  {
    path: '/api/v4/users/login',
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'login',
    errorMessage: 'Quá nhiều lần đăng nhập. Thử lại sau.',
  },
]

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIp(request)

  if (request.method === 'OPTIONS') {
    return addSecurityHeaders(NextResponse.next())
  }

  // Apply endpoint-specific rate limiting
  const endpointRule = ENDPOINT_RATE_LIMIT_RULES.find((rule) => pathname === rule.path)
  if (endpointRule) {
    const endpointResult = rateLimit(`${endpointRule.keyPrefix}:${ip}`, {
      windowMs: endpointRule.windowMs,
      maxRequests: endpointRule.maxRequests,
    })

    if (!endpointResult.success) {
      const retryAfter = Math.ceil((endpointResult.resetAt - Date.now()) / 1000)
      const response = NextResponse.json(
        { data: null, error: endpointRule.errorMessage },
        { status: 429 }
      )
      response.headers.set('Retry-After', String(retryAfter))
      return addSecurityHeaders(response)
    }
  }

  // General API rate limiting
  const generalResult = rateLimit(`api:${ip}`, { windowMs: 60 * 1000, maxRequests: 100 })
  if (!generalResult.success) {
    const retryAfter = Math.ceil((generalResult.resetAt - Date.now()) / 1000)
    const response = NextResponse.json(
      { data: null, error: 'Quá nhiều yêu cầu. Thử lại sau.' },
      { status: 429 }
    )
    response.headers.set('Retry-After', String(retryAfter))
    return addSecurityHeaders(response)
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/api/:path*'],
}
