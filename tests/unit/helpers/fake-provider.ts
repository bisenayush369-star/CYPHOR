/**
 * A tiny stand-in for the AI providers, so the router can be tested without a key or a network.
 * It speaks just enough of the OpenAI chat API (model list, streamed replies) and of Anthropic's
 * messages API to be mistaken for the real thing by the code under test. The keys the tests use are
 * obviously made up.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"

export interface Seen {
  method: string
  /** The path without its query string. */
  path: string
  headers: IncomingMessage["headers"]
  /** The body parsed as JSON, or null when there was none. */
  json: any
  raw: string
}

export type Handler = (req: Seen, res: ServerResponse) => void | Promise<void>

export interface FakeServer {
  url: string
  seen: Seen[]
  /** Answers every request whose path starts with `prefix`. The longest matching prefix wins, and a new handler replaces an old one. */
  route(prefix: string, handler: Handler): void
  /** How many requests came in under `prefix`, optionally of one method. */
  count(prefix: string, method?: string): number
  reset(): void
  close(): Promise<void>
}

export const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  if (res.destroyed) return
  res.writeHead(status, { "Content-Type": "application/json", ...headers })
  res.end(JSON.stringify(body))
}

export interface StreamOptions {
  /** Wait this long before sending anything. */
  startDelayMs?: number
  /** Wait this long between pieces. */
  delayMs?: number
  /** Drop the connection after the pieces instead of finishing properly. */
  cut?: boolean
}

/** A streamed reply in the OpenAI chat format. */
export async function openAiStream(res: ServerResponse, pieces: string[], o: StreamOptions = {}) {
  if (o.startDelayMs) await sleep(o.startDelayMs)
  if (res.destroyed) return
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" })
  for (const piece of pieces) {
    if (res.destroyed) return
    res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: piece } }] })}\n\n`)
    if (o.delayMs) await sleep(o.delayMs)
  }
  if (o.cut) {
    // Let what was written reach the client first: a destroyed socket drops anything still waiting to be sent.
    await sleep(40)
    res.destroy()
    return
  }
  res.write("data: [DONE]\n\n")
  res.end()
}

/** A streamed reply in Anthropic's messages format. */
export async function anthropicStream(res: ServerResponse, pieces: string[], o: StreamOptions = {}) {
  if (o.startDelayMs) await sleep(o.startDelayMs)
  if (res.destroyed) return
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" })
  const send = (type: string, data: Record<string, unknown>) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
  send("message_start", { message: { id: "msg_fake", role: "assistant" } })
  for (const text of pieces) {
    if (res.destroyed) return
    send("content_block_delta", { index: 0, delta: { type: "text_delta", text } })
    if (o.delayMs) await sleep(o.delayMs)
  }
  if (o.cut) {
    // Let what was written reach the client first: a destroyed socket drops anything still waiting to be sent.
    await sleep(40)
    res.destroy()
    return
  }
  send("message_stop", {})
  res.end()
}

/** The body of a "list models" answer. */
export const modelList = (...ids: string[]) => ({ object: "list", data: ids.map((id) => ({ id, object: "model" })) })

export async function startFake(): Promise<FakeServer> {
  const routes = new Map<string, Handler>()
  const seen: Seen[] = []
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (c: Buffer) => chunks.push(c))
    req.on("end", () => {
      void (async () => {
        const raw = Buffer.concat(chunks).toString("utf8")
        let json: any = null
        try {
          json = raw ? JSON.parse(raw) : null
        } catch {
          /* not JSON */
        }
        const path = (req.url ?? "/").split("?")[0]
        const call: Seen = { method: req.method ?? "GET", path, headers: req.headers, json, raw }
        seen.push(call)
        const match = [...routes].filter(([prefix]) => path.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0]
        if (!match) return sendJson(res, 404, { error: { message: `The fake provider has no route for ${path}.` } })
        try {
          await match[1](call, res)
        } catch (e) {
          if (!res.headersSent) sendJson(res, 500, { error: { message: String(e) } })
          else res.destroy()
        }
      })()
    })
  })
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}`,
    seen,
    route: (prefix, handler) => void routes.set(prefix, handler),
    count: (prefix, method) => seen.filter((s) => s.path.startsWith(prefix) && (!method || s.method === method)).length,
    reset: () => {
      routes.clear()
      seen.length = 0
    },
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections()
        server.close(() => done())
      }),
  }
}
