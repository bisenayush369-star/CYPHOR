/**
 * The router against fake providers: which models are found, which one answers, what happens when one
 * fails, and what God Mode does when its panel is only partly there. No real key or network is used.
 */
import assert from "node:assert/strict"
import { after, before, beforeEach, describe, test } from "node:test"
import type { WireMessage } from "../../lib/chat-messages.ts"
import { ProviderError } from "../../lib/openai.ts"
import type { Env } from "../../lib/router/env.ts"
import { providerRest, resetHealth } from "../../lib/router/health.ts"
import { catalogResponse, clearCatalog, planRoute, prepare, runGod, runPlan, testProvider, type GodEvent, type RouterContext, type RouterEvent } from "../../lib/router/index.ts"
import { anthropicStream, modelList, openAiStream, sendJson, startFake, type FakeServer } from "./helpers/fake-provider.ts"

/** Obviously made-up keys. The tests check that none of them ever comes back out. */
const KEYS = { groq: "test-groq-0001-not-a-real-key", mistral: "test-mistral-0002-not-a-real-key", anthropic: "test-anthropic-0003-not-a-real-key" } as const
type Id = keyof typeof KEYS

let fake: FakeServer
before(async () => void (fake = await startFake()))
after(() => fake.close())

function envFor(only: Id[] = ["groq", "mistral", "anthropic"]): Env {
  const env: Env = {}
  for (const id of only) {
    env[`${id.toUpperCase()}_API_KEY`] = KEYS[id]
    env[`${id.toUpperCase()}_BASE_URL`] = id === "anthropic" ? `${fake.url}/anthropic` : `${fake.url}/${id}/v1`
  }
  return env
}

const chatPath = (id: string) => (id === "anthropic" ? "/anthropic/v1/messages" : `/${id}/v1/chat/completions`)

function standardRoutes() {
  fake.reset()
  fake.route("/groq/v1/models", (_q, res) => sendJson(res, 200, modelList("llama-3.3-70b-versatile", "llama-3.1-8b-instant", "whisper-large-v3")))
  fake.route("/mistral/v1/models", (_q, res) => sendJson(res, 200, modelList("mistral-large-latest", "mistral-small-latest", "mistral-embed")))
  fake.route("/anthropic/v1/models", (_q, res) =>
    sendJson(res, 200, { data: [{ id: "claude-sonnet-4-5", display_name: "Claude Sonnet 4.5" }, { id: "claude-haiku-4-5", display_name: "Claude Haiku 4.5" }], has_more: false })
  )
  fake.route(chatPath("groq"), (_q, res) => openAiStream(res, ["groq says ", "hello"]))
  fake.route(chatPath("mistral"), (_q, res) => openAiStream(res, ["mistral says ", "hello"]))
  fake.route(chatPath("anthropic"), (_q, res) => anthropicStream(res, ["anthropic says ", "hello"]))
}

/** A draft or the merged answer, depending on whether the request carries drafts. */
function godRoutes(ids: Id[] = ["groq", "mistral", "anthropic"]) {
  for (const id of ids) {
    const stream = id === "anthropic" ? anthropicStream : openAiStream
    fake.route(chatPath(id), (q, res) => stream(res, q.raw.includes("<drafts>") ? ["FINAL ", "ANSWER"] : [`draft from ${id}`]))
  }
}

beforeEach(() => {
  clearCatalog()
  resetHealth()
  standardRoutes()
})

async function collect<T>(gen: AsyncGenerator<T>) {
  const out: T[] = []
  for await (const e of gen) out.push(e)
  return out
}
const textOf = (events: (RouterEvent | GodEvent)[]) => events.map((e) => (e.type === "text" ? e.text : "")).join("")
const routesOf = (events: (RouterEvent | GodEvent)[]) => events.flatMap((e) => (e.type === "route" ? [e.route] : []))
const councilsOf = (events: GodEvent[]) => events.flatMap((e) => (e.type === "council" ? [e.council] : []))

const WIRE: WireMessage[] = [{ role: "user", content: "Say hello" }]
/** No retries inside one provider: these tests are about moving on to the next one. */
const base = { wire: WIRE, temperature: 0.2, maxTokens: 256, thinking: false, retry: { retries: 0 } }

function planFor(ctx: RouterContext, model = "cyphor-auto", prompt = "Say hello") {
  return planRoute({ model, prompt, hasImages: false, estTokens: 10, priority: "balanced", targets: ctx.targets, providers: ctx.providers })
}

describe("the model catalog", () => {
  test("lists the chat models of every connected provider and leaves out the rest", async () => {
    const ctx = await prepare({ env: envFor() })
    assert.equal(ctx.configured, true)
    const keys = ctx.snapshot.models.map((m) => m.key)
    for (const k of ["groq:llama-3.3-70b-versatile", "groq:llama-3.1-8b-instant", "mistral:mistral-large-latest", "anthropic:claude-sonnet-4-5", "anthropic:claude-haiku-4-5"]) assert.ok(keys.includes(k), `${k} is listed`)
    assert.ok(!keys.some((k) => /embed|whisper/.test(k)), "embedding and speech models are not chat models")
    const connected = ctx.snapshot.statuses.filter((s) => s.configured)
    assert.deepEqual(connected.map((s) => s.id).sort(), ["anthropic", "groq", "mistral"])
    for (const s of connected) assert.equal(s.ok, true, `${s.id} answered`)
  })

  test("rates bigger and newer models higher, and says so with a tier", async () => {
    const ctx = await prepare({ env: envFor() })
    const by = (key: string) => ctx.snapshot.models.find((m) => m.key === key)!
    const big = by("groq:llama-3.3-70b-versatile")
    const small = by("groq:llama-3.1-8b-instant")
    assert.ok(big.scores.reasoning > small.scores.reasoning)
    assert.ok(small.scores.speed > big.scores.speed, "the small model is the faster one")
    assert.equal(by("anthropic:claude-sonnet-4-5").tier, "flagship")
    assert.notEqual(by("anthropic:claude-haiku-4-5").tier, "flagship")
  })

  test("sends the key the way each provider wants it", async () => {
    await prepare({ env: envFor() })
    const seen = (path: string) => fake.seen.find((s) => s.path === path)!
    assert.equal(seen("/groq/v1/models").headers.authorization, `Bearer ${KEYS.groq}`)
    assert.equal(seen("/anthropic/v1/models").headers["x-api-key"], KEYS.anthropic)
    assert.equal(seen("/anthropic/v1/models").headers["anthropic-version"], "2023-06-01")
  })

  test("names the variable that holds a key, and never the key", async () => {
    const body = JSON.stringify(await catalogResponse({ env: envFor() }))
    for (const key of Object.values(KEYS)) assert.ok(!body.includes(key), "no key in the catalog")
    for (const name of ["GROQ_API_KEY", "MISTRAL_API_KEY", "ANTHROPIC_API_KEY", "TINYFISH_API_KEY"]) assert.ok(body.includes(name), `${name} is named`)
  })

  test("hides a key that a provider repeats in its error message", async () => {
    fake.route("/groq/v1/models", (_q, res) => sendJson(res, 401, { error: { message: `Incorrect API key provided: ${KEYS.groq}.` } }))
    const r = await catalogResponse({ env: envFor(["groq"]) })
    const groq = r.providers.find((p) => p.id === "groq")!
    assert.equal(groq.ok, false)
    assert.ok(groq.error)
    assert.ok(!JSON.stringify(r).includes(KEYS.groq))
  })

  test("says it is in demo mode when no provider has a key", async () => {
    const r = await catalogResponse({ env: {} })
    assert.equal(r.mode, "demo")
    assert.equal(r.godReady, false)
    assert.deepEqual(r.models, [])
    assert.ok(Object.values(r.virtual).every((v) => v === null))
    assert.equal(r.web.configured, false)
  })

  test("leaves out a provider that was switched off, so Now: matches what a message would use", async () => {
    const all = await catalogResponse({ env: envFor() })
    assert.equal(all.godReady, true)
    const off = await catalogResponse({ env: envFor(), disabled: ["anthropic"] })
    for (const pick of Object.values(off.virtual)) if (pick) assert.notEqual(pick.provider, "anthropic")
    assert.equal(off.godReady, true, "two providers are still on")
    const one = await catalogResponse({ env: envFor(), disabled: ["anthropic", "mistral"] })
    assert.equal(one.godReady, false, "God Mode needs two providers")
  })

  test("works with a server of your own and no key", async () => {
    fake.route("/custom/v1/chat/completions", (_q, res) => openAiStream(res, ["local ", "reply"]))
    const env = { LLM_BASE_URL: `${fake.url}/custom/v1`, LLM_MODELS: "my-local-model" }
    const ctx = await prepare({ env })
    assert.ok(ctx.targets.some((t) => t.profile.key === "custom:my-local-model"))
    const events = await collect(runPlan(planFor(ctx), { ...base, env }))
    assert.equal(textOf(events), "local reply")
    assert.equal(fake.seen.find((s) => s.path === "/custom/v1/chat/completions")!.headers.authorization, undefined, "no key, no Authorization header")
  })
})

describe("routing a message", () => {
  test("streams the answer of the chosen model, after a route event that says who it is", async () => {
    const env = envFor(["groq"])
    const ctx = await prepare({ env })
    const events = await collect(runPlan(planFor(ctx), { ...base, env }))
    assert.equal(events[0].type, "route")
    const route = routesOf(events)[0]
    assert.equal(route.provider, "groq")
    assert.equal(route.mode, "auto")
    assert.ok(route.reason.length > 0)
    assert.equal(textOf(events), "groq says hello")
  })

  test("uses the field name each provider expects for the length limit", async () => {
    const env = envFor(["groq", "mistral"])
    const ctx = await prepare({ env })
    await collect(runPlan(planFor(ctx, "groq:llama-3.3-70b-versatile"), { ...base, env }))
    await collect(runPlan(planFor(ctx, "mistral:mistral-large-latest"), { ...base, env }))
    const groq = fake.seen.find((s) => s.path === chatPath("groq"))!.json
    const mistral = fake.seen.find((s) => s.path === chatPath("mistral"))!.json
    assert.equal(groq.max_completion_tokens, 256)
    assert.equal(groq.max_tokens, undefined)
    assert.equal(mistral.max_tokens, 256)
    assert.equal(groq.stream, true)
  })

  test("talks to Anthropic in its own format, with the system prompt on top", async () => {
    const env = envFor(["anthropic"])
    const ctx = await prepare({ env })
    const wire: WireMessage[] = [
      { role: "system", content: "Be brief." },
      { role: "user", content: "Say hello" },
    ]
    const events = await collect(runPlan(planFor(ctx, "cyphor-core"), { ...base, wire, env }))
    assert.equal(textOf(events), "anthropic says hello")
    const req = fake.seen.find((s) => s.path === chatPath("anthropic"))!
    assert.equal(req.headers["x-api-key"], KEYS.anthropic)
    assert.equal(req.json.system, "Be brief.")
    assert.ok(req.json.messages.every((m: { role: string }) => m.role === "user" || m.role === "assistant"))
    assert.equal(req.json.stream, true)
  })

  test("moves to the next provider when the first fails before saying anything", async () => {
    const env = envFor(["groq", "mistral"])
    const ctx = await prepare({ env })
    const plan = planFor(ctx)
    const first = plan.candidates[0].target.provider.def.id
    const next = plan.candidates.find((c) => c.target.provider.def.id !== first)!.target.provider.def.id
    fake.route(chatPath(first), (_q, res) => sendJson(res, 500, { error: { message: "boom" } }))

    const events = await collect(runPlan(plan, { ...base, env }))
    const routes = routesOf(events)
    assert.equal(routes[0].provider, first)
    assert.equal(routes[0].mode, "auto")
    const last = routes.at(-1)!
    assert.equal(last.provider, next)
    assert.equal(last.mode, "fallback")
    assert.match(last.reason, /having trouble|could not answer/)
    assert.equal(textOf(events), `${next} says hello`)
  })

  test("does not switch models once words have reached the person", async () => {
    const env = envFor(["groq", "mistral"])
    const ctx = await prepare({ env })
    const plan = planFor(ctx)
    const first = plan.candidates[0].target.provider.def.id
    const next = plan.candidates.find((c) => c.target.provider.def.id !== first)!.target.provider.def.id
    fake.route(chatPath(first), (_q, res) => openAiStream(res, ["partial "], { cut: true }))

    const got: string[] = []
    await assert.rejects(async () => {
      for await (const e of runPlan(plan, { ...base, env })) if (e.type === "text") got.push(e.text)
    })
    assert.equal(got.join(""), "partial ")
    assert.equal(fake.count(chatPath(next), "POST"), 0, "the second provider was never asked")
  })

  test("a model you pick by name never falls back to another", async () => {
    const env = envFor(["groq", "mistral"])
    const ctx = await prepare({ env })
    fake.route(chatPath("groq"), (_q, res) => sendJson(res, 500, { error: { message: "boom" } }))
    const events: RouterEvent[] = []
    await assert.rejects(
      async () => {
        for await (const e of runPlan(planFor(ctx, "groq:llama-3.3-70b-versatile"), { ...base, env })) events.push(e)
      },
      (e: unknown) => e instanceof ProviderError
    )
    assert.equal(routesOf(events)[0].mode, "direct")
    assert.equal(fake.count(chatPath("mistral"), "POST"), 0)
  })

  test("a model you type that the provider did not list still works", async () => {
    const env = envFor(["groq"])
    const ctx = await prepare({ env })
    const events = await collect(runPlan(planFor(ctx, "groq:some-brand-new-model"), { ...base, env }))
    assert.equal(textOf(events), "groq says hello")
    assert.equal(fake.seen.find((s) => s.path === chatPath("groq"))!.json.model, "some-brand-new-model")
  })

  test("refuses a model whose provider is not connected", () => {
    assert.throws(
      () => planRoute({ model: "cohere:command-a", prompt: "hi", hasImages: false, estTokens: 1, priority: "balanced", targets: [], providers: [] }),
      (e: unknown) => e instanceof ProviderError && e.status === 404
    )
  })

  test("gives up on a slow first word and tries the next provider", async () => {
    const env = envFor(["groq", "mistral"])
    const ctx = await prepare({ env })
    const plan = planFor(ctx)
    const first = plan.candidates[0].target.provider.def.id
    fake.route(chatPath(first), (_q, res) => openAiStream(res, ["too late"], { startDelayMs: 1500 }))

    const t0 = Date.now()
    const events = await collect(runPlan(plan, { ...base, env, firstByteMs: 150 }))
    assert.ok(Date.now() - t0 < 1200, "did not wait for the slow provider")
    assert.equal(routesOf(events).at(-1)!.mode, "fallback")
    assert.ok(!textOf(events).includes("too late"))
    assert.equal(providerRest(first), 0, "one slow answer is noise")

    // Two in a row is not: the provider rests, and the next message does not wait for it.
    await collect(runPlan(plan, { ...base, env, firstByteMs: 150 }))
    assert.ok(providerRest(first) > 0, "two slow answers in a row rest the provider")
  })

  test("rests a provider whose key is rejected, so the next message skips it", async () => {
    const env = envFor(["groq", "mistral"])
    const ctx = await prepare({ env })
    const plan = planFor(ctx)
    const first = plan.candidates[0].target.provider.def.id
    fake.route(chatPath(first), (_q, res) => sendJson(res, 401, { error: { message: "bad key" } }))
    await collect(runPlan(plan, { ...base, env }))
    assert.ok(providerRest(first) > 60_000, "a rejected key rests for minutes, not seconds")

    const again = await prepare({ env })
    assert.ok(!again.targets.some((t) => t.profile.provider === first), "the resting provider is not offered")
  })

  test("reports how long to wait when every provider is rate limited", async () => {
    const env = envFor(["groq", "mistral"])
    const ctx = await prepare({ env })
    for (const id of ["groq", "mistral"]) fake.route(chatPath(id), (_q, res) => sendJson(res, 429, { error: { message: "slow down" } }, { "Retry-After": "7" }))
    await assert.rejects(
      collect(runPlan(planFor(ctx), { ...base, env })),
      (e: unknown) => e instanceof ProviderError && e.status === 429 && e.retryAfterSec === 7 && /No connected model could answer/.test(e.message)
    )
  })

  test("stops when the person stops it, without trying another provider", async () => {
    const env = envFor(["groq", "mistral"])
    const ctx = await prepare({ env })
    const plan = planFor(ctx)
    const first = plan.candidates[0].target.provider.def.id
    const next = plan.candidates.find((c) => c.target.provider.def.id !== first)!.target.provider.def.id
    fake.route(chatPath(first), (_q, res) => openAiStream(res, ["a", "b", "c", "d", "e"], { delayMs: 80 }))
    const ac = new AbortController()
    const got: string[] = []
    await assert.rejects(async () => {
      for await (const e of runPlan(plan, { ...base, env, signal: ac.signal })) {
        if (e.type === "text") {
          got.push(e.text)
          ac.abort()
        }
      }
    })
    assert.ok(got.length >= 1 && got.length < 5)
    assert.equal(fake.count(chatPath(next), "POST"), 0)
  })
})

describe("God Mode", () => {
  const god = (ctx: RouterContext, env: Env, over: Record<string, unknown> = {}) => ({
    ...base,
    env,
    targets: ctx.targets,
    prompt: "Compare the trade-offs of two designs",
    max: 4,
    draftMs: 5000,
    graceMs: 1000,
    firstByteMs: 3000,
    fallback: async function* (): AsyncGenerator<RouterEvent> {
      yield { type: "text", text: "NORMAL ROUTE" }
    },
    ...over,
  })
  const chatRequests = () => fake.seen.filter((s) => s.method === "POST")
  const mergeRequests = () => chatRequests().filter((s) => s.raw.includes("<drafts>"))

  test("three providers draft, and one of them merges the anonymous drafts", async () => {
    godRoutes()
    const env = envFor()
    const ctx = await prepare({ env })
    const events: GodEvent[] = await collect(runGod(god(ctx, env)))

    const last = councilsOf(events).at(-1)!
    assert.equal(last.phase, "done")
    assert.deepEqual(last.members.map((m) => m.status), ["done", "done", "done"])
    assert.ok(last.chair)
    assert.equal(textOf(events), "FINAL ANSWER")
    assert.equal(routesOf(events).at(-1)!.mode, "council")

    const merge = mergeRequests()
    assert.equal(merge.length, 1, "one merge request")
    for (const id of ["groq", "mistral", "anthropic"]) assert.ok(merge[0].raw.includes(`draft from ${id}`), `draft of ${id} was passed on`)
    assert.ok(merge[0].raw.includes('<draft n=\\"3\\">'), "drafts are numbered, not named")

    const drafts = chatRequests().filter((s) => !s.raw.includes("<drafts>"))
    assert.equal(drafts.length, 3)
    for (const d of drafts) assert.ok((d.json.max_completion_tokens ?? d.json.max_tokens) <= 1800, "drafts are kept short")
  })

  test("goes on with two drafts when one provider fails, and never shows its key", async () => {
    godRoutes()
    fake.route(chatPath("mistral"), (_q, res) => sendJson(res, 401, { error: { message: `Incorrect API key: ${KEYS.mistral}` } }))
    const env = envFor()
    const ctx = await prepare({ env })
    const events: GodEvent[] = await collect(runGod(god(ctx, env)))

    const last = councilsOf(events).at(-1)!
    const status = Object.fromEntries(last.members.map((m) => [m.provider, m.status]))
    assert.equal(status.mistral, "failed")
    assert.equal(status.groq, "done")
    assert.equal(status.anthropic, "done")
    assert.equal(textOf(events), "FINAL ANSWER")
    assert.ok(!JSON.stringify(events).includes(KEYS.mistral), "the key is hidden")
    assert.ok(!mergeRequests()[0].raw.includes("draft from mistral"))
  })

  test("shows the single draft as it is when only one provider answers", async () => {
    godRoutes()
    fake.route(chatPath("mistral"), (_q, res) => sendJson(res, 500, { error: { message: "down" } }))
    fake.route(chatPath("anthropic"), (_q, res) => sendJson(res, 500, { error: { message: "down" } }))
    const env = envFor()
    const ctx = await prepare({ env })
    const events: GodEvent[] = await collect(runGod(god(ctx, env)))
    assert.equal(textOf(events), "draft from groq")
    assert.equal(mergeRequests().length, 0, "nothing to merge")
  })

  test("hands the message to the normal route when nobody can draft", async () => {
    for (const id of ["groq", "mistral", "anthropic"]) fake.route(chatPath(id), (_q, res) => sendJson(res, 500, { error: { message: "down" } }))
    const env = envFor()
    const ctx = await prepare({ env })
    const events: GodEvent[] = await collect(runGod(god(ctx, env)))
    assert.equal(textOf(events), "NORMAL ROUTE")
    assert.equal(councilsOf(events).at(-1)!.phase, "fallback")
  })

  test("does not wait for a straggler once two drafts are in", async () => {
    godRoutes()
    fake.route(chatPath("groq"), (q, res) => openAiStream(res, q.raw.includes("<drafts>") ? ["FINAL ", "ANSWER"] : ["draft from groq"], { startDelayMs: q.raw.includes("<drafts>") ? 0 : 3000 }))
    const env = envFor()
    const ctx = await prepare({ env })
    const t0 = Date.now()
    const events: GodEvent[] = await collect(runGod(god(ctx, env, { graceMs: 200 })))
    assert.ok(Date.now() - t0 < 2500, "finished well before the slow draft would have")
    const last = councilsOf(events).at(-1)!
    assert.notEqual(last.members.find((m) => m.provider === "groq")!.status, "done")
    assert.equal(textOf(events), "FINAL ANSWER")
    assert.ok(!mergeRequests()[0].raw.includes("draft from groq"))
  })
})

describe("testing a provider", () => {
  test("proves a key works with one tiny message", async () => {
    const r = await testProvider("groq", { env: envFor() })
    assert.equal(r.ok, true)
    assert.ok(r.model)
    assert.ok(typeof r.latencyMs === "number")
    assert.match(r.reply ?? "", /groq says/)
  })

  test("reports a rejected key without repeating it", async () => {
    fake.route(chatPath("groq"), (_q, res) => sendJson(res, 401, { error: { message: `Incorrect API key provided: ${KEYS.groq}` } }))
    const r = await testProvider("groq", { env: envFor() })
    assert.equal(r.ok, false)
    assert.ok(r.error)
    assert.ok(!JSON.stringify(r).includes(KEYS.groq))
  })

  test("says what is missing when there is no key", async () => {
    const r = await testProvider("cohere", { env: envFor() })
    assert.equal(r.ok, false)
    assert.match(r.error ?? "", /COHERE_API_KEY/)
  })
})
