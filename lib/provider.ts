import { expireSession } from "./account"
import { toWire } from "./chat-messages"
import { mockReply } from "./mock"
import { fetchModelIds, openAiChat, ProviderError } from "./openai"
import type { StreamEvent } from "./router/types"
import { STANDALONE } from "./standalone"
import type { Message, Settings } from "./types"
import { isAbortError, uid } from "./utils"
import { priorityFor, thinkingFor } from "./router/effort"

export { fetchModelIds, ProviderError, STANDALONE }

export interface StreamArgs {
  settings: Settings
  model: string
  system: string
  /** Root-to-user path for the turn being answered. */
  thread: Message[]
  signal: AbortSignal
  /** Set when the server should keep this turn. Left out when saving is switched off. */
  save?: { chatId: string; assistantId: string; title: string; starred: boolean; projectId: string | null; createdAt: number }
  /** Called when the server says how the reply is being made: the model in charge, the God Mode council, the web sources. */
  onMeta?: (patch: Partial<Message>) => void
}

export async function* streamReply(args: StreamArgs): AsyncGenerator<string> {
  const { settings } = args
  if (settings.provider === "openai") {
    // Straight from this browser to the address in Settings.
    yield* openAiChat({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: args.model,
      messages: toWire(args.system, args.thread),
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      signal: args.signal,
    })
  } else if (STANDALONE) {
    yield* demoReply(args)
  } else {
    yield* serverReply(args)
  }
}

/** The preview's reply: the demo model's words, after the way this message would be routed has been shown. */
async function* demoReply({ settings, model, thread, signal, onMeta }: StreamArgs): AsyncGenerator<string> {
  const last = thread[thread.length - 1]
  const prompt = last?.content ?? ""
  // The router screens in the preview are samples (see sample-catalog.ts). It is loaded here only, so the Next.js app never fetches it.
  const finish = onMeta
    ? await import("./sample-catalog").then((m) =>
        m.playSampleRouting({ model, prompt, priority: priorityFor(settings.effort, settings.routePriority), disabled: settings.disabledProviders, godMax: settings.godMax, speed: testSpeed(), signal, onMeta })
      )
    : undefined
  yield* mockReply({
    prompt,
    attachments: last?.attachments ?? [],
    thinking: thinkingFor(settings.effort, model),
    noAccess: settings.webSearch || settings.research,
    signal,
    speed: testSpeed(),
  })
  finish?.()
}

let cachedSpeed: number | undefined

/**
 * Automated tests can ask for a faster demo model with ?speed=20 in the address, or a slower one (down to 0.1) to watch a reply being written.
 * It is remembered for the tab, so it survives moving between screens. Normal use is unaffected.
 */
function testSpeed() {
  if (cachedSpeed !== undefined) return cachedSpeed
  let n = 1
  try {
    const fromUrl = Number(new URLSearchParams(window.location.search).get("speed"))
    const saved = Number(window.sessionStorage.getItem("cyphor:speed"))
    const ok = (v: number) => v >= 0.1 && v <= 50
    n = ok(fromUrl) ? fromUrl : ok(saved) ? saved : 1
    if (ok(fromUrl)) window.sessionStorage.setItem("cyphor:speed", String(fromUrl))
  } catch {
    /* storage can be blocked */
  }
  return (cachedSpeed = n)
}

/** Answers through this app's own /api/chat, which holds the key and keeps the conversation. */
async function* serverReply({ settings, model, system, thread, signal, save, onMeta }: StreamArgs): AsyncGenerator<string> {
  const last = thread[thread.length - 1]
  let res: Response
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: save?.chatId ?? null,
        assistantId: save?.assistantId ?? uid("m_"),
        model,
        system,
        thread,
        chat: save ? { title: save.title, starred: save.starred, projectId: save.projectId, createdAt: save.createdAt } : undefined,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        thinking: thinkingFor(settings.effort, model),
        effort: settings.effort,
        noAccess: settings.webSearch || settings.research,
        web: settings.research ? "research" : settings.webSearch ? "search" : "off",
        priority: settings.routePriority,
        disabledProviders: settings.disabledProviders,
        godMax: settings.godMax,
        speed: testSpeed(),
      }),
    })
  } catch (e) {
    if (isAbortError(e)) throw e
    throw new ProviderError("Could not reach the Cyphor server. Check your connection and try again.")
  }
  if (res.status === 401) {
    // The sign-in ended (a week away, or signed out in another tab). The page then goes to the login page.
    expireSession()
    throw new ProviderError("Your session ended. Sign in again to keep chatting.", { status: 401 })
  }
  if (!res.ok) throw new ProviderError(await errorMessage(res, last), { status: res.status })
  if (!res.body) throw new ProviderError("The server sent an empty response.")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let finished = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        let ev: StreamEvent
        try {
          ev = JSON.parse(line)
        } catch {
          continue
        }
        if (ev.type === "text") yield ev.text
        else if (ev.type === "route") onMeta?.({ route: ev.route })
        else if (ev.type === "council") onMeta?.({ council: ev.council })
        else if (ev.type === "web") onMeta?.({ sources: ev.sources.length ? ev.sources : undefined, webNote: ev.note })
        else if (ev.type === "error") throw new ProviderError(ev.message, { status: ev.status, retryAfterSec: ev.retryAfterSec })
        else if (ev.type === "done") finished = true
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
  if (!finished) throw new ProviderError("The connection ended before the reply was finished. Try again.")
}

async function errorMessage(res: Response, _last?: Message) {
  try {
    const j = (await res.json()) as { error?: { message?: string } }
    if (j?.error?.message) return j.error.message
  } catch {
    /* not JSON */
  }
  return `The server returned ${res.status}.`
}
