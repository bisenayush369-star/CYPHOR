/**
 * Minimal in-memory rate limiter.
 *
 * Good enough for local dev and a single long-running Node.js server. NOT
 * safe for serverless/multi-instance deployments (Vercel, Lambda, etc.) —
 * each instance gets its own memory, so a limit of 20/min could actually
 * allow 20 * N-instances per minute, and counters reset on every cold start.
 *
 * For real production on serverless, swap this for a shared store — the
 * drop-in replacement most people reach for is Upstash Redis:
 *
 *   pnpm add @upstash/ratelimit @upstash/redis
 *
 *   import { Ratelimit } from "@upstash/ratelimit";
 *   import { Redis } from "@upstash/redis";
 *   const ratelimit = new Ratelimit({
 *     redis: Redis.fromEnv(),
 *     limiter: Ratelimit.slidingWindow(20, "60 s"),
 *   });
 *   const { success, reset } = await ratelimit.limit(identifier);
 *
 * Same shape, same call site in route.ts — just replace checkRateLimit's
 * internals (or the call site) with the above.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Periodically forget stale buckets so this Map can't grow forever.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  identifier: string,
  max = MAX_REQUESTS_PER_WINDOW,
  windowMs = WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(identifier);

  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(identifier, { count: 1, windowStart: now });
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= max) {
    const retryAfterSeconds = Math.ceil((existing.windowStart + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true, remaining: max - existing.count, retryAfterSeconds: 0 };
}

/** Best-effort client identifier from standard proxy headers. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
