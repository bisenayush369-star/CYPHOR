/**
 * Effort: the third control in the model picker. These cover the pure rules (what each level does to routing,
 * reasoning and the system prompt) and the way a request from the browser is read.
 */
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { checkChatRequest } from "../../lib/chat-messages.ts"
import { DEFAULT_SETTINGS } from "../../lib/defaults.ts"
import { buildSystemPrompt } from "../../lib/prompt.ts"
import { DEFAULT_EFFORT, EFFORTS, effortInstruction, effortLabel, isEffort, priorityFor, thinkingFor } from "../../lib/router/effort.ts"
import type { RoutePriority } from "../../lib/router/types.ts"

describe("effort levels", () => {
  test("there are three, and medium is the default", () => {
    assert.deepEqual(EFFORTS.map((e) => e.id), ["low", "medium", "high"])
    assert.equal(DEFAULT_EFFORT, "medium")
    assert.equal(DEFAULT_SETTINGS.effort, "medium")
    assert.deepEqual(EFFORTS.map((e) => e.label), ["Low", "Medium", "High"])
  })

  test("recognises only the three names", () => {
    for (const v of ["low", "medium", "high"]) assert.equal(isEffort(v), true, v)
    for (const v of ["", "LOW", "max", null, undefined, 3, {}]) assert.equal(isEffort(v), false, String(v))
  })

  test("labels read well and fall back to Medium", () => {
    assert.equal(effortLabel("high"), "High")
    assert.equal(effortLabel("nope" as never), "Medium")
  })
})

describe("what effort does to routing", () => {
  test("moves the balanced default and nothing else", () => {
    assert.equal(priorityFor("low", "balanced"), "speed")
    assert.equal(priorityFor("medium", "balanced"), "balanced")
    assert.equal(priorityFor("high", "balanced"), "quality")
  })

  test("a priority chosen in Router settings always wins", () => {
    for (const chosen of ["speed", "quality", "free"] as RoutePriority[]) {
      for (const e of ["low", "medium", "high"] as const) assert.equal(priorityFor(e, chosen), chosen, `${e} / ${chosen}`)
    }
  })

  test("every level but low reasons first, and Cyphor Deep always does", () => {
    assert.equal(thinkingFor("high", "cyphor-auto"), true)
    assert.equal(thinkingFor("medium", "cyphor-auto"), true)
    assert.equal(thinkingFor("low", "cyphor-auto"), false)
    assert.equal(thinkingFor("low", "cyphor-deep"), true)
    assert.equal(thinkingFor("medium", "groq:llama-3.3-70b-versatile"), true)
    assert.equal(thinkingFor("low", "groq:llama-3.3-70b-versatile"), false)
  })
})

describe("what effort does to the prompt", () => {
  test("low asks for a short reply; medium and high ask for reasoning first, high more thoroughly", () => {
    assert.match(effortInstruction("low") ?? "", /short and direct/)
    assert.doesNotMatch(effortInstruction("low") ?? "", /<thinking>/)
    const medium = effortInstruction("medium") ?? ""
    const high = effortInstruction("high") ?? ""
    assert.match(medium, /<thinking>/)
    assert.match(high, /<thinking>/)
    assert.match(medium, /trivial/)
    assert.match(high, /alternatives/)
  })

  test("the system prompt carries the level, and by default the reply thinks first", () => {
    const prompt = (effort: "low" | "medium" | "high") => buildSystemPrompt({ settings: { ...DEFAULT_SETTINGS, artifacts: false, effort } })
    assert.match(prompt("medium"), /<thinking>/)
    assert.equal(prompt(DEFAULT_SETTINGS.effort), prompt("medium"))
    assert.match(prompt("low"), /short and direct/)
    assert.doesNotMatch(prompt("low"), /<thinking>/)
    assert.match(prompt("high"), /alternatives/)
  })
})

describe("effort in a request", () => {
  const msg = { id: "u1", parentId: null, role: "user", content: "hi", createdAt: 1, childIds: [], activeChildId: null }
  const read = (over: Record<string, unknown> = {}) => {
    const r = checkChatRequest({ assistantId: "a2", model: "cyphor-auto", thread: [msg], ...over })
    assert.equal(r.ok, true)
    return r.ok ? r.value : (undefined as never)
  }

  test("is medium when the browser says nothing, and carries the three names", () => {
    assert.equal(read().effort, "medium")
    for (const e of ["low", "medium", "high"] as const) assert.equal(read({ effort: e }).effort, e)
  })

  test("falls back to medium on a value it does not know instead of failing", () => {
    for (const bad of ["extreme", 2, null, {}]) assert.equal(read({ effort: bad }).effort, "medium")
  })
})
