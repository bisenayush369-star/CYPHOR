import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { getDb, schema, type Db } from "@/db"
import { COOKIE_PREFIX } from "./auth-shared"

/**
 * Sign-in for Cyphor, built on Better Auth: email and password, plus Google when it is set up.
 * Accounts, sessions and the link to Google live in the Postgres database (db/schema.ts).
 *
 * The browser talks to it at /api/auth/* (app/api/auth/[...all]/route.ts). The rest of the server asks
 * who is calling through lib/session.ts.
 */

const MONTH = 60 * 60 * 24 * 30

/** Thrown when the key that signs sessions is missing in production, or too short. The API turns it into a 503 that says how to fix it. */
export class AuthNotConfiguredError extends Error {
  readonly code = "auth_not_configured"
}

export function googleConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim())
}

/** The public address of the app, as set in the environment. Undefined lets Better Auth read it from the request. */
export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const v = (env.BETTER_AUTH_URL || env.APP_URL || "").trim().replace(/\/+$/, "")
  return v || undefined
}

/**
 * The key that signs sessions. In production it must be set, because a guessable key lets anyone forge a session.
 * While developing, a random one is made once and kept in .data/auth-secret, so nothing has to be set up.
 */
export function authSecret(env: NodeJS.ProcessEnv = process.env, file = ".data/auth-secret"): string {
  const set = (env.BETTER_AUTH_SECRET || env.AUTH_SECRET || "").trim()
  if (set) {
    if (set.length < 32) throw new AuthNotConfiguredError("BETTER_AUTH_SECRET is too short. Use at least 32 characters, for example the output of: openssl rand -base64 32")
    return set
  }
  if (env.NODE_ENV === "production") {
    throw new AuthNotConfiguredError("BETTER_AUTH_SECRET is not set. It signs your sessions. Make one with: openssl rand -base64 32. Then add it to your host's environment settings and restart.")
  }
  try {
    // Development only (production returned above), and the path is a parameter, so tell the bundler not to trace the project for it.
    if (existsSync(/* turbopackIgnore: true */ file)) {
      const saved = readFileSync(/* turbopackIgnore: true */ file, "utf8").trim()
      if (saved.length >= 32) return saved
    }
    const made = randomBytes(32).toString("base64")
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, made, { mode: 0o600 })
    return made
  } catch {
    // A read-only disk: a key that lasts as long as this process (everyone signs in again after a restart).
    return randomBytes(32).toString("base64")
  }
}

/** Addresses the browser may sign in from. The app's own address, plus the usual local ones while developing. */
export function trustedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const list = new Set<string>()
  const base = appBaseUrl(env)
  if (base) list.add(base)
  for (const o of (env.TRUSTED_ORIGINS ?? "").split(",")) if (o.trim()) list.add(o.trim().replace(/\/+$/, ""))
  if (env.NODE_ENV !== "production") {
    for (const o of ["http://localhost:3000", "http://127.0.0.1:3000"]) list.add(o)
  }
  return [...list]
}

export function makeAuth(db: Db, env: NodeJS.ProcessEnv = process.env) {
  const base = appBaseUrl(env)
  const google = googleConfigured(env)
  return betterAuth({
    appName: "Cyphor",
    baseURL: base,
    secret: authSecret(env),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
      transaction: true,
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
    socialProviders: google ? { google: { clientId: env.GOOGLE_CLIENT_ID!.trim(), clientSecret: env.GOOGLE_CLIENT_SECRET!.trim() } } : {},
    session: {
      expiresIn: MONTH,
      updateAge: 60 * 60 * 24,
      // A signed copy of the session rides in a cookie for five minutes, so most requests need no database lookup.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    trustedOrigins: trustedOrigins(env),
    // Better Auth limits sign-in and sign-up to a few tries per address every ten seconds in production. The browser
    // tests make an account per test from one address, so their servers set AUTH_RATE_LIMIT=off. Nothing else should.
    ...(env.AUTH_RATE_LIMIT === "off" ? { rateLimit: { enabled: false } } : {}),
    advanced: { cookiePrefix: COOKIE_PREFIX, useSecureCookies: base ? base.startsWith("https://") : undefined },
    plugins: [nextCookies()],
  })
}

export type Auth = ReturnType<typeof makeAuth>

// One instance per server process, kept across hot reloads in development.
const holder = globalThis as typeof globalThis & { __cyphorAuth?: Promise<Auth> }

/** The shared auth instance. It waits for the database (and its tables) the first time. */
export function getAuth(): Promise<Auth> {
  holder.__cyphorAuth ??= getDb()
    .then((db) => makeAuth(db))
    .catch((e) => {
      holder.__cyphorAuth = undefined // let the next request try again
      throw e
    })
  return holder.__cyphorAuth
}
