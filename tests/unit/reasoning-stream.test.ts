/**
 * Thinking that comes from the provider itself. A model that reasons on its own streams the reasoning apart from the
 * answer: `reasoning_content` or `reasoning` on OpenAI-style APIs, `thinking_delta` on Anthropic's. Cyphor wraps that
 * text in <thinking> tags, so the same folding block shows it as for a model that was only asked to think in its reply.
 * No network is used: the providers are replaced by streams written in the test.
 */
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { ProviderError, openAiChat, parseOpenAiSse } from "../../lib/openai.ts"
import { parseContent } from "../../lib/parse.ts"
import { anthropicChat } from "../../lib/router/anthropic.ts"

const enc = new TextEncoder()

/** A response body that delivers `chunks` one after the other, the way a network does. */
function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]))
      else controller.close()
    },
  })
}

async function collect(gen: AsyncGenerator<string>) {
  let out = ""
  for await (const piece of gen) out += piece
  return out
}

const openAi = (delta: Record<string, unknown>) => `data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\n`
const anthropic = (event: string, data: Record<string, unknown>) => `event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`
const thinkingDelta = (thinking: string) => anthropic("content_block_delta", { index: 0, delta: { type: "thinking_delta", thinking } })
const textDelta = (text: string) => anthropic("content_block_delta", { index: 1, delta: { type: "text_delta", text } })

describe("an OpenAI-style stream", () => {
  test("reasoning_content comes out inside <thinking>, and the answer follows the closing tag", async () => {
    const out = await collect(
      parseOpenAiSse(bodyOf([openAi({ reasoning_content: "The user wants " }), openAi({ reasoning_content: "a sum." }), openAi({ content: "The answer " }), openAi({ content: "is 4." }), "data: [DONE]\n\n"]))
    )
    assert.equal(out, "<thinking>The user wants a sum.</thinking>The answer is 4.")
  })

  test("the shorter field name, reasoning, works the same way", async () => {
    const out = await collect(parseOpenAiSse(bodyOf([openAi({ reasoning: "Check the units." }), openAi({ content: "Metres." }), "data: [DONE]\n\n"])))
    assert.equal(out, "<thinking>Check the units.</thinking>Metres.")
  })

  test("a stream with no reasoning has no tags at all", async () => {
    const out = await collect(parseOpenAiSse(bodyOf([openAi({ content: "Hello" }), openAi({ content: " there" }), "data: [DONE]\n\n"])))
    assert.equal(out, "Hello there")
  })

  test("a stream that stops while still reasoning closes the tag, so the block can finish", async () => {
    const out = await collect(parseOpenAiSse(bodyOf([openAi({ reasoning_content: "Still working" }), "data: [DONE]\n\n"])))
    assert.equal(out, "<thinking>Still working</thinking>")
    const noDone = await collect(parseOpenAiSse(bodyOf([openAi({ reasoning_content: "Cut off" })])))
    assert.equal(noDone, "<thinking>Cut off</thinking>")
  })

  test("an event that arrives in two pieces is read once it is whole", async () => {
    const event = openAi({ reasoning_content: "split" }) + openAi({ content: "done" })
    const cut = Math.floor(event.length / 3)
    const out = await collect(parseOpenAiSse(bodyOf([event.slice(0, cut), event.slice(cut, cut * 2), event.slice(cut * 2), "data: [DONE]\n\n"])))
    assert.equal(out, "<thinking>split</thinking>done")
  })

  test("an error event stops the reply with the provider's own words", async () => {
    const stream = bodyOf([openAi({ content: "Part of an answer" }), `data: ${JSON.stringify({ error: { message: "The model is overloaded." } })}\n\n`])
    await assert.rejects(collect(parseOpenAiSse(stream)), (e: unknown) => e instanceof ProviderError && e.message === "The model is overloaded.")
  })

  test("what comes out reads as a thinking block and then an answer", async () => {
    const raw = await collect(parseOpenAiSse(bodyOf([openAi({ reasoning_content: "Plan: add the numbers." }), openAi({ content: "It is 4." }), "data: [DONE]\n\n"])))
    const segments = parseContent(raw)
    assert.deepEqual(
      segments.map((s) => s.kind),
      ["thinking", "text"]
    )
    const [thinking, text] = segments
    assert.ok(thinking.kind === "thinking" && thinking.complete && thinking.text === "Plan: add the numbers.")
    assert.ok(text.kind === "text" && text.text === "It is 4.")
  })

  test("while the reasoning is still arriving, the block is open and unfinished", async () => {
    const raw = "<thinking>Weighing two options"
    const [only] = parseContent(raw)
    assert.ok(only.kind === "thinking" && !only.complete)
  })
})

describe("openAiChat", () => {
  test("streams a provider's reasoning from a real request and response", async () => {
    let sent: Record<string, unknown> = {}
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body))
      return new Response(bodyOf([openAi({ reasoning_content: "Think." }), openAi({ content: "Done." }), "data: [DONE]\n\n"]), { status: 200, headers: { "Content-Type": "text/event-stream" } })
    }) as typeof fetch
    const out = await collect(openAiChat({ baseUrl: "http://provider.test/v1", apiKey: "test-key-not-real", model: "m", messages: [{ role: "user", content: "hi" }], fetchImpl }))
    assert.equal(out, "<thinking>Think.</thinking>Done.")
    assert.equal(sent.stream, true)
  })
})

describe("Anthropic's stream", () => {
  const events = [
    anthropic("message_start", { message: { id: "msg_1" } }),
    thinkingDelta("Consider "),
    thinkingDelta("the question."),
    textDelta("Here is "),
    textDelta("the answer."),
    anthropic("message_stop", {}),
  ]

  function provider(chunks: string[], seen: Record<string, unknown>[] = [], refuseThinking = false) {
    return (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      seen.push(body)
      if (refuseThinking && "thinking" in body) {
        return new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "This model does not support thinking." } }), { status: 400, headers: { "Content-Type": "application/json" } })
      }
      return new Response(bodyOf(chunks), { status: 200, headers: { "Content-Type": "text/event-stream" } })
    }) as typeof fetch
  }

  const args = { baseUrl: "http://anthropic.test", apiKey: "test-key-not-real", model: "m", messages: [{ role: "user" as const, content: "hi" }] }

  test("thinking_delta comes out inside <thinking>, and the answer follows the closing tag", async () => {
    const out = await collect(anthropicChat({ ...args, fetchImpl: provider(events) }))
    assert.equal(out, "<thinking>Consider the question.</thinking>Here is the answer.")
  })

  test("asks for thinking only when the reply should think, and gives the answer room after it", async () => {
    const seen: Record<string, unknown>[] = []
    await collect(anthropicChat({ ...args, thinking: true, maxTokens: 4096, fetchImpl: provider(events, seen) }))
    const thinking = seen[0].thinking as { type: string; budget_tokens: number }
    assert.equal(thinking.type, "enabled")
    assert.ok(thinking.budget_tokens >= 1024 && thinking.budget_tokens < (seen[0].max_tokens as number), "the thinking budget has to stay below the reply limit")

    const plain: Record<string, unknown>[] = []
    await collect(anthropicChat({ ...args, thinking: false, fetchImpl: provider(events, plain) }))
    assert.equal("thinking" in plain[0], false)
  })

  test("a model that refuses thinking is asked again without it, and still answers", async () => {
    const seen: Record<string, unknown>[] = []
    const out = await collect(anthropicChat({ ...args, thinking: true, maxTokens: 4096, fetchImpl: provider([textDelta("Plain answer."), anthropic("message_stop", {})], seen, true) }))
    assert.equal(out, "Plain answer.")
    assert.equal(seen.length, 2)
    assert.ok("thinking" in seen[0])
    assert.equal("thinking" in seen[1], false)
  })

  test("a stream that ends while thinking closes the tag", async () => {
    const out = await collect(anthropicChat({ ...args, fetchImpl: provider([thinkingDelta("Half a thought")]) }))
    assert.equal(out, "<thinking>Half a thought</thinking>")
  })

  test("an error event stops the reply, and an overloaded one carries the 529 status", async () => {
    const chunks = [textDelta("Start"), anthropic("error", { error: { type: "overloaded_error", message: "Overloaded" } })]
    await assert.rejects(collect(anthropicChat({ ...args, fetchImpl: provider(chunks) })), (e: unknown) => e instanceof ProviderError && e.status === 529 && e.message === "Overloaded")
  })
})
