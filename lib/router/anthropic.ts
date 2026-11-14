/**
 * Anthropic's own Messages API. It is not OpenAI-shaped: the system prompt is a separate field, images are
 * content blocks, and the stream has its own event names. This turns our wire messages into that format and
 * the stream back into the plain text pieces the rest of the app uses (thinking wrapped in <thinking> tags).
 */
import type { WireMessage, WirePart } from "../chat-messages"
import { ProviderError, postStream } from "../openai"
import type { RetryOptions } from "../retry"
import { readSse } from "../sse"

type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } | { type: "url"; url: string } }

interface AnthropicMessage {
  role: "user" | "assistant"
  content: Block[]
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])

function toBlocks(content: string | WirePart[]): Block[] {
  if (typeof content === "string") return content.trim() ? [{ type: "text", text: content }] : []
  const out: Block[] = []
  for (const part of content) {
    if (part.type === "text") {
      if (part.text.trim()) out.push({ type: "text", text: part.text })
      continue
    }
    const url = part.image_url.url
    const m = /^data:([^;,]+);base64,(.+)$/s.exec(url)
    if (m) {
      if (IMAGE_TYPES.has(m[1])) out.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } })
      else out.push({ type: "text", text: `(an image of type ${m[1]} was left out: only JPEG, PNG, GIF and WebP are supported)` })
    } else if (/^https?:\/\//i.test(url)) {
      out.push({ type: "image", source: { type: "url", url } })
    }
  }
  return out
}

/** The system prompt, and the conversation with consecutive turns of the same role merged. */
export function toAnthropicMessages(wire: WireMessage[]): { system: string; messages: AnthropicMessage[] } {
  const system: string[] = []
  const messages: AnthropicMessage[] = []
  for (const m of wire) {
    if (m.role === "system") {
      const text = typeof m.content === "string" ? m.content : m.content.map((p) => (p.type === "text" ? p.text : "")).join("\n")
      if (text.trim()) system.push(text)
      continue
    }
    const blocks = toBlocks(m.content)
    if (!blocks.length) continue
    const last = messages[messages.length - 1]
    if (last && last.role === m.role) last.content.push(...blocks)
    else messages.push({ role: m.role, content: blocks })
  }
  // The conversation has to open with the user.
  if (messages[0]?.role === "assistant") messages.unshift({ role: "user", content: [{ type: "text", text: "(conversation continues)" }] })
  return { system: system.join("\n\n"), messages }
}

export interface AnthropicArgs {
  baseUrl: string
  apiKey: string
  model: string
  messages: WireMessage[]
  temperature?: number
  maxTokens?: number
  /** Ask the model to think before answering. Dropped automatically if the model does not support it. */
  thinking?: boolean
  headers?: Record<string, string>
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  retry?: RetryOptions
}

export async function* anthropicChat(a: AnthropicArgs): AsyncGenerator<string> {
  const base = a.baseUrl.trim().replace(/\/+$/, "").replace(/\/v1$/, "")
  const { system, messages } = toAnthropicMessages(a.messages)
  if (!messages.length) throw new ProviderError("There is nothing to send to the model.")

  let maxTokens = Math.max(1, Math.round(a.maxTokens ?? 4096))
  const body: Record<string, unknown> = { model: a.model, max_tokens: maxTokens, stream: true, messages }
  if (system) body.system = system
  if (a.thinking && maxTokens >= 2048) {
    // The budget has to stay below max_tokens, and the reply needs room after the thinking.
    const budget = Math.min(16_000, Math.max(1024, Math.floor(maxTokens * 0.6)))
    maxTokens = Math.max(maxTokens, budget + 1024)
    body.max_tokens = maxTokens
    body.thinking = { type: "enabled", budget_tokens: budget }
  } else if (a.temperature !== undefined) {
    // Anthropic accepts 0 to 1 (and wants the default when thinking is on).
    body.temperature = Math.min(1, Math.max(0, a.temperature))
  }

  const res = await postStream({
    url: `${base}/v1/messages`,
    headers: a.headers,
    body,
    signal: a.signal,
    fetchImpl: a.fetchImpl,
    retry: a.retry,
    unreachable: "Could not reach Anthropic. Check the network and ANTHROPIC_BASE_URL.",
    // A model that cannot think refuses the field. Send the message again without it.
    adjust: (status, detail, current) => {
      if (status === 400 && "thinking" in current && /thinking/i.test(detail)) {
        const next = { ...current }
        delete next.thinking
        if (a.temperature !== undefined) next.temperature = Math.min(1, Math.max(0, a.temperature))
        return next
      }
      return null
    },
  })
  if (!res.body) throw new ProviderError("Anthropic sent an empty response.")

  let inThinking = false
  for await (const ev of readSse(res.body)) {
    let json: {
      type?: string
      delta?: { type?: string; text?: string; thinking?: string }
      content_block?: { type?: string }
      error?: { type?: string; message?: string }
    }
    try {
      json = JSON.parse(ev.data)
    } catch {
      continue
    }
    const type = json.type ?? ev.event
    if (type === "error") {
      const overloaded = json.error?.type === "overloaded_error"
      throw new ProviderError(json.error?.message ?? "Anthropic reported an error.", { status: overloaded ? 529 : undefined })
    }
    if (type === "content_block_delta") {
      const d = json.delta
      if (d?.type === "thinking_delta" && d.thinking) {
        if (!inThinking) {
          inThinking = true
          yield "<thinking>"
        }
        yield d.thinking
      } else if (d?.type === "text_delta" && d.text) {
        if (inThinking) {
          inThinking = false
          yield "</thinking>"
        }
        yield d.text
      }
    } else if (type === "message_stop") {
      break
    }
  }
  if (inThinking) yield "</thinking>"
}
