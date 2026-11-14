/**
 * Sliding-window rate limiter, kept in memory.
 *
 * Good for one server process (a laptop, a VM, a container). On serverless or several instances each
 * process counts on its own; swap `createRateLimiter` for Redis or Upstash there and keep the callers.
 */

export interface RateLimitResult {
  ok: boolean
  limit: number
  remaining: number
  /** Unix time (ms) when the oldest counted request leaves the window. */
  resetAt: number
  /** Whole seconds to wait before trying again. 0 when the request was allowed. */
  retryAfterSec: number
}

export interface RateLimiter {
  /** Counts one request for `key` and says whether it may go ahead. */
  check(key: string): RateLimitResult
  /** What `check` would say right now, without counting anything. For limits that only wrong answers use up. */
  peek(key: string): RateLimitResult
  /** Number of keys currently tracked. */
  size(): number
  clear(): void
}

export interface RateLimiterOptions {
  limit: number
  windowMs: number
  /** Injected clock, for tests. */
  now?: () => number
  /** Upper bound on tracked keys, so a flood of distinct keys cannot grow memory without limit. */
  maxKeys?: number
}

export function createRateLimiter({ limit, windowMs, now = Date.now, maxKeys = 5000 }: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>()
  let lastSweep = now()

  function sweep(t: number) {
    if (t - lastSweep < windowMs && hits.size <= maxKeys) return
    lastSweep = t
    const cutoff = t - windowMs
    for (const [key, log] of hits) {
      if (log[log.length - 1] <= cutoff) hits.delete(key)
    }
    // Still too many keys: drop the least recently used ones (Map keeps insertion order).
    while (hits.size > maxKeys) {
      const oldest = hits.keys().next().value
      if (oldest === undefined) break
      hits.delete(oldest)
    }
  }

  return {
    check(key) {
      const t = now()
      sweep(t)
      const cutoff = t - windowMs
      const log = (hits.get(key) ?? []).filter((x) => x > cutoff)
      hits.delete(key) // re-insert below so recently used keys sit at the end

      if (log.length >= limit) {
        hits.set(key, log)
        const resetAt = log[0] + windowMs
        return { ok: false, limit, remaining: 0, resetAt, retryAfterSec: Math.max(1, Math.ceil((resetAt - t) / 1000)) }
      }
      log.push(t)
      hits.set(key, log)
      return { ok: true, limit, remaining: limit - log.length, resetAt: log[0] + windowMs, retryAfterSec: 0 }
    },
    peek(key) {
      const t = now()
      const log = (hits.get(key) ?? []).filter((x) => x > t - windowMs)
      if (log.length >= limit) {
        const resetAt = log[0] + windowMs
        return { ok: false, limit, remaining: 0, resetAt, retryAfterSec: Math.max(1, Math.ceil((resetAt - t) / 1000)) }
      }
      return { ok: true, limit, remaining: limit - log.length, resetAt: (log[0] ?? t) + windowMs, retryAfterSec: 0 }
    },
    size: () => hits.size,
    clear: () => hits.clear(),
  }
}

/** Standard headers, plus Retry-After when the request was refused. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
  }
  if (!r.ok) headers["Retry-After"] = String(r.retryAfterSec)
  return headers
}

/** Best guess at the caller's address behind a proxy. Only used as a coarse second key. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown"
  return headers.get("x-real-ip")?.trim() || "unknown"
}

export function envInt(value: string | undefined, fallback: number) {
  const n = Number.parseInt(value ?? "", 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** One limiter per name per process, shared by every route and surviving hot reloads in development. */
const registry = globalThis as typeof globalThis & { __cyphorLimiters?: Map<string, RateLimiter> }

export function getLimiter(name: string, opts: RateLimiterOptions): RateLimiter {
  const map = (registry.__cyphorLimiters ??= new Map())
  let limiter = map.get(name)
  if (!limiter) {
    limiter = createRateLimiter(opts)
    map.set(name, limiter)
  }
  return limiter
}
