/**
 * Sign-in: the small helpers, then the real thing. Accounts, sessions and the Google redirect run through Better Auth
 * on a Postgres engine that lives in memory (PGlite), so the SQL is the SQL Neon would run. Nothing here touches the
 * network, and every secret and key below is made up.
 */
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, before, describe, test } from "node:test"
import { getSessionCookie } from "better-auth/cookies"
import { eq } from "drizzle-orm"
import { openDatabase, schema, type OpenedDatabase } from "../../db/index.ts"
import { appBaseUrl, AuthNotConfiguredError, authSecret, googleConfigured, makeAuth, trustedOrigins } from "../../lib/auth.ts"
import { COOKIE_PREFIX, isPublicPath, LOGIN_PATH, safeNext } from "../../lib/auth-shared.ts"

const SECRET = "unit-test-secret-not-a-real-secret-0123456789abcdef"
const env = (extra: Record<string, string | undefined> = {}) =>
  ({ NODE_ENV: "test", BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: "http://localhost:3000", ...extra }) as unknown as NodeJS.ProcessEnv

describe("where to go after signing in", () => {
  test("keeps a path on this site, with its query", () => {
    assert.equal(safeNext("/chat/c_123"), "/chat/c_123")
    assert.equal(safeNext("/projects?tab=files#top"), "/projects?tab=files#top")
    assert.equal(safeNext("/"), "/")
  })

  test("sends everything else home, so a crafted link cannot lead people away", () => {
    for (const bad of ["https://evil.example", "http://evil.example/x", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil.example", "", null, undefined, "/ok\nSet-Cookie: a=b", "/a\u0000b"]) {
      assert.equal(safeNext(bad as string | null | undefined), "/", JSON.stringify(bad))
    }
    assert.equal(safeNext("/" + "a".repeat(3000)), "/", "far too long")
  })

  test("never loops back to the login page", () => {
    for (const p of ["/login", "/login?next=/chat", "/login/x"]) assert.equal(safeNext(p), "/", p)
    assert.equal(LOGIN_PATH, "/login")
  })
})

describe("what anyone may open without signing in", () => {
  test("the login page and the sign-in routes only", () => {
    for (const p of ["/login", "/api/auth", "/api/auth/sign-in/email", "/api/auth/callback/google", "/api/auth/get-session"]) assert.equal(isPublicPath(p), true, p)
    for (const p of ["/", "/chat", "/chat/c_1", "/projects", "/artifacts", "/api/chat", "/api/models", "/api/conversations", "/api/authors", "/api/auth-not", "/loginx"]) assert.equal(isPublicPath(p), false, p)
  })
})

describe("reading the settings", () => {
  test("knows when Google is set up", () => {
    assert.equal(googleConfigured(env()), false)
    assert.equal(googleConfigured(env({ GOOGLE_CLIENT_ID: "id" })), false, "needs both halves")
    assert.equal(googleConfigured(env({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "  " })), false, "blank is not set")
    assert.equal(googleConfigured(env({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })), true)
  })

  test("takes the app's address from the environment and drops trailing slashes", () => {
    assert.equal(appBaseUrl(env({ BETTER_AUTH_URL: "https://cyphor.example.com///" })), "https://cyphor.example.com")
    assert.equal(appBaseUrl(env({ BETTER_AUTH_URL: undefined, APP_URL: "https://b.example.com/" })), "https://b.example.com")
    assert.equal(appBaseUrl(env({ BETTER_AUTH_URL: undefined })), undefined)
  })

  test("trusts the app's own address, plus localhost only while developing", () => {
    const dev = trustedOrigins(env({ TRUSTED_ORIGINS: "https://preview.example.com/, ,https://other.example.com" }))
    assert.ok(dev.includes("http://localhost:3000"))
    assert.ok(dev.includes("https://preview.example.com"))
    assert.ok(dev.includes("https://other.example.com"))
    const live = trustedOrigins(env({ NODE_ENV: "production", BETTER_AUTH_URL: "https://cyphor.example.com" }))
    assert.deepEqual(live, ["https://cyphor.example.com"])
  })
})

describe("the key that signs sessions", () => {
  const dirs: string[] = []
  const tempFile = () => {
    const dir = mkdtempSync(join(tmpdir(), "cyphor-secret-"))
    dirs.push(dir)
    return join(dir, "nested", "auth-secret")
  }
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  test("uses the one that is set", () => {
    assert.equal(authSecret(env(), tempFile()), SECRET)
    assert.equal(authSecret({ NODE_ENV: "test", AUTH_SECRET: SECRET } as unknown as NodeJS.ProcessEnv, tempFile()), SECRET, "AUTH_SECRET works too")
  })

  test("refuses one that is too short to be safe", () => {
    assert.throws(() => authSecret(env({ BETTER_AUTH_SECRET: "short" }), tempFile()), /too short/)
  })

  test("refuses to sign anyone in, in production, without one", () => {
    assert.throws(() => authSecret(env({ NODE_ENV: "production", BETTER_AUTH_SECRET: undefined }), tempFile()), /BETTER_AUTH_SECRET is not set/)
  })

  test("says it with an error the API can recognise, so the screen can say what to do", () => {
    for (const settings of [{ BETTER_AUTH_SECRET: "short" }, { NODE_ENV: "production", BETTER_AUTH_SECRET: undefined }]) {
      assert.throws(
        () => authSecret(env(settings), tempFile()),
        (e) => e instanceof AuthNotConfiguredError && e.code === "auth_not_configured" && /BETTER_AUTH_SECRET/.test(e.message),
      )
    }
  })

  test("while developing, makes one, keeps it private, and reuses it", () => {
    const file = tempFile()
    const first = authSecret(env({ BETTER_AUTH_SECRET: undefined }), file)
    assert.ok(first.length >= 32)
    assert.equal(readFileSync(file, "utf8").trim(), first)
    assert.equal(authSecret(env({ BETTER_AUTH_SECRET: undefined }), file), first, "the same key after a restart")
    if (process.platform !== "win32") assert.equal(statSync(file).mode & 0o777, 0o600)
  })
})

describe("accounts and sessions", () => {
  let o: OpenedDatabase
  let auth: ReturnType<typeof makeAuth>

  const cookieOf = (res: Response) =>
    res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")
  const sessionTokenOnly = (cookie: string) => cookie.split("; ").filter((c) => c.startsWith(`${COOKIE_PREFIX}.session_token=`)).join("; ")
  const asHeaders = (cookie: string) => new Headers(cookie ? { cookie } : {})
  // asResponse hands back the HTTP response, success or not, so a refusal is a status and a body rather than a thrown error.
  const signUp = (email: string, password = "correct horse battery", name = "Ada Lovelace") => auth.api.signUpEmail({ body: { name, email, password }, asResponse: true })
  const signIn = (email: string, password: string) => auth.api.signInEmail({ body: { email, password }, asResponse: true })
  const refusal = async (res: Response) => {
    assert.ok(res.status >= 400 && res.status < 500, `expected a refusal, got ${res.status}`)
    assert.equal(res.headers.getSetCookie().length, 0, "a refusal sets no cookie")
    return (await res.json()) as { message?: string; code?: string }
  }

  before(async () => {
    o = await openDatabase("pglite://memory")
    auth = makeAuth(o.db, env())
  })

  test("signing up makes an account, stores only a hash of the password, and signs the person in", async () => {
    const res = await signUp("ada@example.com")
    assert.equal(res.status, 200)
    const cookie = cookieOf(res)
    assert.match(cookie, new RegExp(`${COOKIE_PREFIX}\\.session_token=`), "the cookie is named after Cyphor")

    const [user] = await o.db.select().from(schema.user).where(eq(schema.user.email, "ada@example.com"))
    assert.equal(user.name, "Ada Lovelace")
    const [account] = await o.db.select().from(schema.account).where(eq(schema.account.userId, user.id))
    assert.equal(account.providerId, "credential")
    assert.ok(account.password && account.password !== "correct horse battery" && !account.password.includes("correct horse"), "the password itself is never stored")

    const session = await auth.api.getSession({ headers: asHeaders(cookie) })
    assert.equal(session?.user.email, "ada@example.com")
  })

  test("the proxy's cookie check sees the cookie this server sets", async () => {
    const cookie = cookieOf(await signIn("ada@example.com", "correct horse battery"))
    const withCookie = new Request("http://localhost:3000/chat", { headers: { cookie } })
    assert.ok(getSessionCookie(withCookie, { cookiePrefix: COOKIE_PREFIX }), "found")
    assert.equal(getSessionCookie(new Request("http://localhost:3000/chat"), { cookiePrefix: COOKIE_PREFIX }), null, "none without it")
    assert.equal(getSessionCookie(new Request("http://localhost:3000/chat", { headers: { cookie: "better-auth.session_token=x" } }), { cookiePrefix: COOKIE_PREFIX }), null, "another app's cookie does not count")
  })

  test("signs in with the right password, in any letter case for the address, and not with a wrong one", async () => {
    const ok = await signIn("ADA@Example.com", "correct horse battery")
    assert.equal(ok.status, 200)
    assert.match(cookieOf(ok), /session_token=/)
    assert.equal((await refusal(await signIn("ada@example.com", "wrong password here"))).code, "INVALID_EMAIL_OR_PASSWORD")
    assert.equal((await refusal(await signIn("nobody@example.com", "correct horse battery"))).code, "INVALID_EMAIL_OR_PASSWORD")
  })

  test("does not say which half was wrong", async () => {
    const wrongPassword = await refusal(await signIn("ada@example.com", "nope nope nope"))
    const unknownEmail = await refusal(await signIn("ghost@example.com", "nope nope nope"))
    assert.ok(wrongPassword.message, "there is a message to show")
    assert.deepEqual(wrongPassword, unknownEmail)
  })

  test("refuses a second account with the same address, and a password that is too short or too long", async () => {
    assert.match((await refusal(await signUp("ada@example.com"))).message ?? "", /exist|already/i)
    assert.match((await refusal(await signUp("ADA@example.com"))).message ?? "", /exist|already/i)
    assert.match((await refusal(await signUp("short@example.com", "1234567"))).message ?? "", /short/i)
    assert.match((await refusal(await signUp("long@example.com", "x".repeat(129)))).message ?? "", /long/i)
    for (const email of ["short@example.com", "long@example.com"]) assert.equal((await o.db.select().from(schema.user).where(eq(schema.user.email, email))).length, 0, `${email} was not created`)
    assert.equal((await o.db.select().from(schema.user).where(eq(schema.user.email, "ada@example.com"))).length, 1, "still one Ada")
  })

  test("a made-up or empty cookie is nobody", async () => {
    assert.equal(await auth.api.getSession({ headers: asHeaders("") }), null)
    assert.equal(await auth.api.getSession({ headers: asHeaders(`${COOKIE_PREFIX}.session_token=forged.value`) }), null)
  })

  test("signing out ends the session in the database", async () => {
    const cookie = cookieOf(await signIn("ada@example.com", "correct horse battery"))
    const token = sessionTokenOnly(cookie)
    assert.equal((await auth.api.getSession({ headers: asHeaders(token) }))?.user.email, "ada@example.com")
    await auth.api.signOut({ headers: asHeaders(token) })
    assert.equal(await auth.api.getSession({ headers: asHeaders(token) }), null)
  })

  test("the sign-in route refuses a request that comes from another site", async () => {
    const post = (origin: string) =>
      auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify({ email: "ada@example.com", password: "correct horse battery" }),
        })
      )
    assert.equal((await post("http://localhost:3000")).status, 200)
    assert.equal((await post("https://evil.example")).status, 403)
  })

  test("two people's sessions are their own", async () => {
    await signUp("lin@example.com", "another good password", "Lin")
    const a = await auth.api.getSession({ headers: asHeaders(cookieOf(await signIn("ada@example.com", "correct horse battery"))) })
    const b = await auth.api.getSession({ headers: asHeaders(cookieOf(await signIn("lin@example.com", "another good password"))) })
    assert.notEqual(a?.user.id, b?.user.id)
    assert.equal(b?.user.name, "Lin")
  })
})

describe("signing in with Google", () => {
  const dbs: OpenedDatabase[] = []
  const withDb = async () => {
    const o = await openDatabase("pglite://memory")
    dbs.push(o)
    return o
  }
  afterEach(async () => {
    for (const o of dbs.splice(0)) await o.close()
  })

  test("is not offered until both settings are there", async () => {
    const auth = makeAuth((await withDb()).db, env())
    await assert.rejects(() => auth.api.signInSocial({ body: { provider: "google", callbackURL: "/" } }), /provider|not found|not.*support/i)
  })

  test("sends the person to Google, and asks Google to come back to this app", async () => {
    const auth = makeAuth((await withDb()).db, env({ GOOGLE_CLIENT_ID: "test-client-id.apps.example", GOOGLE_CLIENT_SECRET: "test-client-secret-not-real" }))
    const res = (await auth.api.signInSocial({ body: { provider: "google", callbackURL: "/chat" } })) as { url?: string; redirect?: boolean }
    assert.ok(res.url, "a redirect address")
    const url = new URL(res.url!)
    assert.equal(url.hostname, "accounts.google.com")
    assert.equal(url.searchParams.get("client_id"), "test-client-id.apps.example")
    assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/api/auth/callback/google", "the address to register in Google Cloud")
    assert.match(url.searchParams.get("scope") ?? "", /email/)
    assert.ok(!res.url!.includes("test-client-secret"), "the secret never leaves the server")
  })
})
