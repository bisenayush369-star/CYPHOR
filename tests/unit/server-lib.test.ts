/**
 * The small server pieces the API routes stand on: retrying, rate limiting, checking what a client
 * sends, and the database that keeps conversations (including opening one made by an older version).
 */
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, test } from "node:test"
import { createClient } from "@libsql/client"
import { eq } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { BOOTSTRAP_SQL, openDatabase, schema } from "../../db/index.ts"
import { checkChatRequest, checkMeta, chatToRows, messageToRow, rowsToChat } from "../../lib/chat-messages.ts"
import { clientIp, createRateLimiter, envInt, rateLimitHeaders } from "../../lib/rate-limit.ts"
import { backoffDelay, HttpError, isAbort, isRetryableStatus, parseRetryAfter, withRetry } from "../../lib/retry.ts"
import type { Chat, Message } from "../../lib/types.ts"

describe("retrying", () => {
  test("knows which statuses are worth another try", () => {
    for (const s of [408, 425, 429, 500, 502, 503, 504, 529]) assert.equal(isRetryableStatus(s), true, String(s))
    for (const s of [200, 400, 401, 403, 404, 422]) assert.equal(isRetryableStatus(s), false, String(s))
  })

  test("reads Retry-After as seconds or as a date", () => {
    assert.equal(parseRetryAfter("7"), 7000)
    assert.equal(parseRetryAfter("0"), 0)
    assert.equal(parseRetryAfter("-5"), 0)
    const now = Date.parse("2026-11-02T10:00:00Z")
    assert.equal(parseRetryAfter("Mon, 02 Nov 2026 10:00:05 GMT", now), 5000)
    assert.equal(parseRetryAfter("Mon, 02 Nov 2026 09:00:00 GMT", now), 0, "a date in the past means now")
    for (const junk of [null, undefined, "", "soon"]) assert.equal(parseRetryAfter(junk), undefined)
  })

  test("backs off with jitter, up to a cap", () => {
    assert.equal(backoffDelay(0, 300, 4000, () => 0.5), 150)
    assert.equal(backoffDelay(3, 300, 4000, () => 0.5), 1200)
    assert.equal(backoffDelay(10, 300, 4000, () => 0.5), 2000, "capped at maxMs before the jitter")
    assert.equal(backoffDelay(2, 300, 4000, () => 0), 0)
    assert.ok(backoffDelay(2, 300, 4000, () => 0.999999) < 1200)
  })

  const sleeps: number[] = []
  const quick = { sleep: async (ms: number) => void sleeps.push(ms), random: () => 1 }
  afterEach(() => void (sleeps.length = 0))

  test("returns at once when the first try works", async () => {
    let calls = 0
    assert.equal(await withRetry(async () => (calls++, "ok"), quick), "ok")
    assert.equal(calls, 1)
  })

  test("tries again after a server hiccup, and tells onRetry", async () => {
    const seen: number[] = []
    let calls = 0
    const out = await withRetry(
      async () => {
        if (++calls < 3) throw new HttpError(503, "busy")
        return "finally"
      },
      { ...quick, onRetry: (i) => seen.push(i.attempt) }
    )
    assert.equal(out, "finally")
    assert.equal(calls, 3)
    assert.deepEqual(seen, [1, 2])
    assert.equal(sleeps.length, 2)
  })

  test("gives up after the allowed retries and throws the last error", async () => {
    let calls = 0
    await assert.rejects(
      withRetry(async () => {
        calls++
        throw new HttpError(500, `try ${calls}`)
      }, { ...quick, retries: 2 }),
      /try 3/
    )
    assert.equal(calls, 3)
  })

  test("does not retry a request that was simply wrong, or a cancelled one", async () => {
    let calls = 0
    await assert.rejects(withRetry(async () => (calls++, Promise.reject(new HttpError(400, "bad"))), quick))
    assert.equal(calls, 1)
    const abort = Object.assign(new Error("x"), { name: "AbortError" })
    await assert.rejects(withRetry(async () => (calls++, Promise.reject(abort)), quick))
    assert.equal(calls, 2)
    assert.equal(isAbort(abort), true)
    assert.equal(isAbort(new Error("x")), false)
  })

  test("retries a network failure", async () => {
    let calls = 0
    assert.equal(await withRetry(async () => (++calls < 2 ? Promise.reject(new TypeError("fetch failed")) : "back"), quick), "back")
  })

  test("waits as long as the server asks, but not longer than it is willing to", async () => {
    let calls = 0
    await withRetry(async () => (++calls < 2 ? Promise.reject(new HttpError(429, "slow down", 1500)) : "ok"), { ...quick, maxMs: 4000 })
    assert.ok(sleeps[0] >= 1500)
    calls = 0
    await assert.rejects(withRetry(async () => (calls++, Promise.reject(new HttpError(429, "wait", 60_000))), { ...quick, maxMs: 4000 }), HttpError)
    assert.equal(calls, 1, "a long wait is reported, not slept through")
  })

  test("does not start when it was already cancelled", async () => {
    const ac = new AbortController()
    ac.abort()
    let calls = 0
    await assert.rejects(withRetry(async () => (calls++, "x"), { signal: ac.signal }), (e: unknown) => isAbort(e))
    assert.equal(calls, 0)
  })
})

describe("rate limiting", () => {
  test("lets a visitor through up to the limit, then says when to come back", () => {
    let t = 1_000_000
    const rl = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => t })
    const results = [rl.check("a"), rl.check("a"), rl.check("a")]
    assert.deepEqual(results.map((r) => [r.ok, r.remaining]), [[true, 2], [true, 1], [true, 0]])
    t += 10_000
    const refused = rl.check("a")
    assert.equal(refused.ok, false)
    assert.equal(refused.retryAfterSec, 50)
    assert.equal(refused.remaining, 0)
  })

  test("lets them back in as the window slides", () => {
    let t = 0
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t })
    rl.check("a")
    t = 600
    rl.check("a")
    t = 900
    assert.equal(rl.check("a").ok, false)
    t = 1001
    assert.equal(rl.check("a").ok, true, "the first request has left the window")
    assert.equal(rl.check("a").ok, false)
  })

  test("counts each visitor on their own", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000 })
    assert.equal(rl.check("a").ok, true)
    assert.equal(rl.check("b").ok, true)
    assert.equal(rl.check("a").ok, false)
  })

  test("peek says what check would, without using up the allowance", () => {
    let t = 0
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t })
    for (let i = 0; i < 5; i++) assert.deepEqual([rl.peek("a").ok, rl.peek("a").remaining], [true, 2], "looking does not count")
    assert.equal(rl.size(), 0, "and does not start tracking anyone")

    rl.check("a")
    rl.check("a")
    t = 400
    const full = rl.peek("a")
    assert.deepEqual([full.ok, full.remaining, full.retryAfterSec], [false, 0, 1])
    assert.equal(rl.peek("b").ok, true)

    t = 1001
    assert.equal(rl.peek("a").ok, true, "the window has slid past both")
  })

  test("does not let a flood of new visitors grow memory without end", () => {
    let t = 0
    const rl = createRateLimiter({ limit: 5, windowMs: 60_000, now: () => t, maxKeys: 50 })
    for (let i = 0; i < 500; i++) {
      t += 1
      rl.check(`visitor-${i}`)
    }
    assert.ok(rl.size() <= 51, `tracking ${rl.size()} keys`)
    rl.clear()
    assert.equal(rl.size(), 0)
  })

  test("writes the standard headers, and Retry-After only when it refused", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000 })
    const ok = rateLimitHeaders(rl.check("a"))
    assert.equal(ok["X-RateLimit-Limit"], "1")
    assert.equal(ok["Retry-After"], undefined)
    const no = rateLimitHeaders(rl.check("a"))
    assert.ok(Number(no["Retry-After"]) >= 1)
  })

  test("finds the caller behind a proxy, and reads numbers from the environment", () => {
    assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9")
    assert.equal(clientIp(new Headers({ "x-real-ip": " 198.51.100.4 " })), "198.51.100.4")
    assert.equal(clientIp(new Headers()), "unknown")
    assert.deepEqual([envInt("30", 5), envInt("0", 5), envInt("abc", 5), envInt(undefined, 5)], [30, 5, 5, 5])
  })
})

/* ---------------------------------------------------------------- */
/* What the router remembers about a reply                           */
/* ---------------------------------------------------------------- */

const route = { mode: "fallback", provider: "groq", providerLabel: "Groq", model: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", reason: "Groq was too slow, so this answered instead.", task: "code" }
const member = (provider: string, status: string, extra: Record<string, unknown> = {}) => ({ key: `${provider}:m`, provider, providerLabel: provider, model: "m", name: "M", status, ...extra })

describe("checking router metadata", () => {
  test("keeps a good route, council and list of sources", () => {
    const meta = checkMeta({
      route,
      council: { phase: "done", members: [member("groq", "done", { ms: 812.4, snippet: "Hello" }), member("mistral", "failed", { error: "down" })], chair: { provider: "anthropic", providerLabel: "Anthropic", model: "c", name: "C" }, note: "Two of three answered." },
      sources: [{ title: "A page", url: "https://example.com/a", site: "example.com", snippet: "S" }],
      webNote: "Search worked.",
    })
    assert.equal(meta.route?.task, "code")
    assert.equal(meta.council?.members.length, 2)
    assert.equal(meta.council?.members[0].ms, 812)
    assert.equal(meta.council?.chair?.provider, "anthropic")
    assert.equal(meta.sources?.[0].url, "https://example.com/a")
    assert.equal(meta.webNote, "Search worked.")
  })

  test("drops what is not valid instead of saving it", () => {
    assert.deepEqual(checkMeta({}), {})
    assert.deepEqual(checkMeta({ route: { ...route, mode: "teleport" } }), {})
    assert.deepEqual(checkMeta({ route: { ...route, provider: "../../etc" } }), {})
    assert.deepEqual(checkMeta({ council: { phase: "done", members: "no" } }), {})
    const council = checkMeta({ council: { phase: "done", members: [member("groq", "done"), member("x", "exploded"), member("../y", "done"), null] } }).council
    assert.equal(council?.members.length, 1)
    assert.equal(checkMeta({ route: { ...route, task: "dancing" } }).route?.task, undefined)
  })

  test("never saves a link that is not a web address", () => {
    const sources = checkMeta({ sources: [{ title: "x", url: "javascript:alert(1)" }, { title: "y", url: "data:text/html,hi" }, { title: "z", url: "https://ok.example/z" }, { url: "HTTP://UPPER.example" }] }).sources
    assert.deepEqual(sources?.map((s) => s.url), ["https://ok.example/z", "HTTP://UPPER.example"])
    assert.equal(checkMeta({ sources: [{ url: "javascript:1" }] }).sources, undefined)
  })

  test("limits the size of everything it keeps", () => {
    const meta = checkMeta({
      route: { ...route, reason: "r".repeat(1000), name: "n".repeat(500) },
      council: { phase: "done", members: Array.from({ length: 20 }, (_, i) => member(`p${i}`, "done")) },
      sources: Array.from({ length: 30 }, (_, i) => ({ title: "t", url: `https://e.com/${i}` })),
      webNote: "w".repeat(1000),
    })
    assert.equal(meta.route?.reason.length, 400)
    assert.equal(meta.route?.name.length, 120)
    assert.equal(meta.council?.members.length, 8)
    assert.equal(meta.sources?.length, 12)
    assert.equal(meta.webNote?.length, 300)
  })
})

describe("saving and restoring a reply", () => {
  const user: Message = { id: "u1", parentId: null, role: "user", content: "Hi", createdAt: 1, childIds: ["a1"], activeChildId: "a1" }
  const reply: Message = {
    id: "a1",
    parentId: "u1",
    role: "assistant",
    content: "Hello",
    createdAt: 2,
    model: "cyphor-auto",
    childIds: [],
    activeChildId: null,
    status: "done",
    route: route as Message["route"],
    sources: [{ title: "A page", url: "https://example.com/a" }],
    webNote: "Search worked.",
    attachments: [{ id: "f1", name: "pic.png", kind: "image", mime: "image/png", size: 10, dataUrl: "data:image/png;base64,AAAA" }],
  }
  const chat: Chat = { id: "c1", title: "T", createdAt: 1, updatedAt: 2, starred: false, projectId: null, model: "cyphor-auto", nodes: { u1: user, a1: reply }, rootChildIds: ["u1"], rootActiveId: "u1" }

  test("keeps the route, sources and note, and drops the picture's bytes", () => {
    const { messages } = chatToRows("owner", chat)
    const row = messages.find((m) => m.id === "a1")!
    assert.equal(row.meta?.route?.provider, "groq")
    assert.equal(row.meta?.sources?.length, 1)
    assert.ok(!JSON.stringify(row).includes("base64"), "image bytes are never stored")
    assert.equal(messages.find((m) => m.id === "u1")!.meta, null, "a plain message has no metadata")
  })

  test("a reply that was still streaming is saved as stopped", () => {
    assert.equal(messageToRow("c1", { ...reply, status: "streaming" }).status, "stopped")
  })

  test("comes back as it went in", () => {
    const { conversation, messages } = chatToRows("owner", chat)
    const back = rowsToChat(conversation, messages)
    assert.equal(back.nodes.a1.route?.provider, "groq")
    assert.equal(back.nodes.a1.webNote, "Search worked.")
    assert.deepEqual(back.nodes.a1.sources?.map((x) => [x.title, x.url]), [["A page", "https://example.com/a"]])
    assert.deepEqual(back.rootChildIds, ["u1"])
    assert.equal(back.nodes.u1.activeChildId, "a1")
  })
})

describe("checking a chat request", () => {
  const msg = (id: string, parentId: string | null, role: "user" | "assistant" = "user") => ({ id, parentId, role, content: `${role} ${id}`, createdAt: 1, childIds: [], activeChildId: null })
  const request = (over: Record<string, unknown> = {}) => ({ assistantId: "a2", model: "cyphor-auto", thread: [msg("u1", null)], ...over })
  const ok = (input: unknown) => {
    const r = checkChatRequest(input)
    assert.equal(r.ok, true, r.ok ? "" : r.error)
    return r.ok ? r.value : (undefined as never)
  }

  test("fills in the router settings when they are missing", () => {
    const v = ok(request())
    assert.deepEqual([v.web, v.priority, v.disabledProviders, v.godMax, v.thinking, v.noAccess], ["off", "balanced", [], 4, false, false])
    assert.equal(v.chatId, null)
  })

  test("accepts the router settings and cleans them", () => {
    const v = ok(request({ web: "research", priority: "free", disabledProviders: ["groq", "../x", 5, "UPPER", "mistral"], godMax: 5.4, noAccess: true }))
    assert.deepEqual([v.web, v.priority, v.godMax, v.noAccess], ["research", "free", 5, true])
    assert.deepEqual(v.disabledProviders, ["groq", "mistral"])
  })

  test("falls back instead of failing on settings it does not know", () => {
    const v = ok(request({ web: "everywhere", priority: "cheapest", godMax: "many", disabledProviders: "groq" }))
    assert.deepEqual([v.web, v.priority, v.godMax, v.disabledProviders], ["off", "balanced", 4, []])
  })

  test("keeps the panel size between two and six, and the other numbers in range", () => {
    assert.equal(ok(request({ godMax: 1 })).godMax, 2)
    assert.equal(ok(request({ godMax: 99 })).godMax, 6)
    assert.equal(ok(request({ temperature: 9, maxTokens: 10_000_000 })).temperature, 2)
    assert.equal(ok(request({ maxTokens: 10_000_000 })).maxTokens, 128_000)
    assert.equal(ok(request({ maxTokens: 0 })).maxTokens, 1)
  })

  test("accepts a model name with a provider in it, and cuts one that is far too long", () => {
    assert.equal(ok(request({ model: "groq:llama-3.3-70b-versatile" })).model, "groq:llama-3.3-70b-versatile")
    assert.equal(ok(request({ model: "m".repeat(400) })).model.length, 160)
  })

  test("refuses a thread that is not one conversation", () => {
    const refused = (over: Record<string, unknown>) => assert.equal(checkChatRequest(request(over)).ok, false)
    refused({ thread: [] })
    refused({ thread: "no" })
    refused({ thread: [msg("a1", null, "assistant")] })
    refused({ thread: [msg("u1", null), msg("u2", "someone-else")] })
    refused({ assistantId: "bad id!" })
    refused({ model: "  " })
    refused({ chatId: "../x" })
  })
})

/* ---------------------------------------------------------------- */
/* The database                                                      */
/* ---------------------------------------------------------------- */

describe("the database", () => {
  const dirs: string[] = []
  const tempDb = () => {
    const dir = mkdtempSync(join(tmpdir(), "cyphor-db-"))
    dirs.push(dir)
    return `file:${join(dir, "test.db")}`
  }
  afterEach(() => {
    if (process.platform === "win32") return
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  test("the tables made on first use have exactly the columns the code expects", async () => {
    const { client } = await openDatabase("file::memory:")
    for (const table of [schema.conversations, schema.messages]) {
      const cfg = getTableConfig(table)
      const info = await client.execute(`PRAGMA table_info(${cfg.name})`)
      const actual = info.rows.map((r) => ({ name: String(r.name), notNull: Number(r.notnull) === 1 || Number(r.pk) > 0 }))
      const expected = cfg.columns.map((c) => ({ name: c.name, notNull: c.notNull }))
      assert.deepEqual(actual.map((c) => c.name).sort(), expected.map((c) => c.name).sort(), `${cfg.name}: same columns`)
      for (const col of expected) assert.equal(actual.find((c) => c.name === col.name)!.notNull, col.notNull, `${cfg.name}.${col.name}: same NOT NULL`)
    }
    client.close()
  })

  test("opens a database made before replies kept their route, and adds the column without losing a row", async () => {
    const url = tempDb()
    const old = createClient({ url })
    try {
      await old.batch(
        BOOTSTRAP_SQL.map((sql) => sql.replace("    meta TEXT,\n", "")),
        "write"
      )
      assert.ok(!(await old.execute("PRAGMA table_info(messages)")).rows.some((r) => r.name === "meta"), "the old table has no meta column")
      await old.execute("INSERT INTO conversations (id, owner_id, title, model, created_at, updated_at) VALUES ('c1','o1','Old chat','m',1,2)")
      await old.execute("INSERT INTO messages (conversation_id, id, role, content, created_at) VALUES ('c1','m1','user','still here',1)")
    } finally {
      old.close()
    }

    const { db, client } = await openDatabase(url)
    try {
      assert.ok((await client.execute("PRAGMA table_info(messages)")).rows.some((r) => r.name === "meta"), "the column was added")
      const rows = await db.select().from(schema.messages)
      assert.equal(rows.length, 1)
      assert.equal(rows[0].content, "still here")
      assert.equal(rows[0].meta, null)
    } finally {
      client.close()
    }
  })

  test("saves a reply with its route and brings it back through the same code the API uses", async () => {
    const { db, client } = await openDatabase("file::memory:")
    const user: Message = { id: "u1", parentId: null, role: "user", content: "Hi", createdAt: 1, childIds: ["a1"], activeChildId: "a1" }
    const reply: Message = { id: "a1", parentId: "u1", role: "assistant", content: "Hello", createdAt: 2, childIds: [], activeChildId: null, status: "done", route: route as Message["route"], sources: [{ title: "P", url: "https://example.com" }] }
    const chat: Chat = { id: "c1", title: "T", createdAt: 1, updatedAt: 2, starred: true, projectId: null, model: "cyphor-auto", nodes: { u1: user, a1: reply }, rootChildIds: ["u1"], rootActiveId: "u1" }

    const { conversation, messages } = chatToRows("owner-1", chat)
    await db.insert(schema.conversations).values(conversation)
    await db.insert(schema.messages).values(messages)

    const saved = await db.select().from(schema.conversations).where(eq(schema.conversations.id, "c1"))
    const rows = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, "c1"))
    const back = rowsToChat(saved[0], rows)
    assert.equal(back.starred, true)
    assert.equal(back.nodes.a1.route?.model, "llama-3.3-70b-versatile")
    assert.deepEqual(back.nodes.a1.sources?.map((x) => [x.title, x.url]), [["P", "https://example.com"]])

    // Deleting a conversation takes its messages with it.
    await db.delete(schema.conversations).where(eq(schema.conversations.id, "c1"))
    assert.equal((await db.select().from(schema.messages)).length, 0)
    client.close()
  })
})
