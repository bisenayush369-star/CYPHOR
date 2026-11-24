/** Small things both the server and the proxy need. No imports, so the proxy stays light. */

/** The start of the sign-in cookie's name (`cyphor.session_token`). The proxy looks for it by this name. */
export const COOKIE_PREFIX = "cyphor"

export const LOGIN_PATH = "/login"

/**
 * Where to go after signing in. Only a path on this site is accepted: anything else
 * (`https://elsewhere.example`, `//elsewhere.example`, `/\elsewhere.example`) becomes `/`, so a crafted link cannot send people away.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value || value.length > 2000) return "/"
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/"
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/"
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`) || value.startsWith(`${LOGIN_PATH}/`)) return "/"
  return value
}

/** The pages and routes that anyone may open without being signed in. */
export function isPublicPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === "/api/auth" || pathname.startsWith("/api/auth/")
}
