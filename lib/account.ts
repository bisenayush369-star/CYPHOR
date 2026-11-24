import { create } from "zustand"
import { safeNext } from "./auth-shared"
import { activateUser } from "./store"

/**
 * Who is using this browser. The sign-in itself lives on the server (lib/auth.ts, Better Auth); this keeps
 * what the screens need: the person's name, whether they are signed in, and the calls the login page makes.
 *
 * "loading" while the server is asked, "ready" once the person's saved copy is loaded, "signed-out" when
 * there is no valid sign-in, "problem" when the server cannot say (no database set up, or no connection and
 * no earlier sign-in on this device to fall back on).
 */

export interface Person {
  id: string
  name: string
  email: string
  image: string | null
}

export type AccountStatus = "loading" | "ready" | "signed-out" | "problem"

export interface Problem {
  code: "db_not_configured" | "db_unavailable" | "auth_not_configured" | "offline" | "unknown"
  message: string
}

interface AccountState {
  status: AccountStatus
  person: Person | null
  problem: Problem | null
  /** True when the person was let in from this device's memory because the server could not be reached. */
  offline: boolean
}

export const useAccount = create<AccountState>()(() => ({ status: "loading", person: null, problem: null, offline: false }))

/** The preview has no server, so it has a single local person and no sign-in. */
const PREVIEW_PERSON: Person = { id: "local", name: "Local", email: "local@cyphor", image: null }

/** Asks the server who is signed in and loads that person's saved copy. Safe to call more than once. */
export async function loadAccount(): Promise<void> {
  await enter(PREVIEW_PERSON)
}

/** The server said "sign in" (a 401). The page then sends the person to the login page. */
export function expireSession() {}

/** Sends the browser to the login page, remembering where it was. A full page load, so nothing from the last account lingers. */
export function goToLogin() {}

/* ---------------------------------------------------------------- */
/* The login page's calls                                            */
/* ---------------------------------------------------------------- */

export interface Outcome {
  ok: boolean
  /** A sentence for the person, in plain words. */
  message?: string
  /** Which field the message is about, when one. */
  field?: "name" | "email" | "password"
}

async function errorBody(res: Response): Promise<{ code: string; message: string }> {
  try {
    const j = (await res.json()) as { code?: string; message?: string; error?: { code?: string; message?: string } }
    return { code: String(j.code ?? j.error?.code ?? ""), message: String(j.message ?? j.error?.message ?? "") }
  } catch {
    return { code: "", message: "" }
  }
}

/** Better Auth's error codes, in words a person can act on. Anything not listed is shown as the server wrote it. */
function friendly(res: Response, e: { code: string; message: string }, kind: "in" | "up"): Outcome {
  if (res.status === 429) return { ok: false, message: "Too many tries. Wait a few seconds and try again." }
  if (res.status === 503) return { ok: false, message: e.message || "Cyphor could not reach its database." }
  switch (e.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return { ok: false, message: "That email and password do not match an account.", field: "password" }
    case "INVALID_EMAIL":
      return { ok: false, message: "That does not look like an email address.", field: "email" }
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return { ok: false, message: "An account with that email already exists. Sign in instead.", field: "email" }
    case "PASSWORD_TOO_SHORT":
      return { ok: false, message: "Use at least 8 characters for the password.", field: "password" }
    case "PASSWORD_TOO_LONG":
      return { ok: false, message: "That password is too long. Use 128 characters or fewer.", field: "password" }
    case "EMAIL_NOT_VERIFIED":
      return { ok: false, message: "Confirm your email first." }
  }
  return { ok: false, message: e.message || (kind === "in" ? "Could not sign you in. Try again." : "Could not create the account. Try again.") }
}

async function post(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" })
  } catch {
    return null
  }
}
const OFFLINE: Outcome = { ok: false, message: "Could not reach Cyphor. Check your connection and try again." }

export async function signInWithEmail(email: string, password: string): Promise<Outcome> {
  const res = await post("/api/auth/sign-in/email", { email: email.trim(), password })
  if (!res) return OFFLINE
  return res.ok ? { ok: true } : friendly(res, await errorBody(res), "in")
}

export async function signUpWithEmail(name: string, email: string, password: string): Promise<Outcome> {
  const res = await post("/api/auth/sign-up/email", { name: name.trim(), email: email.trim(), password })
  if (!res) return OFFLINE
  return res.ok ? { ok: true } : friendly(res, await errorBody(res), "up")
}

/** Starts the Google sign-in. On success the browser is sent to Google and comes back signed in. */
export async function signInWithGoogle(next: string): Promise<Outcome> {
  const to = safeNext(next)
  const res = await post("/api/auth/sign-in/social", { provider: "google", callbackURL: to, errorCallbackURL: "/login?error=google", newUserCallbackURL: to })
  if (!res) return OFFLINE
  if (!res.ok) return friendly(res, await errorBody(res), "in")
  const j = (await res.json().catch(() => null)) as { url?: string } | null
  if (!j?.url) return { ok: false, message: "Google did not give a sign-in address. Try again." }
  location.assign(j.url)
  return { ok: true }
}

async function enter(person: Person) {
  await activateUser(person.id)
  useAccount.setState({ status: "ready", person, problem: null, offline: false })
}
