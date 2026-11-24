import { getAuth } from "./auth"

/** The signed-in user, as the rest of the server needs them. */
export interface SessionUser {
  id: string
  name: string
  email: string
  image: string | null
}

/**
 * Who is calling? Reads the sign-in cookie and checks it with Better Auth. Returns null when nobody is signed in
 * (no cookie, a stale one, or one that has been signed out). It does not catch a missing database: callers decide.
 */
export async function getSessionUser(source: Request | Headers): Promise<SessionUser | null> {
  const auth = await getAuth()
  const headers = source instanceof Request ? source.headers : source
  const found = await auth.api.getSession({ headers })
  if (!found?.user) return null
  const { id, name, email, image } = found.user
  return { id, name, email, image: image ?? null }
}
