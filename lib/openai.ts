/**
 * Talks to any server that speaks the OpenAI chat API (OpenAI, OpenRouter, Groq, Gemini, Ollama, LM Studio, vLLM...).
 * Used in two places: the server (/api/chat, with the key from the environment) and the browser
 * ("Your own LLM" in Settings, with a key the person typed in). Same code, same error messages.
 */
import type { WireMessage } from "./chat-messages"
import { HttpError, isAbort, isRetryableStatus, parseRetryAfter, withRetry, type RetryOptions } from "./retry"

export class ProviderError extends Error {
  status: number | undefined
  retryAfterSec: number | undefined

  constructor(message: string, opts: { status?: number; retryAfterSec?: number } = {}) {
    super(message)
    this.name = "ProviderError"
    this.status = opts.status
    this.retryAfterSec = opts.retryAfterSec
  }
}

export async function readError(res: Response) {
  try {
    const text = await res.text()
    try {
      const j = JSON.parse(text)
      const message = j?.error?.message ?? j?.message ?? j?.detail ?? (Array.isArray(j) ? j[0]?.error?.message : undefined)
      return typeof message === "string" ? message : text.slice(0, 300)
    } catch {
      return text.slice(0, 300)
    }
  } catch {
    return res.statusText
  }
}

export function explainStatus(status: number, detail: string) {
  if (status === 401 || status === 403) return `The server rejected the API key (${status}). ${detail}`
  if (status === 404) return `Endpoint or model not found (404). ${detail}`
  if (status === 429) return `Rate limit reached (429). ${detail}`
  return `The server returned ${status}. ${detail}`
}

export interface PostArgs {
  url: string
  headers?: Record<string, string>
  body: Record<string, unknown>
  signal?: AbortSignal
  /** Replaceable for tests. */
  fetchImpl?: typeof fetch
  /** Shown when the server cannot be reached at all. */
  unreachable?: string
  /** Retries cover the time before the first byte arrives: network errors, 429 and 5xx. */
  retry?: RetryOptions
  /**
   * Called when the server refuses the request with a 4xx. Return a changed body to send once more
   * (a provider that wants `max_completion_tokens` instead of `max_tokens`, say), or null to give up.
   */
  adjust?: (status: number, detail: string, body: Record<string, unknown>) => Record<string, unknown> | null
}

/** POSTs JSON and returns the response once it is a success. Retries what is worth retrying, explains what is not. */
export async function postStream(a: PostArgs): Promise<Response> {
  const doFetch = a.fetchImpl ?? fetch
  let body = a.body
  for (let adjusted = 0; ; adjusted++) {
    let res: Response
    try {
      res = await withRetry(
        async () => {
          const r = await doFetch(a.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...a.headers },
            signal: a.signal,
            body: JSON.stringify(body),
          })
          if (!r.ok && isRetryableStatus(r.status)) {
            throw new HttpError(r.status, await readError(r), parseRetryAfter(r.headers.get("retry-after")))
          }
          return r
        },
        { signal: a.signal, ...a.retry }
      )
    } catch (e) {
      if (isAbort(e)) throw e
      if (e instanceof HttpError) {
        throw new ProviderError(explainStatus(e.status, e.message), {
          status: e.status,
          retryAfterSec: e.retryAfterMs !== undefined ? Math.ceil(e.retryAfterMs / 1000) : undefined,
        })
      }
      throw new ProviderError(
        a.unreachable ?? "Could not reach the server. Check the base URL, your network, and that the server allows requests from this page (CORS)."
      )
    }
    if (res.ok) return res
    const detail = await readError(res)
    const next = adjusted < 2 ? a.adjust?.(res.status, detail, body) : null
    if (next) {
      body = next
      continue
    }
    const retryAfter = parseRetryAfter(res.headers.get("retry-after"))
    throw new ProviderError(explainStatus(res.status, detail), {
      status: res.status,
      retryAfterSec: retryAfter !== undefined ? Math.ceil(retryAfter / 1000) : undefined,
    })
  }
}

export interface OpenAiArgs {
  baseUrl: string
  apiKey?: string
  model: string
  messages: WireMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  /** Replaceable for tests. */
  fetchImpl?: typeof fetch
  /** Shown when the server cannot be reached at all. */
  unreachable?: string
  retry?: RetryOptions
  /** Extra headers, on top of the Authorization header made from `apiKey`. */
  headers?: Record<string, string>
  /** Some providers only accept the newer name for the reply length cap. */
  tokenParam?: "max_tokens" | "max_completion_tokens"
  /** Extra fields for the request body (reasoning effort, say). */
  extraBody?: Record<string, unknown>
}

/**
 * Providers disagree about a few optional fields. When one refuses a field by name, try again
 * without it (or with the other spelling) rather than failing a message over a detail.
 */
export function adjustOpenAiBody(status: number, detail: string, body: Record<string, unknown>): Record<string, unknown> | null {
  if (status !== 400 && status !== 422) return null
  const next = { ...body }
  if (/temperature/i.test(detail) && "temperature" in next) {
    delete next.temperature
    return next
  }
  if (/max_completion_tokens/i.test(detail) && "max_tokens" in next) {
    next.max_completion_tokens = next.max_tokens
    delete next.max_tokens
    return next
  }
  if (/max_tokens/i.test(detail) && "max_completion_tokens" in next) {
    next.max_tokens = next.max_completion_tokens
    delete next.max_completion_tokens
    return next
  }
  if (/reasoning_effort|reasoning/i.test(detail) && "reasoning_effort" in next) {
    delete next.reasoning_effort
    return next
  }
  return null
}

export async function* openAiChat(args: OpenAiArgs): AsyncGenerator<string> {
  const base = args.baseUrl.trim().replace(/\/+$/, "")
  if (!base) throw new ProviderError("Add a base URL in Settings > Model.")
  const headers: Record<string, string> = { ...args.headers }
  if (args.apiKey?.trim()) headers.Authorization = `Bearer ${args.apiKey.trim()}`

  const body: Record<string, unknown> = { model: args.model, stream: true, messages: args.messages, ...args.extraBody }
  if (args.temperature !== undefined) body.temperature = args.temperature
  if (args.maxTokens !== undefined) body[args.tokenParam ?? "max_tokens"] = args.maxTokens

  const res = await postStream({
    url: `${base}/chat/completions`,
    headers,
    body,
    signal: args.signal,
    fetchImpl: args.fetchImpl,
    unreachable: args.unreachable,
    retry: args.retry,
    adjust: adjustOpenAiBody,
  })
  if (!res.body) throw new ProviderError("The server sent an empty response.")
  yield* parseOpenAiSse(res.body)
}

/**
 * Turns an OpenAI-style event stream into plain text pieces. Reasoning tokens (reasoning_content or
 * reasoning) are wrapped in <thinking>...</thinking> so the interface can fold them away.
 */
export async function* parseOpenAiSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let inThinking = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line.startsWith("data:")) continue
        const data = line.slice(5).trim()
        if (data === "[DONE]") {
          if (inThinking) yield "</thinking>"
          return
        }
        let json: { choices?: { delta?: Record<string, unknown> }[]; error?: { message?: string } | string }
        try {
          json = JSON.parse(data)
        } catch {
          continue
        }
        if (json.error) throw new ProviderError(typeof json.error === "string" ? json.error : (json.error.message ?? "The model reported an error."))
        const delta = json.choices?.[0]?.delta
        if (!delta) continue
        const reasoning = (delta.reasoning_content ?? delta.reasoning) as string | undefined
        if (reasoning) {
          if (!inThinking) {
            inThinking = true
            yield "<thinking>"
          }
          yield reasoning
        }
        const content = delta.content as string | undefined
        if (content) {
          if (inThinking) {
            inThinking = false
            yield "</thinking>"
          }
          yield content
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
  if (inThinking) yield "</thinking>"
}

/** Lists model ids from `${baseUrl}/models` (OpenAI-compatible). */
export async function fetchModelIds(baseUrl: string, apiKey: string): Promise<string[]> {
  const base = baseUrl.trim().replace(/\/+$/, "")
  const headers: Record<string, string> = {}
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`
  let res: Response
  try {
    res = await fetch(`${base}/models`, { headers })
  } catch {
    throw new ProviderError("Could not reach the server. Check the URL and CORS settings.")
  }
  if (!res.ok) throw new ProviderError(`The server returned ${res.status}. ${await readError(res)}`)
  const j = (await res.json()) as { data?: { id: string }[] }
  const ids = (j.data ?? []).map((m) => m.id).filter(Boolean)
  if (!ids.length) throw new ProviderError("The server did not list any models.")
  return ids
}
