/**
 * An optional shared password for the whole app, for when it is served where other people can reach it.
 *
 * Set CYPHOR_BASIC_AUTH=name:password and every page and API call asks for it: the browser shows its own
 * sign-in box and remembers the answer. Without it, anyone who can open the address can spend your provider keys.
 *
 * This is one shared login, not user accounts. Serve the app over HTTPS, because Basic sends the password
 * with every request. proxy.ts applies it, and the checks live here so tests can reach them.
 */

export interface BasicAuth {
  user: string
  password: string
}

/**
 * Reads the setting. Blank means no password. Anything else that is not `name:password` is `"invalid"`,
 * and the caller must lock the app: a typo must never turn into an open door.
 */
export function readBasicAuth(value: string | undefined): BasicAuth | null | "invalid" {
  if (!value || !value.trim()) return null
  // The name cannot hold a colon, so the first one splits it. The password may.
  const i = value.indexOf(":")
  if (i <= 0 || i === value.length - 1) return "invalid"
  return { user: value.slice(0, i), password: value.slice(i + 1) }
}

const encoder = new TextEncoder()

async function digest(text: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)))
}

/** The `name:password` a header carries, or an empty string when there is none or it is broken. */
function decodeBasic(header: string | null): string | null {
  const m = /^Basic\s+([A-Za-z0-9+/]+={0,2})\s*$/i.exec(header ?? "")
  if (!m) return null
  try {
    const raw = atob(m[1])
    return new TextDecoder().decode(Uint8Array.from(raw, (c) => c.charCodeAt(0)))
  } catch {
    return null
  }
}

/**
 * Whether the Authorization header carries the right name and password. Both sides are hashed first and the
 * hashes are compared without stopping at the first difference, so neither the length of the password nor how
 * much of it was right shows in how long the answer takes.
 */
export async function matchesBasicAuth(header: string | null, expected: BasicAuth): Promise<boolean> {
  const given = decodeBasic(header)
  const [a, b] = await Promise.all([digest(given ?? ""), digest(`${expected.user}:${expected.password}`)])
  let different = given === null ? 1 : 0
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i]
  return different === 0
}
