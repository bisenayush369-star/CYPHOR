/**
 * The optional shared password: how the setting is read, how a sign-in is checked, and what the proxy does
 * with both. Every name and password in here is made up.
 */
import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, test } from "node:test"
import { NextRequest } from "next/server"
import { matchesBasicAuth, readBasicAuth } from "../../lib/basic-auth.ts"
import { proxy } from "../../proxy.ts"

const USER = "tester"
const PASSWORD = "not-a-real-password"
const setting = `${USER}:${PASSWORD}`

/** What a browser sends once someone has typed a name and a password. */
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`, "utf8").toString("base64")}`

describe("reading the setting", () => {
  test("nothing, or only spaces, means there is no password", () => {
    assert.equal(readBasicAuth(undefined), null)
    assert.equal(readBasicAuth(""), null)
    assert.equal(readBasicAuth("   "), null)
  })

  test("splits at the first colon, so the password may hold more of them", () => {
    assert.deepEqual(readBasicAuth("ayush:pass:word"), { user: "ayush", password: "pass:word" })
    assert.deepEqual(readBasicAuth(setting), { user: USER, password: PASSWORD })
  })

  test("anything that is not name:password locks the app instead of opening it", () => {
    for (const bad of ["justaword", ":password", "name:", ":"]) assert.equal(readBasicAuth(bad), "invalid", bad)
  })
})

describe("checking a sign-in", () => {
  const expected = { user: USER, password: PASSWORD }

  test("accepts the right name and password", async () => {
    assert.equal(await matchesBasicAuth(basic(USER, PASSWORD), expected), true)
  })

  test("refuses a wrong password, a wrong name, a prefix and a longer guess", async () => {
    for (const [u, p] of [
      [USER, "wrong"],
      ["someone", PASSWORD],
      [USER, PASSWORD.slice(0, -1)],
      [USER, `${PASSWORD}!`],
      [USER.toUpperCase(), PASSWORD],
    ]) {
      assert.equal(await matchesBasicAuth(basic(u, p), expected), false, `${u}:${p}`)
    }
  })

  test("refuses a missing, empty, foreign or broken header without throwing", async () => {
    for (const header of [null, "", "Basic", "Basic ", "Bearer abc", "Basic !!!!", "Basic YQ==YQ==", `Basic ${"A".repeat(5)}`, "Digest username=x"]) {
      assert.equal(await matchesBasicAuth(header, expected), false, String(header))
    }
  })

  test("reads the word Basic in any case, and accepts a password that holds a colon or non-ASCII text", async () => {
    assert.equal(await matchesBasicAuth(basic(USER, PASSWORD).replace("Basic", "basic"), expected), true)
    const odd = { user: "ayush", password: "pässwörd:日本" }
    assert.equal(await matchesBasicAuth(basic(odd.user, odd.password), odd), true)
    assert.equal(await matchesBasicAuth(basic(odd.user, "passwörd:日本"), odd), false)
  })
})

describe("the proxy with a shared password", () => {
  const saved = { auth: process.env.CYPHOR_BASIC_AUTH, limit: process.env.RATE_LIMIT_AUTH_PER_MIN }
  const registry = globalThis as typeof globalThis & { __cyphorLimiters?: unknown }

  beforeEach(() => {
    process.env.CYPHOR_BASIC_AUTH = setting
    process.env.RATE_LIMIT_AUTH_PER_MIN = "3"
    delete registry.__cyphorLimiters // every test starts with nobody having guessed wrong
  })
  afterEach(() => {
    for (const [name, value] of [["CYPHOR_BASIC_AUTH", saved.auth], ["RATE_LIMIT_AUTH_PER_MIN", saved.limit]] as const) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    delete registry.__cyphorLimiters
  })

  const call = (path: string, init: { auth?: string; ip?: string; method?: string; origin?: string } = {}) => {
    const headers: Record<string, string> = { host: "localhost:3000", "x-forwarded-for": init.ip ?? "203.0.113.7" }
    if (init.auth) headers.authorization = init.auth
    if (init.origin) headers.origin = init.origin
    return proxy(new NextRequest(`http://localhost:3000${path}`, { method: init.method ?? "GET", headers }))
  }
  /** Next.js marks a request it should carry on with. Everything else here is an answer from the proxy itself. */
  const letThrough = (res: Response) => res.headers.get("x-middleware-next") === "1"

  test("is open when no password is set", async () => {
    delete process.env.CYPHOR_BASIC_AUTH
    const res = await call("/")
    assert.equal(letThrough(res), true)
    assert.equal(res.headers.get("www-authenticate"), null)
  })

  test("asks a visitor with no password to sign in, and names the realm", async () => {
    const res = await call("/")
    assert.equal(res.status, 401)
    assert.equal(res.headers.get("www-authenticate"), 'Basic realm="Cyphor", charset="UTF-8"')
    assert.equal(res.headers.get("cache-control"), "no-store")
    assert.match(res.headers.get("content-type") ?? "", /^text\/plain/)
    assert.equal(await res.text(), "Sign in to use Cyphor.")
  })

  test("answers the API in the JSON shape the app already reads", async () => {
    const res = await call("/api/models")
    assert.equal(res.status, 401)
    assert.deepEqual(await res.json(), { error: { code: "unauthorized", message: "Sign in to use Cyphor." } })
  })

  test("lets the right password through and still hands out the visitor cookie", async () => {
    const res = await call("/api/models", { auth: basic(USER, PASSWORD) })
    assert.equal(letThrough(res), true)
    assert.match(res.headers.get("set-cookie") ?? "", /cyphor_owner=/)
  })

  test("turns a wrong password away with a 401", async () => {
    const res = await call("/", { auth: basic(USER, "wrong") })
    assert.equal(res.status, 401)
    assert.ok(res.headers.get("www-authenticate"))
  })

  test("does not count a first visit as a guess", async () => {
    for (let i = 0; i < 8; i++) assert.equal((await call("/")).status, 401)
    assert.equal(letThrough(await call("/", { auth: basic(USER, PASSWORD) })), true)
  })

  test("stops an address after too many wrong guesses, even if the next one is right", async () => {
    for (let i = 0; i < 3; i++) assert.equal((await call("/", { auth: basic(USER, `guess-${i}`) })).status, 401)

    const blocked = await call("/", { auth: basic(USER, PASSWORD) })
    assert.equal(blocked.status, 429)
    assert.ok(Number(blocked.headers.get("retry-after")) >= 1)
    assert.match(await blocked.text(), /Too many wrong passwords/)
    assert.equal(blocked.headers.get("set-cookie"), null)

    // Somebody else, at another address, is not caught in it.
    assert.equal(letThrough(await call("/", { auth: basic(USER, PASSWORD), ip: "198.51.100.20" })), true)
  })

  test("says it is too fast in the API's JSON shape too", async () => {
    for (let i = 0; i < 3; i++) await call("/api/models", { auth: basic(USER, `guess-${i}`) })
    const res = await call("/api/models", { auth: basic(USER, PASSWORD) })
    assert.equal(res.status, 429)
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "rate_limited")
  })

  test("locks everything, for pages and the API, when the setting cannot be read", async () => {
    process.env.CYPHOR_BASIC_AUTH = "no-colon-here"
    for (const path of ["/", "/api/models"]) {
      const res = await call(path, { auth: basic("no-colon-here", "") })
      assert.equal(res.status, 503, path)
      assert.match(await res.text(), /CYPHOR_BASIC_AUTH/)
    }
  })

  test("still refuses a write from another site once someone has signed in", async () => {
    const res = await call("/api/chat", { method: "POST", auth: basic(USER, PASSWORD), origin: "https://elsewhere.example" })
    assert.equal(res.status, 403)
    const same = await call("/api/chat", { method: "POST", auth: basic(USER, PASSWORD), origin: "http://localhost:3000" })
    assert.equal(letThrough(same), true)
  })
})
