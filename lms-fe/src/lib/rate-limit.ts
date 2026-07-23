/**
 * In-memory sliding window rate limiter.
 * Works in both Edge middleware (global scope) and Node.js API routes.
 *
 * Each key tracks timestamps of requests within a window.
 * Old entries are cleaned up periodically to prevent memory leaks.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes to prevent memory leaks
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      // Remove entries older than 15 minutes (longest window)
      entry.timestamps = entry.timestamps.filter((t) => now - t < 15 * 60 * 1000)
      if (entry.timestamps.length === 0) {
        store.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number // Unix timestamp (ms) when the oldest request in window expires
}

export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number
  /** Max requests within the window */
  maxRequests: number
}

/**
 * Check rate limit for a given key.
 * Returns `{ success: true, remaining, resetAt }` if allowed,
 * or `{ success: false, remaining: 0, resetAt }` if rate limited.
 */
export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const windowStart = now - options.windowMs

  let entry = store.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Filter out timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

  if (entry.timestamps.length >= options.maxRequests) {
    // Rate limited — find when the oldest request expires
    const oldest = entry.timestamps[0]
    const resetAt = oldest + options.windowMs
    return {
      success: false,
      remaining: 0,
      resetAt,
    }
  }

  // Add current request timestamp
  entry.timestamps.push(now)

  const remaining = options.maxRequests - entry.timestamps.length
  const oldest = entry.timestamps[0]
  const resetAt = oldest + options.windowMs

  return {
    success: true,
    remaining,
    resetAt,
  }
}

/**
 * Reset rate limit for a key (e.g., after successful login).
 */
export function resetRateLimit(key: string): void {
  store.delete(key)
}
