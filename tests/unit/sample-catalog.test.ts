/**
 * The sample the single-file preview shows. It is made by the real router code from each provider's starter
 * model list, and it must never look as if something were really connected or checked. No key is involved.
 */
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { quality } from "../../lib/router/profiles.ts"
import type { CouncilInfo, RouteInfo } from "../../lib/router/types.ts"
import { playSampleRouting, sampleCatalog } from "../../lib/sample-catalog.ts"
import type { Message } from "../../lib/types.ts"

const CYPHOR_NAMES = ["cyphor-auto", "cyphor-swift", "cyphor-core", "cyphor-deep", "cyphor-code", "cyphor-god"]

/** Plays one turn quickly and keeps what the screen would have been told. */
async function run(model: string, prompt: string, extra: { disabled?: string[]; godMax?: number } = {}) {
  const patches: Partial<Message>[] = []
  const finish = await playSampleRouting({
    model,
    prompt,
    priority: "balanced",
    disabled: extra.disabled ?? [],
    godMax: extra.godMax ?? 4,
    speed: 50,
    signal: new AbortController().signal,
    onMeta: (p) => void patches.push(p),
  })
  return { patches, finish }
}

const routes = (patches: Partial<Message>[]) => patches.flatMap((p) => (p.route ? [p.route as RouteInfo] : []))
const councils = (patches: Partial<Message>[]) => patches.flatMap((p) => (p.council ? [p.council as CouncilInfo] : []))

describe("the sample catalog", () => {
  test("lists four providers as examples, never as checked, working or tested", () => {
    const c = sampleCatalog()
    assert.equal(c.mode, "router")
    const connected = c.providers.filter((p) => p.configured)
    assert.deepEqual(connected.map((p) => p.id).sort(), ["anthropic", "gemini", "groq", "mistral"])
    for (const p of connected) {
      assert.equal(p.sample, true, p.id)
      assert.equal(p.ok, null, `${p.id} has not been checked`)
      assert.equal(p.latencyMs, undefined, `${p.id} has no invented timing`)
      assert.equal(p.error, undefined)
      assert.ok(p.modelCount >= 3, `${p.id} lists its starter models`)
    }
    for (const p of c.providers.filter((x) => !x.configured)) {
      assert.equal(p.sample, false, p.id)
      assert.equal(p.modelCount, 0)
    }
    assert.equal(c.providers.length, 12, "every provider the router knows is in the list")
    assert.equal(c.web.configured, false)
  })

  test("shows only the names of variables, and nothing shaped like a key", () => {
    const c = sampleCatalog()
    for (const p of c.providers) assert.match(p.keyEnv, /^[A-Z][A-Z0-9_]+$/, p.id)
    assert.doesNotMatch(JSON.stringify(c), /sk-[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,}|gsk_[A-Za-z0-9]{10,}|Bearer /)
  })

  test("rates the models with the real rules, best first", () => {
    const { models } = sampleCatalog()
    assert.ok(models.length >= 12)
    for (const m of models) {
      for (const s of Object.values(m.scores)) assert.ok(s >= 0 && s <= 10, `${m.key} score ${s}`)
      assert.ok(m.name && m.tier, m.key)
    }
    for (let i = 1; i < models.length; i++) assert.ok(quality(models[i - 1].scores) >= quality(models[i].scores) - 1e-9, "sorted by quality")
    assert.ok(models.some((m) => m.tier === "flagship"), "at least one flagship")
    assert.ok(models.some((m) => m.tier === "mini" || m.tier === "fast"), "and at least one small, fast one")
  })

  test("gives every Cyphor name a pick marked as a sample, and God Mode a panel", () => {
    const c = sampleCatalog()
    for (const id of CYPHOR_NAMES) {
      const pick = c.virtual[id]
      assert.ok(pick, id)
      assert.ok(pick.name.endsWith("(sample)"), `${id} -> ${pick.name}`)
    }
    assert.equal(c.godReady, true)
    assert.notEqual(c.virtual["cyphor-swift"]?.key, c.virtual["cyphor-deep"]?.key, "fast and deep are not the same model")
  })

  test("takes a switched-off provider out of the picks and out of God Mode", () => {
    const one = sampleCatalog(["anthropic", "gemini", "groq"])
    assert.equal(one.godReady, false, "one provider is not a panel")
    for (const id of CYPHOR_NAMES) assert.equal(one.virtual[id]?.provider, "mistral", id)
    assert.ok(one.models.some((m) => m.provider === "anthropic"), "the library still lists it, dimmed")

    const none = sampleCatalog(["anthropic", "gemini", "groq", "mistral"])
    assert.equal(none.godReady, false)
    for (const id of CYPHOR_NAMES) assert.equal(none.virtual[id], null, id)
  })
})

describe("routing in the preview", () => {
  test("judges a coding message as code, and says it is a sample", async () => {
    const { patches, finish } = await run("cyphor-auto", "Write a TypeScript function that debounces another function and add unit tests for it")
    const [route] = routes(patches)
    assert.equal(routes(patches).length, 1)
    assert.equal(route.mode, "auto")
    assert.equal(route.task, "code")
    assert.ok(route.name.endsWith("(sample)"))
    assert.match(route.reason, /This is a sample: nothing was sent to .+, and the built-in demo model wrote the reply\./)
    finish() // nothing more to show once the reply is done
    assert.equal(patches.length, 1)
  })

  test("sends a short question to a fast model", async () => {
    const quick = routes((await run("cyphor-auto", "hi")).patches)[0]
    const code = routes((await run("cyphor-auto", "Write a TypeScript function that debounces another function and add unit tests for it")).patches)[0]
    assert.equal(quick.task, "quick")
    const speed = (r: RouteInfo) => sampleCatalog().models.find((m) => m.id === r.model && m.provider === r.provider)!.scores.speed
    assert.ok(speed(quick) >= speed(code), "the quick answer comes from a model at least as fast")
  })

  test("reports a model picked by name as chosen by you", async () => {
    const [route] = routes((await run("groq:llama-3.3-70b-versatile", "hello there")).patches)
    assert.equal(route.mode, "direct")
    assert.equal(route.provider, "groq")
    assert.equal(route.model, "llama-3.3-70b-versatile")
  })

  test("answers without a route when every provider is switched off", async () => {
    const { patches } = await run("cyphor-auto", "hello", { disabled: ["anthropic", "gemini", "groq", "mistral"] })
    assert.deepEqual(patches, [])
  })
})

describe("God Mode in the preview", () => {
  test("fills in a panel of different providers, then a chair, then folds away", async () => {
    const { patches, finish } = await run("cyphor-god", "Compare two ways of caching an API response")
    const all = councils(patches)

    const first = all[0]
    assert.equal(first.phase, "drafting")
    assert.ok(first.members.length >= 2 && first.members.length <= 4)
    assert.ok(first.members.every((m) => m.status === "pending"))
    assert.equal(new Set(first.members.map((m) => m.provider)).size, first.members.length, "one model from each provider")
    assert.match(first.note ?? "", /^Simulated in this preview\. No provider was called/)

    const answered = all.filter((c) => c.phase === "drafting").map((c) => c.members.filter((m) => m.status === "done").length)
    assert.deepEqual(answered, [...answered].sort((a, b) => a - b), "drafts only ever come in")
    assert.equal(answered[answered.length - 1], first.members.length)

    const merging = all.find((c) => c.phase === "synthesizing")
    assert.ok(merging)
    assert.ok(merging.chair?.name.endsWith("(sample)"))

    const [route] = routes(patches)
    assert.equal(route.mode, "council")
    assert.ok(route.name.endsWith("(sample)"))
    assert.match(route.reason, /^God Mode: \d of \d providers drafted, and .+ merged them\./)

    const before = councils(patches).length
    finish()
    const last = councils(patches)[before]
    assert.equal(last.phase, "done")
    assert.equal(last.chair?.name, merging.chair?.name)
  })

  test("invents no draft text and no timing", async () => {
    const { patches, finish } = await run("cyphor-god", "Compare two ways of caching an API response")
    finish()
    for (const c of councils(patches)) {
      for (const m of c.members) {
        assert.equal(m.snippet, undefined)
        assert.equal(m.ms, undefined)
        assert.equal(m.chars, undefined)
        assert.equal(m.error, undefined)
      }
    }
  })

  test("keeps to the panel size you set", async () => {
    const small = councils((await run("cyphor-god", "Compare two ways of caching an API response", { godMax: 2 })).patches)[0]
    assert.equal(small.members.length, 2)
  })

  test("falls back to the normal route, and says so, when fewer than two providers can answer", async () => {
    const { patches } = await run("cyphor-god", "Compare two ways of caching an API response", { disabled: ["anthropic", "gemini", "groq"] })
    const [council] = councils(patches)
    assert.equal(council.phase, "fallback")
    assert.match(council.note ?? "", /needs at least two connected providers/)
    const [route] = routes(patches)
    assert.equal(route.mode, "auto")
    assert.equal(route.provider, "mistral")
  })

  test("stops at once when the turn is stopped, with an AbortError", async () => {
    const stop = new AbortController()
    const turn = playSampleRouting({
      model: "cyphor-god",
      prompt: "Compare two ways of caching an API response",
      priority: "balanced",
      disabled: [],
      godMax: 4,
      speed: 1,
      signal: stop.signal,
      onMeta: () => stop.abort(),
    })
    await assert.rejects(turn, (e: unknown) => e instanceof DOMException && e.name === "AbortError")
  })
})
