import { NextResponse, type NextRequest } from "next/server"
import { matchesBasicAuth, readBasicAuth } from "@/lib/basic-auth"
import { clientIp, envInt, getLimiter, rateLimitHeaders } from "@/lib/rate-limit"

/**
 * Runs before every request (this is what Next.js 16 calls the proxy, formerly "middleware").
 *
 * It gives each browser an anonymous visitor id in a cookie, so conversations saved by the API
 * belong to the browser that made them. The API routes read it with getOwnerId().
 * To add real accounts, replace the id with your user id here and nothing else has to change.
 *
 * If CYPHOR_BASIC_AUTH=name:password is set, it also asks for that password first (see lib/basic-auth.ts).
 */

export const OWNER_COOKIE = "cyphor_owner"
/** The proxy copies the id onto the request with this header so a route sees it on the very first visit too. */
export const OWNER_HEADER = "x-cyphor-owner"

const OWNER_RE = /^[A-Za-z0-9_-]{22,64}$/
const YEAR = 60 * 60 * 24 * 365

function newOwnerId() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8)
}

function readCookie(header: string | null, name: string) {
  if (!header) return undefined
  for (const part of header.split(";")) {
    const i = part.indexOf("=")
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return undefined
}

/** The visitor id of this request, or null if the proxy did not run. Used by every API route. */
export function getOwnerId(req: Request): string | null {
  const fromHeader = req.headers.get(OWNER_HEADER)
  if (fromHeader && OWNER_RE.test(fromHeader)) return fromHeader
  const fromCookie = readCookie(req.headers.get("cookie"), OWNER_COOKIE)
  return fromCookie && OWNER_RE.test(fromCookie) ? fromCookie : null
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!origin) return true // not a browser cross-site request
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** Says no in the shape the caller reads: the API's JSON error for /api, plain text for a page. */
function refuse(isApi: boolean, status: number, code: string, message: string, headers: Record<string, string> = {}) {
  const common = { "Cache-Control": "no-store", ...headers }
  if (isApi) return NextResponse.json({ error: { code, message } }, { status, headers: common })
  return new NextResponse(message, { status, headers: { ...common, "Content-Type": "text/plain; charset=utf-8" } })
}

/**
 * The shared password. Returns the response to send, or null when the app is open or the caller has signed in.
 * Wrong guesses are counted per address: after a few in a minute that address is turned away, even with the
 * right password, so guessing cannot go on at full speed. A first visit sends no password and is not a guess.
 */
async function gate(req: NextRequest, isApi: boolean): Promise<NextResponse | null> {
  const setting = readBasicAuth(process.env.CYPHOR_BASIC_AUTH)
  if (setting === null) return null
  // A setting that cannot be read must lock the app, never open it.
  if (setting === "invalid") {
    return refuse(isApi, 503, "locked", "CYPHOR_BASIC_AUTH is set but is not written as name:password, so Cyphor stays locked until that is fixed.")
  }

  const wrong = getLimiter("auth:wrong", { limit: envInt(process.env.RATE_LIMIT_AUTH_PER_MIN, 10), windowMs: 60_000 })
  const who = clientIp(req.headers)
  const turnedAway = wrong.peek(who)
  if (!turnedAway.ok) {
    const secs = turnedAway.retryAfterSec
    return refuse(isApi, 429, "rate_limited", `Too many wrong passwords. Try again in ${secs} second${secs === 1 ? "" : "s"}.`, rateLimitHeaders(turnedAway))
  }

  const sent = req.headers.get("authorization")
  if (await matchesBasicAuth(sent, setting)) return null
  if (sent) wrong.check(who)
  return refuse(isApi, 401, "unauthorized", "Sign in to use Cyphor.", { "WWW-Authenticate": 'Basic realm="Cyphor", charset="UTF-8"' })
}

export async function proxy(req: NextRequest) {
  const isApi = req.nextUrl.pathname.startsWith("/api/")

  const signIn = await gate(req, isApi)
  if (signIn) return signIn

  // Cookies are sent with cross-site requests too. Refuse writes that did not come from this site.
  if (isApi && !SAFE_METHODS.has(req.method) && !sameOrigin(req)) {
    return NextResponse.json({ error: { code: "forbidden", message: "Cross-site requests are not allowed." } }, { status: 403 })
  }

  const existing = req.cookies.get(OWNER_COOKIE)?.value
  const fresh = !existing || !OWNER_RE.test(existing)
  const owner = fresh ? newOwnerId() : existing

  // Overwrite whatever the client sent, so the header can be trusted by the routes.
  const headers = new Headers(req.headers)
  headers.set(OWNER_HEADER, owner)
  const res = NextResponse.next({ request: { headers } })

  if (fresh) {
    res.cookies.set(OWNER_COOKIE, owner, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
      maxAge: YEAR,
    })
  }
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  if (isApi) res.headers.set("Cache-Control", "no-store")
  return res
}

export const config = {
  // Everything except static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
}
