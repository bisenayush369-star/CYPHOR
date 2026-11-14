import { LIMITS } from "./chat-messages"
import { clientIp, envInt, getLimiter, rateLimitHeaders, type RateLimitResult } from "./rate-limit"
import { getOwnerId } from "@/proxy"

/** The shape of every error the API returns, so the browser can show `error.message` as it is. */
export function apiError(status: number, code: string, message: string, headers: HeadersInit = {}) {
  return Response.json({ error: { code, message } }, { status, headers })
}

export type Guarded = { ok: true; ownerId: string; headers: Record<string, string> } | { ok: false; response: Response }

/**
 * Shared front door of the API: who is calling, and are they within their rate limit?
 * `name` picks the limiter ("chat" is stricter than "api"); `perMinute` is its default size.
 */
export function guard(req: Request, name: "api" | "chat" | "god", perMinute: number, envName: string): Guarded {
  const ownerId = getOwnerId(req)
  if (!ownerId) return { ok: false, response: apiError(400, "no_visitor", "Missing visitor id. Reload the page and try again.") }

  const limit = envInt(process.env[envName], perMinute)
  const byOwner = getLimiter(`${name}:owner`, { limit, windowMs: 60_000 }).check(ownerId)
  // A second, wider limit by address, so clearing cookies does not reset the allowance.
  const byIp = getLimiter(`${name}:ip`, { limit: limit * 5, windowMs: 60_000 }).check(clientIp(req.headers))
  const worst: RateLimitResult = !byOwner.ok ? byOwner : !byIp.ok ? byIp : byOwner
  const headers = rateLimitHeaders(worst)
  if (!worst.ok) {
    return {
      ok: false,
      response: apiError(429, "rate_limited", `You're going a little fast. Try again in ${worst.retryAfterSec} second${worst.retryAfterSec === 1 ? "" : "s"}.`, headers),
    }
  }
  return { ok: true, ownerId, headers }
}

/** Reads a JSON body with a size cap. Never throws; returns the error response to send instead. */
export async function readJson(req: Request, maxBytes: number = LIMITS.bodyBytes): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const declared = Number(req.headers.get("content-length") ?? 0)
  if (declared > maxBytes) return { ok: false, response: apiError(413, "too_large", "That request is too large.") }
  let text: string
  try {
    text = await req.text()
  } catch {
    return { ok: false, response: apiError(400, "bad_body", "The request body could not be read.") }
  }
  if (text.length > maxBytes) return { ok: false, response: apiError(413, "too_large", "That request is too large.") }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, response: apiError(400, "bad_json", "The request body is not valid JSON.") }
  }
}
