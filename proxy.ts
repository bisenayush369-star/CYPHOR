import { NextResponse, type NextRequest } from "next/server"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!origin) return true
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function withHeaders(res: NextResponse, isApi: boolean) {
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("X-Frame-Options", "SAMEORIGIN")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  if (isApi) res.headers.set("Cache-Control", "no-store")
  return res
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith("/api/")

  if (isApi && !SAFE_METHODS.has(req.method) && !sameOrigin(req)) {
    return NextResponse.json({ error: { code: "forbidden", message: "Cross-site requests are not allowed." } }, { status: 403 })
  }

  return withHeaders(NextResponse.next(), isApi)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|artifact/).*)"],
}
