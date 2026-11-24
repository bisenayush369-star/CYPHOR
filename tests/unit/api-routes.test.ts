/**
 * The API's front door and the conversation routes, with real sign-ins: who may call, whose conversation is whose,
 * and what is said when the database is not set up. Runs on an in-memory Postgres (PGlite) and fake secrets.
 */
import assert from "node:assert/strict"
import { after, before, describe, test } from "node:test"
import { DELETE as deleteAll, GET as list, POST as create } from "../../app/api/conversations/route.ts"
import { DELETE as deleteOne, GET as getOne, PATCH as patchOne, PUT as putOne } from "../../app/api/conversations/[id]/route.ts"
import { getDatabase } from "../../db/index.ts"
import { getAuth } from "../../lib/auth.ts"
import { guard, requireUser } from "../../lib/http.ts"
import type { Chat } from "../../lib/types.ts"

const saved: Record<string, string | undefined> = {}
const SETTINGS = {
  DATABASE_URL: "pglite://memory",
  BETTER_AUTH_SECRET: "unit-test-secret-not-a-real-secret-0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  RATE_LIMIT_API_PER_MIN: "1000",
  CYPHOR_BASIC_AUTH: undefined,
} as const

before(() => {
  for (const [k, v] of Object.entries(SETTINGS)) {
    saved[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

after(async () => {
  try {
    await (await getDatabase()).close()
  } catch {
    /* it was never opened */
  }
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

/** Signs a new person up and returns the Cookie header their browser would send. */
async function signUp(email: string, name: string) {
  const auth = await getAuth()
  const res = await auth.api.signUpEmail({ body: { name, email, password: "correct horse battery" }, asResponse: true })
  assert.equal(res.status, 200)
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
}

const call = (cookie: string | null, method = "GET", body?: unknown) =>
  new Request("http://localhost:3000/api/conversations", {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const withId = (id: string) => ({ params: Promise.resolve({ id }) })
const errorOf = async (res: Response) => ((await res.json()) as { error: { code: string; message: string } }).error

const chatNamed = (id: string, title: string): Chat => ({
  id,
  title,
  createdAt: 1,
  updatedAt: 2,
  starred: false,
  projectId: null,
  model: "cyphor-auto",
  nodes: { u1: { id: "u1", parentId: null, role: "user", content: `hello from ${title}`, createdAt: 1, childIds: [], activeChildId: null } },
  rootChildIds: ["u1"],
  rootActiveId: "u1",
})

describe("the front door", () => {
  test("turns away a caller who is not signed in, with an error the page can show", async () => {
    const res = await requireUser(call(null))
    assert.equal(res.ok, false)
    if (res.ok) return
    assert.equal(res.response.status, 401)
    assert.deepEqual(await errorOf(res.response), { code: "unauthorized", message: "Sign in to continue." })
  })

  test("turns away a made-up cookie", async () => {
    const res = await requireUser(call("cyphor.session_token=forged.value"))
    assert.equal(res.ok, false)
  })

  test("lets a signed-in caller through, as that person", async () => {
    const cookie = await signUp("ada@example.com", "Ada")
    const res = await requireUser(call(cookie))
    assert.equal(res.ok, true)
    if (!res.ok) return
    assert.equal(res.user.email, "ada@example.com")
    assert.equal(res.user.name, "Ada")
  })

  test("guard counts each person's calls on their own", async () => {
    // The "god" allowance has its own counters, so lowering it here leaves the conversation tests below alone.
    process.env.RATE_LIMIT_GOD_PER_MIN = "2"
    try {
      const a = await signUp("rate-a@example.com", "A")
      const b = await signUp("rate-b@example.com", "B")
      const ask = async (cookie: string) => guard(call(cookie), "god", 6, "RATE_LIMIT_GOD_PER_MIN")
      assert.equal((await ask(a)).ok, true)
      assert.equal((await ask(a)).ok, true)
      const third = await ask(a)
      assert.equal(third.ok, false)
      if (!third.ok) {
        assert.equal(third.response.status, 429)
        assert.equal((await errorOf(third.response)).code, "rate_limited")
        assert.ok(third.response.headers.get("retry-after"))
      }
      assert.equal((await ask(b)).ok, true, "the other person is not slowed down")
    } finally {
      delete process.env.RATE_LIMIT_GOD_PER_MIN
    }
  })
})

describe("conversations belong to whoever made them", () => {
  let ada = ""
  let lin = ""
  before(async () => {
    ada = await signUp("ada-chats@example.com", "Ada")
    lin = await signUp("lin-chats@example.com", "Lin")
  })

  test("every route says 401 to a visitor", async () => {
    assert.equal((await list(call(null))).status, 401)
    assert.equal((await create(call(null, "POST", {}))).status, 401)
    assert.equal((await deleteAll(call(null, "DELETE"))).status, 401)
    assert.equal((await getOne(call(null), withId("c1"))).status, 401)
    assert.equal((await putOne(call(null, "PUT", { chat: chatNamed("c1", "x") }), withId("c1"))).status, 401)
    assert.equal((await patchOne(call(null, "PATCH", { title: "x" }), withId("c1"))).status, 401)
    assert.equal((await deleteOne(call(null, "DELETE"), withId("c1"))).status, 401)
  })

  test("a saved conversation comes back to its owner and to nobody else", async () => {
    const put = await putOne(call(ada, "PUT", { chat: chatNamed("c_ada", "Ada's chat") }), withId("c_ada"))
    assert.equal(put.status, 200)

    const mine = (await (await list(call(ada))).json()) as { conversations: { id: string; title: string }[] }
    assert.deepEqual(
      mine.conversations.map((c) => [c.id, c.title]),
      [["c_ada", "Ada's chat"]]
    )
    const theirs = (await (await list(call(lin))).json()) as { conversations: unknown[] }
    assert.deepEqual(theirs.conversations, [], "Lin sees none of Ada's chats")

    assert.equal((await getOne(call(ada), withId("c_ada"))).status, 200)
    assert.equal((await getOne(call(lin), withId("c_ada"))).status, 404, "reported as missing, not as forbidden")
  })

  test("nobody can change or delete a conversation that is not theirs, even by guessing its id", async () => {
    const overwrite = await putOne(call(lin, "PUT", { chat: chatNamed("c_ada", "Lin was here") }), withId("c_ada"))
    assert.equal(overwrite.status, 404)
    assert.equal((await patchOne(call(lin, "PATCH", { title: "Lin was here" }), withId("c_ada"))).status, 404)
    assert.equal((await deleteOne(call(lin, "DELETE"), withId("c_ada"))).status, 404)
    assert.equal((await create(call(lin, "POST", { id: "c_ada" }))).status, 409, "an id that is taken is taken")

    const still = (await (await getOne(call(ada), withId("c_ada"))).json()) as { chat: Chat }
    assert.equal(still.chat.title, "Ada's chat", "the title is unchanged")
    assert.equal(still.chat.nodes.u1.content, "hello from Ada's chat", "and so are the messages")
  })

  test("the owner can rename, star and replace their conversation", async () => {
    assert.equal((await patchOne(call(ada, "PATCH", { title: "Renamed", starred: true }), withId("c_ada"))).status, 200)
    const renamed = (await (await getOne(call(ada), withId("c_ada"))).json()) as { chat: Chat }
    assert.equal(renamed.chat.title, "Renamed")
    assert.equal(renamed.chat.starred, true)

    const again = chatNamed("c_ada", "Replaced")
    again.nodes.u2 = { id: "u2", parentId: "u1", role: "user", content: "a second message", createdAt: 3, childIds: [], activeChildId: null }
    assert.equal((await putOne(call(ada, "PUT", { chat: again }), withId("c_ada"))).status, 200)
    const replaced = (await (await getOne(call(ada), withId("c_ada"))).json()) as { chat: Chat }
    assert.equal(replaced.chat.title, "Replaced")
    assert.deepEqual(Object.keys(replaced.chat.nodes).sort(), ["u1", "u2"])
  })

  test("creating an empty conversation makes one for the caller", async () => {
    const res = await create(call(lin, "POST", { title: "Lin's own" }))
    assert.equal(res.status, 201)
    const made = (await res.json()) as { conversation: { id: string; title: string } }
    assert.equal(made.conversation.title, "Lin's own")
    assert.equal((await getOne(call(lin), withId(made.conversation.id))).status, 200)
    assert.equal((await getOne(call(ada), withId(made.conversation.id))).status, 404)
  })

  test("deleting all removes only the caller's conversations", async () => {
    await putOne(call(lin, "PUT", { chat: chatNamed("c_lin2", "Lin two") }), withId("c_lin2"))
    const removed = (await (await deleteAll(call(lin, "DELETE"))).json()) as { deleted: number }
    assert.ok(removed.deleted >= 2)
    assert.deepEqual(((await (await list(call(lin))).json()) as { conversations: unknown[] }).conversations, [])
    assert.equal(((await (await list(call(ada))).json()) as { conversations: unknown[] }).conversations.length, 1, "Ada's chat is still there")
  })

  test("deleting one removes it and its messages", async () => {
    assert.equal((await deleteOne(call(ada, "DELETE"), withId("c_ada"))).status, 200)
    assert.equal((await getOne(call(ada), withId("c_ada"))).status, 404)
  })
})

describe("when the key that signs sessions is not set", () => {
  test("a production server says which setting is missing instead of blaming the database", async () => {
    const holder = globalThis as typeof globalThis & { __cyphorAuth?: unknown }
    const env = process.env as Record<string, string | undefined>
    const keep = { auth: holder.__cyphorAuth, node: env.NODE_ENV, secret: env.BETTER_AUTH_SECRET, other: env.AUTH_SECRET }
    holder.__cyphorAuth = undefined
    env.NODE_ENV = "production"
    delete env.BETTER_AUTH_SECRET
    delete env.AUTH_SECRET
    try {
      const res = await requireUser(call("cyphor.session_token=whatever"))
      assert.equal(res.ok, false)
      if (res.ok) return
      assert.equal(res.response.status, 503)
      const error = await errorOf(res.response)
      assert.equal(error.code, "auth_not_configured")
      assert.match(error.message, /BETTER_AUTH_SECRET is not set/)
      assert.doesNotMatch(error.message, /database/i)
    } finally {
      holder.__cyphorAuth = keep.auth
      if (keep.node === undefined) delete env.NODE_ENV
      else env.NODE_ENV = keep.node
      if (keep.secret === undefined) delete env.BETTER_AUTH_SECRET
      else env.BETTER_AUTH_SECRET = keep.secret
      if (keep.other === undefined) delete env.AUTH_SECRET
      else env.AUTH_SECRET = keep.other
    }
  })
})

describe("when the database is not set up", () => {
  test("says so plainly instead of failing", async () => {
    const holder = globalThis as typeof globalThis & { __cyphorDb?: unknown; __cyphorAuth?: unknown }
    const keep = { db: holder.__cyphorDb, auth: holder.__cyphorAuth, url: process.env.DATABASE_URL }
    holder.__cyphorDb = undefined
    holder.__cyphorAuth = undefined
    delete process.env.DATABASE_URL
    try {
      const res = await requireUser(call("cyphor.session_token=whatever"))
      assert.equal(res.ok, false)
      if (res.ok) return
      assert.equal(res.response.status, 503)
      const error = await errorOf(res.response)
      assert.equal(error.code, "db_not_configured")
      assert.match(error.message, /DATABASE_URL/)
    } finally {
      holder.__cyphorDb = keep.db
      holder.__cyphorAuth = keep.auth
      process.env.DATABASE_URL = keep.url
    }
  })
})
