/**
 * A stand-in for the AI providers and for the web search, for the browser tests. It never sees a real key.
 *
 *   node tests/e2e/fake-llm.mjs            listens on FAKE_LLM_PORT (default 4599)
 *
 * What a message says decides what happens:
 *   FAIL_ALL    every provider answers 500
 *   ECHO_KEY    the provider answers 400 and repeats the key it was sent, to prove the app hides it
 *   (a request carrying <drafts> is God Mode's merge step and gets the merged answer)
 */
import { createServer } from "node:http"

const PORT = Number(process.env.FAKE_LLM_PORT ?? 4599)
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const LABEL = { groq: "Groq", mistral: "Mistral", anthropic: "Anthropic" }

const LISTS = {
  groq: { data: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"].map((id) => ({ id })) },
  mistral: { data: ["mistral-large-latest", "mistral-small-latest"].map((id) => ({ id })) },
  anthropic: {
    data: [
      { id: "claude-sonnet-4-5", display_name: "Claude Sonnet 4.5" },
      { id: "claude-haiku-4-5", display_name: "Claude Haiku 4.5" },
    ],
    has_more: false,
  },
}

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers })
  res.end(JSON.stringify(body))
}

function lastUserText(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : []
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== "user") continue
    if (typeof m.content === "string") return m.content
    if (Array.isArray(m.content)) return m.content.map((p) => p.text ?? "").join(" ")
  }
  return ""
}

async function chat(provider, req, res, raw) {
  let body = null
  try {
    body = JSON.parse(raw)
  } catch {
    return json(res, 400, { error: { message: "not JSON" } })
  }
  const text = lastUserText(body)
  const key = (req.headers.authorization ?? "").replace(/^Bearer /, "") || String(req.headers["x-api-key"] ?? "")
  if (text.includes("FAIL_ALL")) return json(res, 500, { error: { message: "The fake provider is down." } })
  if (text.includes("ECHO_KEY")) return json(res, 400, { error: { message: `Bad request. The key sent was ${key}.` } })

  const merging = raw.includes("<drafts>")
  const grounded = raw.includes("<web_results")
  const asked = text.replace(/<drafts>[\s\S]*$/, "").replace(/\s+/g, " ").trim().slice(0, 60)
  const reply = merging
    ? "Merged answer from the panel."
    : `${LABEL[provider]} here. You asked: ${asked}${grounded ? " Web results were provided [1]." : ""}`
  const pieces = reply.match(/[\s\S]{1,14}/g) ?? [reply]

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" })
  if (provider === "anthropic") {
    const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
    send("message_start", { message: { id: "msg_fake", role: "assistant" } })
    for (const t of pieces) {
      if (res.destroyed) return
      send("content_block_delta", { index: 0, delta: { type: "text_delta", text: t } })
      await sleep(20)
    }
    send("message_stop", {})
    return res.end()
  }
  for (const t of pieces) {
    if (res.destroyed) return
    res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: t } }] })}\n\n`)
    await sleep(20)
  }
  res.write("data: [DONE]\n\n")
  res.end()
}

const server = createServer((req, res) => {
  const chunks = []
  req.on("data", (c) => chunks.push(c))
  req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8")
    const url = new URL(req.url ?? "/", "http://fake")
    const path = url.pathname

    const provider = /^\/(groq|mistral|anthropic)\//.exec(path)?.[1]
    if (provider && /\/models$/.test(path)) return json(res, 200, LISTS[provider])
    if (provider && /\/(chat\/completions|messages)$/.test(path)) return void chat(provider, req, res, raw)

    if (path === "/tinyfish/search") {
      if (!req.headers["x-api-key"]) return json(res, 401, { error: "missing key" })
      return json(res, 200, {
        results: [1, 2, 3].map((n) => ({
          position: n,
          site_name: `Example ${n}`,
          title: `Fake result ${n} for ${url.searchParams.get("query")}`,
          snippet: `A short snippet number ${n}.`,
          url: `https://example.com/e2e-${n}`,
        })),
      })
    }
    if (path === "/tinyfish/fetch") {
      let urls = []
      try {
        urls = JSON.parse(raw).urls ?? []
      } catch {
        /* none */
      }
      return json(res, 200, { results: urls.map((u) => ({ url: u, final_url: u, title: "Page", text: `Full text of ${u}.` })), errors: [] })
    }
    if (path === "/health") return json(res, 200, { ok: true })
    json(res, 404, { error: { message: `The fake has no route for ${path}.` } })
  })
})

server.listen(PORT, "127.0.0.1", () => console.log(`[fake-llm] listening on http://127.0.0.1:${PORT}`))
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0))
